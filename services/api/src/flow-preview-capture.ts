import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { resolveInside } from '@sber-designer/ast-bridge';
import type { ProjectFlowPreviewCapture } from '@sber-designer/shared-types';

const CAPTURE_ROOT = '.sber-designer/previews/screens';
const CAPTURE_TIMEOUT_MS = 15_000;
// Poll for the client-rendered screen root before deciding render health.
const RENDER_POLL_ATTEMPTS = 12;
const RENDER_POLL_INTERVAL_MS = 500;

export interface FlowPreviewCaptureInput {
  screenId: string;
  url: string;
  sourceFingerprint: string;
}

export interface FlowPreviewCaptureResult {
  status: 'captured' | 'partial' | 'unavailable';
  captures: ProjectFlowPreviewCapture[];
  message?: string | undefined;
}

export interface ChromePageInspection {
  bodyText: string;
  rootFound: boolean;
  consoleErrors: string[];
}

export function normalizeCaptureScreenId(screenId: string): string {
  const value = screenId.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error('Invalid screen id for preview capture.');
  }
  return value;
}

export function flowPreviewCapturePath(screenId: string): string {
  return `${CAPTURE_ROOT}/${normalizeCaptureScreenId(screenId)}.png`;
}

export function buildFlowPreviewCaptureRecord(input: {
  screenId: string;
  viewport: { width: number; height: number };
  capturedAt: number;
  sourceFingerprint: string;
}): ProjectFlowPreviewCapture {
  return {
    screenId: normalizeCaptureScreenId(input.screenId),
    imagePath: flowPreviewCapturePath(input.screenId),
    viewport: input.viewport,
    capturedAt: input.capturedAt,
    sourceFingerprint: input.sourceFingerprint,
  };
}

export async function captureFlowScreenPreviews(input: {
  workspaceRoot: string;
  chromeDebuggingUrl: string | null | undefined;
  screens: readonly FlowPreviewCaptureInput[];
  viewport: { width: number; height: number };
}): Promise<FlowPreviewCaptureResult> {
  if (!input.chromeDebuggingUrl) {
    return {
      status: 'unavailable',
      captures: [],
      message:
        'Preview capture server unavailable. Set SBER_DESIGNER_CHROME_DEBUGGING_URL to enable screenshot capture.',
    };
  }

  const captures: ProjectFlowPreviewCapture[] = [];
  const errors: string[] = [];
  for (const screen of input.screens) {
    try {
      const capturedAt = Date.now();
      const pngBase64 = await capturePngWithChrome({
        chromeDebuggingUrl: input.chromeDebuggingUrl,
        url: screen.url,
        viewport: input.viewport,
      });
      const record = buildFlowPreviewCaptureRecord({
        screenId: screen.screenId,
        viewport: input.viewport,
        capturedAt,
        sourceFingerprint: screen.sourceFingerprint,
      });
      const abs = resolveInside(input.workspaceRoot, record.imagePath);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, Buffer.from(pngBase64, 'base64'));
      captures.push(record);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (captures.length === input.screens.length) return { status: 'captured', captures };
  if (captures.length > 0) {
    return { status: 'partial', captures, message: errors[0] };
  }
  return { status: 'unavailable', captures, message: errors[0] ?? 'Preview capture failed.' };
}

export async function capturePngWithChrome(input: {
  chromeDebuggingUrl: string;
  url: string;
  viewport: { width: number; height: number };
}): Promise<string> {
  const base = input.chromeDebuggingUrl.replace(/\/+$/, '');
  const page = await createChromePage(base);
  const client = new ChromeDevtoolsClient(page.webSocketDebuggerUrl);
  await client.open();
  try {
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await blockWebpackHmr(client);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: input.viewport.width,
      height: input.viewport.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const loaded = client.waitForEvent('Page.loadEventFired', CAPTURE_TIMEOUT_MS);
    await client.send('Page.navigate', { url: input.url });
    await loaded;
    await delay(250);
    const screenshot = await client.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    });
    if (!isScreenshotResult(screenshot)) {
      throw new Error('Chrome did not return screenshot data.');
    }
    return screenshot.data;
  } finally {
    client.close();
    await fetch(`${base}/json/close/${encodeURIComponent(page.id)}`).catch(() => undefined);
  }
}

