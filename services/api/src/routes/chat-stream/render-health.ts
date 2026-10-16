/**
 * Post-run render health: canvas inspection, visual snapshots, changed
 * active-screen detection and user-facing notices.
 */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { resolveInside } from '@sber-designer/ast-bridge';
import { type ComponentReuseRunSummary } from '@sber-designer/shared-types';
import {
  recordToolReceiptSafely,
  readAgentRunReceipts,
  summarizeComponentReuseFromReceipts,
  type AgentRunManifest,
  type AgentRunRenderProofDiagnostics,
} from '../../agent/run-recorder';
import { checkRuntimeStoryIdentity } from '../../agent-runtimes/change-validation';
import {
  classifyCanvasRuntimeHealth,
  isRuntimeErrorEvidenceText,
  type CanvasRuntimeHealth,
} from '../../agent-runtimes/render-health';
import { runtimeEventLogPath } from '../../agent-runtimes/event-log';
import {
  probeStorybookRender,
  storybookIframeUrlFromCanvasUrl,
  waitForStorybookStoryIndexed,
} from '../../agent-runtimes/storybook-render-probe';
import { probeStaticHtmlRender } from '../../agent-runtimes/static-html-render-probe';
import { capturePngWithChrome, inspectPageWithChrome } from '../../flow-preview-capture';

export const EXTERNAL_RUNTIME_VISUAL_DIFF_THRESHOLD = 0.001;

const EXTERNAL_RUNTIME_CAPTURE_VIEWPORT = { width: 1280, height: 720 };

export interface ExternalRuntimeVisualSnapshot {
  status: 'captured' | 'unavailable';
  bytes: Uint8Array | null;
  path: string | null;
  message: string | null;
}

export async function captureRuntimeVisualSnapshot(input: {
  workspacePath: string;
  agentRun: AgentRunManifest | null;
  canvasUrl: string | null;
  phase: 'before' | 'after';
}): Promise<ExternalRuntimeVisualSnapshot> {
  if (visualEvidenceMode() === 'off') {
    return unavailableRuntimeVisualSnapshot('Visual evidence capture is disabled.');
  }
  if (!input.agentRun) {
    return unavailableRuntimeVisualSnapshot('No agent run manifest was created.');
  }
  if (!input.canvasUrl) {
    return unavailableRuntimeVisualSnapshot('No canvas URL was available for screenshot capture.');
  }
  const screenshotUrl = runtimeTargetCanvasUrl(input.canvasUrl, input.agentRun);
  const chromeDebuggingUrl = process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL;
  if (!chromeDebuggingUrl) {
    return unavailableRuntimeVisualSnapshot(
      'SBER_DESIGNER_CHROME_DEBUGGING_URL is not configured.',
    );
  }
  try {
    const pngBase64 = await capturePngWithChrome({
      chromeDebuggingUrl,
      url: screenshotUrl,
      viewport: EXTERNAL_RUNTIME_CAPTURE_VIEWPORT,
    });
    const bytes = Buffer.from(pngBase64, 'base64');
    const relativePath = join(
      '.sber-designer',
      'runs',
      input.agentRun.runId,
      'screenshots',
      `${input.phase}.png`,
    );
    const absolutePath = resolveInside(input.workspacePath, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes);
    return {
      status: 'captured',
      bytes,
      path: `screenshots/${input.phase}.png`,
      message: null,
    };
  } catch (err) {
    return unavailableRuntimeVisualSnapshot(err instanceof Error ? err.message : String(err));
  }
}

export function visualEvidenceMode(): 'off' | 'optional' | 'required' {
  const raw = process.env.SBER_DESIGNER_VISUAL_EVIDENCE?.trim().toLowerCase();
  if (raw === 'off' || raw === 'required') return raw;
  return 'optional';
}

export async function recordRuntimeRenderHealthSafely(input: {
  workspacePath: string;
  agentRun: AgentRunManifest | null;
  canvasUrl: string | null;
  changedFiles: string[];
  fetchImpl?: typeof fetch;
  readinessDelaysMs?: readonly number[];
}): Promise<CanvasRuntimeHealth> {
  const health = await inspectRuntimeRenderHealth(input);
  if (!input.agentRun || !input.workspacePath) return health;
  await recordToolReceiptSafely({
    workspacePath: input.workspacePath,
    runId: input.agentRun.runId,
    tool: 'runtime_render_health',
    status: health.status === 'failed' ? 'error' : health.status === 'ok' ? 'ok' : 'skipped',
    changedFiles: input.changedFiles,
    summary: health.reason,
    metadata: {
      health,
      canvasUrl: input.canvasUrl,
      ...(runtimeRootProbeMetadata(health)
        ? { runtimeRootProbe: runtimeRootProbeMetadata(health) }
        : {}),
    },
  });
  await recordPreviewRuntimeErrorReceiptSafely({
    workspacePath: input.workspacePath,
    agentRun: input.agentRun,
    changedFiles: input.changedFiles,
    health,
    canvasUrl: input.canvasUrl,
  });
  return health;
}

