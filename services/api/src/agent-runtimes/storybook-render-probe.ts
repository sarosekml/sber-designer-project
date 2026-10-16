import { classifyCanvasRuntimeHealth, type CanvasRuntimeHealth } from './render-health';

export interface StorybookRenderProbeInput {
  url: string;
  fetchImpl?: typeof fetch | undefined;
  sourceMarkerFound?: boolean | undefined;
  sourcePath?: string | undefined;
  sourceHash?: string | undefined;
  storyId?: string | undefined;
}

export interface StorybookStoryReadinessInput {
  canvasUrl: string;
  storyId: string;
  fetchImpl?: typeof fetch | undefined;
  delaysMs?: readonly number[] | undefined;
}

export type StorybookStoryReadinessStatus = 'indexed' | 'timeout' | 'unavailable' | 'not-storybook';

export interface StorybookStoryReadinessResult {
  status: StorybookStoryReadinessStatus;
  reason: string;
  indexUrl?: string;
}

export const STORYBOOK_STORY_READINESS_DELAYS_MS = [
  0, 500, 1_000, 2_000, 3_000, 5_000, 8_000,
] as const;

export async function probeStorybookRender(
  input: StorybookRenderProbeInput,
): Promise<CanvasRuntimeHealth> {
  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(input.url);
  } catch (err) {
    return {
      status: 'unavailable',
      evidenceSource: 'storybook-http',
      weakEvidence: true,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
  if (!response.ok) {
    return {
      status: 'unavailable',
      evidenceSource: 'storybook-http',
      weakEvidence: true,
      httpStatus: response.status,
      reasonCode: 'preview_unavailable',
      reason: `Storybook preview returned HTTP ${response.status}; static HTTP fallback cannot prove a runtime failure before Storybook is ready.`,
    };
  }
  const html = await response.text();
  return withHttpFallbackLimitation(
    classifyCanvasRuntimeHealth({
      rootFound: /\bdata-sd-screen-root\b/u.test(html),
      bodyText: stripHtml(html),
      consoleErrors: [],
      evidenceJsCapable: false,
      sourceMarkerFound: input.sourceMarkerFound,
      sourcePath: input.sourcePath,
      sourceHash: input.sourceHash,
      storyId: input.storyId,
    }),
  );
}

export async function waitForStorybookStoryIndexed(
  input: StorybookStoryReadinessInput,
): Promise<StorybookStoryReadinessResult> {
  const indexUrl = storybookIndexUrlFromCanvasUrl(input.canvasUrl);
  if (!indexUrl) {
    return {
      status: 'not-storybook',
      reason: 'Canvas URL does not look like a Storybook iframe URL.',
    };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const delays = input.delaysMs ?? STORYBOOK_STORY_READINESS_DELAYS_MS;
  let lastReason = 'Storybook story is not present in index.json.';

  for (const delayMs of delays) {
    if (delayMs > 0) await sleep(delayMs);
    try {
      const url = withCacheBust(indexUrl);
      const response = await fetchImpl(url);
      if (!response.ok) {
        const body = response.status >= 500 ? await response.text().catch(() => '') : '';
        lastReason = describeStorybookIndexError(response.status, body);
        continue;
      }
      const raw = (await response.json()) as unknown;
      if (storybookIndexHasStory(raw, input.storyId)) {
        return {
          status: 'indexed',
          reason: `Storybook story ${input.storyId} is indexed.`,
          indexUrl,
        };
      }
    } catch (err) {
      lastReason = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    status: 'timeout',
    reason: `${lastReason} Waited for Storybook story ${input.storyId}.`,
    indexUrl,
  };
}

/**
 * Turn a Storybook `index.json` HTTP error into an actionable reason. A 500 with
 * `Unable to index … ENOENT` means a story file was renamed/moved but Storybook's
 * cache still references the old path, which fails the whole index (task 9999
 * LIVE-1). Naming the file + the restart hint beats a bare "HTTP 500".
 */
export function describeStorybookIndexError(status: number, body: string): string {
  const missing = /Unable to index\s+(.+?):/iu.exec(body);
  if (missing?.[1] && /ENOENT|no such file/iu.test(body)) {
    return `Storybook index build failed: ${missing[1].trim()} is missing — likely a stale Storybook cache after a rename. Restart Storybook (clears node_modules/.cache/storybook) and re-run.`;
  }
  return `Storybook index returned HTTP ${status}.`;
}

function withHttpFallbackLimitation(health: CanvasRuntimeHealth): CanvasRuntimeHealth {
  const withEvidence: CanvasRuntimeHealth = {
    ...health,
    evidenceSource: 'storybook-http',
    weakEvidence: health.weakEvidence ?? health.status !== 'failed',
  };
  if (
    health.status === 'failed' ||
    health.status === 'ok' ||
    health.reasonCode === 'runtime_root_unproven' ||
    health.reasonCode === 'runtime_root_marker_mismatch'
  ) {
    return withEvidence;
  }
  return {
    ...withEvidence,
    reasonCode: 'browser_evidence_unavailable',
    reason:
      'Browser render evidence is unavailable: HTTP Storybook fallback returned static iframe HTML and cannot execute preview JavaScript. Configure SBER_DESIGNER_CHROME_DEBUGGING_URL for repair-grade render evidence.',
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function storybookIndexUrlFromCanvasUrl(canvasUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(canvasUrl);
  } catch {
    return null;
  }
  const iframeSegment = '/iframe.html';
  const basePath = parsed.pathname.endsWith(iframeSegment)
    ? parsed.pathname.slice(0, -iframeSegment.length).replace(/\/+$/u, '')
    : parsed.pathname.replace(/\/+$/u, '');
  parsed.pathname = `${basePath}/index.json`;
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

export function storybookIframeUrlFromCanvasUrl(
  canvasUrl: string,
  storyId: string | null | undefined,
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(canvasUrl);
  } catch {
    return null;
  }
  const iframeSegment = '/iframe.html';
  if (!parsed.pathname.endsWith(iframeSegment)) {
    const basePath = parsed.pathname.replace(/\/+$/u, '');
    parsed.pathname = `${basePath}/iframe.html`;
  }
  if (storyId) {
    parsed.searchParams.set('id', storyId);
    if (!parsed.searchParams.has('viewMode')) parsed.searchParams.set('viewMode', 'story');
    if (!parsed.searchParams.has('shortcuts')) parsed.searchParams.set('shortcuts', 'false');
    if (!parsed.searchParams.has('singleStory')) parsed.searchParams.set('singleStory', 'true');
  }
  parsed.hash = '';
  return parsed.toString();
}

function storybookIndexHasStory(raw: unknown, storyId: string): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const entries = (raw as { entries?: unknown }).entries;
  if (!entries || typeof entries !== 'object') return false;
  const direct = (entries as Record<string, unknown>)[storyId];
  if (direct && typeof direct === 'object') {
    const type = (direct as { type?: unknown }).type;
    if (type === undefined || type === 'story') return true;
  }
  return Object.values(entries as Record<string, unknown>).some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const candidate = entry as { id?: unknown; type?: unknown };
    return candidate.id === storyId && (candidate.type === undefined || candidate.type === 'story');
  });
}

function withCacheBust(indexUrl: string): string {
  const parsed = new URL(indexUrl);
  parsed.searchParams.set('refresh', '1');
  parsed.searchParams.set('_sd', Date.now().toString(36));
  return parsed.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