export async function inspectPageWithChrome(input: {
  chromeDebuggingUrl: string;
  url: string;
  viewport: { width: number; height: number };
}): Promise<ChromePageInspection> {
  const base = input.chromeDebuggingUrl.replace(/\/+$/, '');
  const page = await createChromePage(base);
  const client = new ChromeDevtoolsClient(page.webSocketDebuggerUrl);
  const consoleErrors: string[] = [];
  await client.open();
  try {
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await blockWebpackHmr(client);
    client.onEvent('Runtime.consoleAPICalled', (params) => {
      const message = consoleApiMessage(params);
      if (message) consoleErrors.push(message);
    });
    client.onEvent('Runtime.exceptionThrown', (params) => {
      const message = exceptionThrownMessage(params);
      if (message) consoleErrors.push(message);
    });
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: input.viewport.width,
      height: input.viewport.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const loaded = client.waitForEvent('Page.loadEventFired', CAPTURE_TIMEOUT_MS);
    await client.send('Page.navigate', { url: input.url });
    await loaded;
    // The screen root is injected by client-side React AFTER load, so a single
    // probe right after `load` is too early (task 9999 LIVE-4). Poll until the
    // root appears (or a runtime error surfaces). Match `[data-sd-screen-root]`
    // with any value, mirroring the static HTTP probe — not `="true"`.
    let inspection = { bodyText: '', rootFound: false };
    for (let attempt = 0; attempt < RENDER_POLL_ATTEMPTS; attempt += 1) {
      await delay(RENDER_POLL_INTERVAL_MS);
      const result = await client.send('Runtime.evaluate', {
        expression: `(() => {
          const text = document.body?.innerText ?? '';
          const rootFound = Boolean(document.querySelector('[data-sd-screen-root]'));
          return { bodyText: text, rootFound };
        })()`,
        returnByValue: true,
      });
      inspection = pageInspectionResult(result);
      if (inspection.rootFound || consoleErrors.length > 0) break;
    }
    return { ...inspection, consoleErrors };
  } finally {
    client.close();
    await fetch(`${base}/json/close/${encodeURIComponent(page.id)}`).catch(() => undefined);
  }
}

async function createChromePage(
  base: string,
): Promise<{ id: string; webSocketDebuggerUrl: string }> {
  const res = await fetch(`${base}/json/new?${encodeURIComponent('about:blank')}`, {
    method: 'PUT',
  });
  if (!res.ok) {
    throw new Error(`Chrome capture target failed with HTTP ${res.status}.`);
  }
  const body = (await res.json()) as { id?: unknown; webSocketDebuggerUrl?: unknown };
  if (typeof body.id !== 'string' || typeof body.webSocketDebuggerUrl !== 'string') {
    throw new Error('Chrome capture target did not expose a debugger websocket.');
  }
  return { id: body.id, webSocketDebuggerUrl: body.webSocketDebuggerUrl };
}