async function inspectRuntimeRenderHealth(input: {
  workspacePath: string;
  agentRun: AgentRunManifest | null;
  canvasUrl: string | null;
  changedFiles: string[];
  fetchImpl?: typeof fetch;
  readinessDelaysMs?: readonly number[];
}): Promise<CanvasRuntimeHealth> {
  if (!input.agentRun) {
    return { status: 'unavailable', reason: 'No agent run manifest was created.' };
  }
  if (!input.canvasUrl) {
    return { status: 'unavailable', reason: 'No canvas URL was available for render health.' };
  }
  const storyId = input.agentRun.activeScreen?.storyId;
  const renderUrl = runtimeTargetCanvasUrl(input.canvasUrl, input.agentRun);
  const sourceProbe = await runtimeRootSourceProbe(input.workspacePath, input.agentRun);
  if (storyId) {
    const readiness = await waitForStorybookStoryIndexed({
      canvasUrl: input.canvasUrl,
      storyId,
      fetchImpl: input.fetchImpl,
      delaysMs: input.readinessDelaysMs,
    });
    if (readiness.status === 'timeout' || readiness.status === 'unavailable') {
      const changedActiveScreenSource = activeScreenChangedByRuntimeHealthInput(
        input.agentRun.activeScreen,
        input.changedFiles,
      );
      const diskEvidence = changedActiveScreenSource
        ? await previewUnavailableDiskEvidence(input.workspacePath, input.agentRun)
        : null;
      return {
        status: diskEvidence?.status === 'changed' ? 'failed' : 'unavailable',
        reason:
          diskEvidence?.status === 'changed'
            ? diskEvidence.reason
            : changedActiveScreenSource
              ? `Source saved, preview server unavailable${diskEvidence?.status === 'unchanged' ? ' (story file is consistent on disk)' : ''}: ${readiness.reason}`
              : `Storybook story is not ready for render health: ${readiness.reason}`,
        evidenceSource: 'storybook-http',
        weakEvidence: true,
      };
    }
  }
  const chromeDebuggingUrl = process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL;
  if (!chromeDebuggingUrl) {
    return storyId
      ? probeStorybookRender({
          url: renderUrl,
          fetchImpl: input.fetchImpl,
          sourceMarkerFound: sourceProbe.sourceMarkerFound,
          sourcePath: sourceProbe.sourcePath,
          sourceHash: sourceProbe.sourceHash,
          storyId,
        })
      : probeStaticHtmlRender({
          url: renderUrl,
          fetchImpl: input.fetchImpl,
          sourceMarkerFound: sourceProbe.sourceMarkerFound,
          sourcePath: sourceProbe.sourcePath,
          sourceHash: sourceProbe.sourceHash,
        });
  }
  try {
    const inspection = await inspectPageWithChrome({
      chromeDebuggingUrl,
      url: renderUrl,
      viewport: EXTERNAL_RUNTIME_CAPTURE_VIEWPORT,
    });
    return {
      ...classifyCanvasRuntimeHealth({
        ...inspection,
        evidenceJsCapable: true,
        sourceMarkerFound: sourceProbe.sourceMarkerFound,
        sourcePath: sourceProbe.sourcePath,
        sourceHash: sourceProbe.sourceHash,
        storyId,
        domSnapshot: inspection.bodyText,
      }),
      evidenceSource: 'chrome',
    };
  } catch (err) {
    return {
      status: 'unavailable',
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

async function runtimeRootSourceProbe(
  workspacePath: string,
  agentRun: AgentRunManifest,
): Promise<{ sourceMarkerFound: boolean; sourcePath?: string; sourceHash?: string }> {
  const candidates = [
    agentRun.activeScreen?.implementationFilePath,
    agentRun.activeScreen?.filePath,
  ].filter((path): path is string => typeof path === 'string' && path.length > 0);
  for (const sourcePath of candidates) {
    try {
      const resolved = resolveInside(workspacePath, sourcePath);
      const contents = await readFile(resolved, 'utf8');
      const sourceHash = `sha256:${createHash('sha256').update(contents).digest('hex')}`;
      if (/\bdata-sd-screen-root\b/u.test(contents)) {
        return { sourceMarkerFound: true, sourcePath, sourceHash };
      }
    } catch {
      // Missing/unreadable source is represented by sourceMarkerFound=false;
      // render-health evidence remains the authoritative runtime signal.
    }
  }
  return candidates[0]
    ? { sourceMarkerFound: false, sourcePath: candidates[0] }
    : { sourceMarkerFound: false };
}

function runtimeRootProbeMetadata(health: CanvasRuntimeHealth): Record<string, unknown> | null {
  if (
    health.reasonCode !== 'runtime_root_unproven' &&
    health.reasonCode !== 'runtime_root_marker_mismatch' &&
    health.reasonCode !== 'screen_root_missing'
  ) {
    return null;
  }
  return {
    reasonCode: health.reasonCode,
    evidenceJsCapable: health.evidenceJsCapable ?? null,
    sourceMarkerFound: health.sourceMarkerFound ?? null,
    evidenceSource: health.evidenceSource ?? null,
    weakEvidence: health.weakEvidence ?? null,
    ...(health.sourcePath ? { sourcePath: health.sourcePath } : {}),
    ...(health.sourceHash ? { sourceHash: health.sourceHash } : {}),
    ...(health.storyId ? { storyId: health.storyId } : {}),
    ...(health.domSnapshot ? { domSnapshot: health.domSnapshot } : {}),
  };
}

interface PreviewRuntimeErrorEvidence {
  message: string;
  recovered: boolean;
  source: 'event-log' | 'final-render-health';
  timestamp?: string;
  runtime?: string;
  eventType?: string;
  eventName?: string;
  storyId?: string;
  url?: string;
}

async function recordPreviewRuntimeErrorReceiptSafely(input: {
  workspacePath: string;
  agentRun: AgentRunManifest;
  changedFiles: string[];
  health: CanvasRuntimeHealth;
  canvasUrl: string | null;
}): Promise<void> {
  const errors = await collectPreviewRuntimeErrors(input);
  if (errors.length === 0) return;
  const recovered = errors.every((error) => error.recovered);
  const firstMessage = errors[0]?.message ?? 'Preview runtime error.';
  await recordToolReceiptSafely({
    workspacePath: input.workspacePath,
    runId: input.agentRun.runId,
    tool: 'preview_runtime_error',
    status: recovered ? 'ok' : 'error',
    changedFiles: input.changedFiles,
    summary: recovered
      ? `Transient preview runtime error recovered before final render verification: ${firstMessage}`
      : `Preview runtime error remained at final render verification: ${firstMessage}`,
    metadata: {
      recovered,
      errors,
      finalRenderHealth: {
        status: input.health.status,
        reasonCode: input.health.reasonCode ?? null,
        evidenceSource: input.health.evidenceSource ?? null,
        reason: input.health.reason,
      },
      canvasUrl: input.canvasUrl,
    },
  });
}

async function collectPreviewRuntimeErrors(input: {
  workspacePath: string;
  agentRun: AgentRunManifest;
  health: CanvasRuntimeHealth;
}): Promise<PreviewRuntimeErrorEvidence[]> {
  const recovered = input.health.status !== 'failed';
  const fromEvents = await readPreviewRuntimeErrorsFromEventLog({
    workspacePath: input.workspacePath,
    runId: input.agentRun.runId,
    recovered,
  });
  const fromFinalHealth =
    input.health.reasonCode === 'runtime_error' && input.health.errorText
      ? [
          {
            message: input.health.errorText,
            recovered: false,
            source: 'final-render-health' as const,
            ...(input.health.storyId ? { storyId: input.health.storyId } : {}),
          },
        ]
      : [];
  return dedupePreviewRuntimeErrors([...fromEvents, ...fromFinalHealth]);
}

async function readPreviewRuntimeErrorsFromEventLog(input: {
  workspacePath: string;
  runId: string;
  recovered: boolean;
}): Promise<PreviewRuntimeErrorEvidence[]> {
  const path = resolveInside(input.workspacePath, runtimeEventLogPath(input.runId));
  const raw = await readFile(path, 'utf8').catch(() => '');
  if (!raw.trim()) return [];
  const errors: PreviewRuntimeErrorEvidence[] = [];
  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = parseEventLogLine(trimmed);
    const evidence = previewRuntimeErrorFromEventLogEntry(parsed, input.recovered);
    if (evidence) errors.push(evidence);
  }
  return errors;
}

function previewRuntimeErrorFromEventLogEntry(
  entry: Record<string, unknown> | null,
  recovered: boolean,
): PreviewRuntimeErrorEvidence | null {
  if (!entry) return null;
  const event = objectValue(entry.event);
  if (!event) return null;
  const eventType = stringValue(event.type);
  const eventName = stringValue(event.name);
  const data = objectValue(event.data);
  const text = collectStringValues(event).join('\n');
  const previewDiagnostic =
    eventType === 'external-runtime-diagnostic' &&
    /preview|render|storybook|canvas|runtime/iu.test(eventName ?? '');
  const previewText =
    previewDiagnostic || /\b(preview|storybook|canvas|iframe|render)\b/iu.test(text);
  const runtimeErrorMessage =
    stringValue(data?.message) ??
    collectStringValues(data ?? event).find((value) => isRuntimeErrorEvidenceText(value));
  if (!runtimeErrorMessage || !isRuntimeErrorEvidenceText(runtimeErrorMessage)) return null;
  if (!previewText) return null;
  return {
    message: compactPreviewError(runtimeErrorMessage),
    recovered,
    source: 'event-log',
    ...(stringValue(entry.timestamp) ? { timestamp: stringValue(entry.timestamp) as string } : {}),
    ...(stringValue(entry.runtime) ? { runtime: stringValue(entry.runtime) as string } : {}),
    ...(eventType ? { eventType } : {}),
    ...(eventName ? { eventName } : {}),
    ...(stringValue(data?.storyId) ? { storyId: stringValue(data?.storyId) as string } : {}),
    ...(stringValue(data?.url) ? { url: stringValue(data?.url) as string } : {}),
  };
}

function dedupePreviewRuntimeErrors(
  errors: PreviewRuntimeErrorEvidence[],
): PreviewRuntimeErrorEvidence[] {
  const seen = new Set<string>();
  const result: PreviewRuntimeErrorEvidence[] = [];
  for (const error of errors) {
    const key = `${error.source}\n${error.message}\n${error.storyId ?? ''}\n${error.url ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(error);
  }
  return result.slice(0, 10);
}

function parseEventLogLine(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return objectValue(parsed);
  } catch {
    return null;
  }
}

function collectStringValues(value: unknown, output: string[] = []): string[] {
  if (typeof value === 'string') {
    if (value.trim()) output.push(value.trim());
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 30)) collectStringValues(item, output);
    return output;
  }
  if (value && typeof value === 'object') {
    for (const child of Object.values(value).slice(0, 30)) collectStringValues(child, output);
  }
  return output;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function compactPreviewError(value: string): string {
  const compacted = value.replace(/\s+/gu, ' ').trim();
  return compacted.length > 240 ? `${compacted.slice(0, 237)}...` : compacted;
}

function runtimeTargetCanvasUrl(canvasUrl: string, agentRun: AgentRunManifest | null): string {
  const storyId = agentRun?.activeScreen?.storyId ?? null;
  if (!storyId) return canvasUrl;
  return storybookIframeUrlFromCanvasUrl(canvasUrl, storyId) ?? canvasUrl;
}

function activeScreenChangedByRuntimeHealthInput(
  activeScreen: AgentRunManifest['activeScreen'],
  changedFiles: string[],
): boolean {
  if (!activeScreen) return changedFiles.length > 0;
  const targets = new Set(
    [activeScreen.implementationFilePath, activeScreen.filePath].filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    ),
  );
  return changedFiles.some((file) => targets.has(file));
}

async function previewUnavailableDiskEvidence(
  workspacePath: string,
  agentRun: AgentRunManifest,
): Promise<Awaited<ReturnType<typeof checkRuntimeStoryIdentity>> | null> {
  if (!agentRun.activeScreen?.storyId || !agentRun.activeScreen.filePath) return null;
  return checkRuntimeStoryIdentity(workspacePath, agentRun.activeScreen).catch(() => null);
}

export async function readChangedFilesForRun(
  workspacePath: string,
  runId: string,
): Promise<string[]> {
  const receipts = await readAgentRunReceipts(workspacePath, runId).catch(() => []);
  const changed = new Set<string>();
  for (const receipt of receipts) {
    for (const filePath of receipt.changedFiles) {
      changed.add(normalizeWorkspacePath(filePath));
    }
  }
  return [...changed];
}

export async function readComponentReuseSummaryForRun(
  workspacePath: string | null,
  agentRun: AgentRunManifest | null,
): Promise<ComponentReuseRunSummary | null> {
  if (!workspacePath || !agentRun) return null;
  const receipts = await readAgentRunReceipts(workspacePath, agentRun.runId).catch(() => []);
  return summarizeComponentReuseFromReceipts(receipts);
}

export function changedActiveScreenTargets(
  changedFiles: string[],
  agentRun: AgentRunManifest,
): string[] {
  const targets = new Set(
    [agentRun.activeScreen?.implementationFilePath, agentRun.activeScreen?.filePath]
      .filter((path): path is string => typeof path === 'string' && path.length > 0)
      .map(normalizeWorkspacePath),
  );
  return changedFiles.filter((filePath) => targets.has(normalizeWorkspacePath(filePath)));
}

function normalizeWorkspacePath(path: string): string {
  return path.replace(/\\/gu, '/').replace(/^\.\//u, '');
}

export function formatRuntimeRenderHealthFailedNotice(health: CanvasRuntimeHealth): string {
  return [
    '',
    '',
    'sber-designer: Canvas render verification failed.',
    `Reason: ${health.reason}`,
    'Generated source was preserved for repair.',
  ].join('\n');
}

/**
 * R7 (0083): an authoritative run-status verdict that LEADS the appended
 * notices. Render verification runs as a post-check after the agent's final
 * message, so the agent literally cannot know it. This banner is the
 * deterministic source of truth and scopes earlier optimistic render wording to
 * source/design checks until browser evidence exists.
 */
export function formatRunStatusBanner(status: 'needs_review' | 'failed'): string {
  if (status === 'failed') {
    return [
      '',
      '',
      '── Run status: FAILED ──',
      'The run did not pass deterministic finalization. The machine evidence below is authoritative.',
    ].join('\n');
  }
  return [
    '',
    '',
    '── Run status: NEEDS REVIEW ──',
    'The run needs review. The machine evidence below is authoritative.',
  ].join('\n');
}

export function formatRuntimeRenderHealthNeedsReviewNotice(health: CanvasRuntimeHealth): string {
  if (
    health.reasonCode === 'runtime_root_unproven' ||
    health.reasonCode === 'runtime_root_marker_mismatch'
  ) {
    return [
      '',
      '',
      'sber-designer: Screen saved — browser verification pending.',
      `Reason: ${health.reason}`,
      'Source saved, screen renders from available evidence, and the screen was not marked broken. Browser evidence is still needed before treating runtime root proof as final.',
    ].join('\n');
  }
  const reloadHint = isStaticHtmlRenderHealth(health)
    ? 'Reload the static HTML preview, then re-run render verification.'
    : 'Reload or restart Storybook, then re-run render verification.';
  return [
    '',
    '',
    'sber-designer: Canvas render verification needs review.',
    `Reason: ${health.reason}`,
    `Generated source was preserved, but the live canvas was not proven to render. ${reloadHint}`,
  ].join('\n');
}

/**
 * 0108.4.3: render-health notices for the HTML/static profile must be phrased in
 * page terms and never mention Storybook. A static page has no `storyId` and
 * reports `static-html-http` evidence; only Storybook stories reference the
 * Storybook preview.
 */
function isStaticHtmlRenderHealth(health: CanvasRuntimeHealth): boolean {
  if (health.evidenceSource === 'static-html-http') return true;
  if (health.evidenceSource === 'storybook-http' || health.storyId) return false;
  return true;
}

export function renderProofDiagnosticsFromHealth(
  health: CanvasRuntimeHealth,
  canvasUrl: string | null | undefined,
  attempt: number,
): AgentRunRenderProofDiagnostics {
  const evidenceJsCapable = health.evidenceJsCapable === true;
  const canReprobe = Boolean(canvasUrl) && evidenceJsCapable;
  return {
    status:
      health.status === 'ok' ? 'confirmed' : health.status === 'failed' ? 'failed' : 'pending',
    attempt,
    checkedAt: new Date().toISOString(),
    reason: health.reason,
    ...(health.reasonCode ? { reasonCode: health.reasonCode } : {}),
    ...(health.evidenceSource ? { evidenceSource: health.evidenceSource } : {}),
    evidenceJsCapable,
    canReprobe,
    ...(canvasUrl ? { canvasUrl } : {}),
  };
}

export function formatPartialActiveScreenWriteNotice(summary: string): string {
  return [
    '',
    '',
    'sber-designer: Source written, validation unfinished.',
    `Reason: ${summary}`,
    'Generated source was preserved. Continue the run or verify the canvas render before treating this screen as final.',
  ].join('\n');
}

export function unavailableRuntimeVisualSnapshot(message: string): ExternalRuntimeVisualSnapshot {
  return {
    status: 'unavailable',
    bytes: null,
    path: null,
    message,
  };
}