class ChromeDevtoolsClient {
  private socket: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: Error) => void }
  >();
  private listeners = new Map<string, Set<(params: unknown) => void>>();

  constructor(private readonly url: string) {}

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url);
      this.socket = socket;
      socket.addEventListener('open', () => resolve(), { once: true });
      socket.addEventListener(
        'error',
        () => reject(new Error('Could not connect to Chrome preview capture websocket.')),
        { once: true },
      );
      socket.addEventListener('message', (event) => this.handleMessage(event.data));
      socket.addEventListener('close', () => {
        for (const pending of this.pending.values()) {
          pending.reject(new Error('Chrome preview capture websocket closed.'));
        }
        this.pending.clear();
      });
    });
  }

  send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Chrome preview capture websocket is not open.'));
    }
    const id = this.nextId++;
    const payload = params ? { id, method, params } : { id, method };
    socket.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Chrome command timed out: ${method}`));
      }, CAPTURE_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (reason) => {
          clearTimeout(timer);
          reject(reason);
        },
      });
    });
  }

  waitForEvent(method: string, timeoutMs: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for Chrome event: ${method}`));
      }, timeoutMs);
      const listener = (params: unknown) => {
        cleanup();
        resolve(params);
      };
      const cleanup = () => {
        clearTimeout(timer);
        this.listeners.get(method)?.delete(listener);
      };
      const listeners = this.listeners.get(method) ?? new Set<(params: unknown) => void>();
      listeners.add(listener);
      this.listeners.set(method, listeners);
    });
  }

  onEvent(method: string, listener: (params: unknown) => void): () => void {
    const listeners = this.listeners.get(method) ?? new Set<(params: unknown) => void>();
    listeners.add(listener);
    this.listeners.set(method, listeners);
    return () => {
      listeners.delete(listener);
    };
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
  }

  private handleMessage(data: unknown): void {
    const text = typeof data === 'string' ? data : '';
    if (!text) return;
    const message = JSON.parse(text) as {
      id?: number;
      method?: string;
      params?: unknown;
      result?: unknown;
      error?: { message?: string };
    };
    if (typeof message.id === 'number') {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message ?? 'Chrome command failed.'));
      } else {
        pending.resolve(message.result);
      }
      return;
    }
    if (typeof message.method === 'string') {
      for (const listener of this.listeners.get(message.method) ?? []) {
        listener(message.params);
      }
    }
  }
}

/**
 * Webpack-dev Storybook (the sandbox preview) uses HMR: when a stale
 * `*.hot-update.json` 404s, its runtime calls `location.reload()`, which blanks
 * the page mid-probe (task 9999 LIVE-4 — verified live: blocking these requests
 * turns a flapping/blank render into a stable one). Block the HMR transport so a
 * one-shot render / inspection stays put.
 */
async function blockWebpackHmr(client: ChromeDevtoolsClient): Promise<void> {
  try {
    await client.send('Network.enable');
    await client.send('Network.setBlockedURLs', {
      urls: ['*hot-update.json', '*hot-update.js', '*__webpack_hmr*'],
    });
  } catch {
    // Best effort: if the target doesn't support Network.* we still try to render.
  }
}

function isScreenshotResult(value: unknown): value is { data: string } {
  return Boolean(
    value && typeof value === 'object' && typeof (value as { data?: unknown }).data === 'string',
  );
}

function pageInspectionResult(value: unknown): { bodyText: string; rootFound: boolean } {
  if (!isRecord(value)) return { bodyText: '', rootFound: false };
  const result = value.result;
  if (!isRecord(result)) return { bodyText: '', rootFound: false };
  const resultValue = result.value;
  if (!isRecord(resultValue)) return { bodyText: '', rootFound: false };
  return {
    bodyText: typeof resultValue.bodyText === 'string' ? resultValue.bodyText : '',
    rootFound: resultValue.rootFound === true,
  };
}

function consoleApiMessage(params: unknown): string | null {
  if (!isRecord(params) || params.type !== 'error' || !Array.isArray(params.args)) return null;
  const parts = params.args
    .map((arg) => (isRecord(arg) ? (arg.value ?? arg.description) : null))
    .filter((part): part is string => typeof part === 'string' && part.length > 0);
  return parts.join(' ').trim() || null;
}

function exceptionThrownMessage(params: unknown): string | null {
  if (!isRecord(params)) return null;
  const details = params.exceptionDetails;
  if (!isRecord(details)) return null;
  const exception = details.exception;
  const text =
    (isRecord(exception) &&
      (typeof exception.description === 'string'
        ? exception.description
        : typeof exception.value === 'string'
          ? exception.value
          : null)) ||
    (typeof details.text === 'string' ? details.text : null);
  return text?.trim() || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
