/**
 * Project cover capture (0135).
 *
 * open-design renders the actual project as its card cover. sber-designer's
 * non-active projects have no running sandbox, so instead of a live iframe we
 * rasterize a screen while the project IS open and store one small image with
 * the project.
 *
 * What gets captured is the screen the agent just generated — not the project's
 * first page — so the Home cover always shows the freshest work. A screen pinned
 * through "Set as thumbnail" wins instead, and then only that screen refreshes
 * the cover.
 *
 * The capture is entirely programmatic (offscreen iframe + the 0127 snapshot
 * bridge + a canvas downscale). No LLM is involved.
 */
import type { ProjectScreen } from '@sber-designer/shared-types';

import { setProjectCoverScreen, updateProjectCover } from '@/lib/api-client';
import { requestCanvasSnapshotWithRetry } from '@/lib/canvas-snapshot';
import { screenPreviewUrl } from '@/lib/screen-url';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';
import { useThemeStore } from '@/stores/theme-store';

/** Desktop viewport the offscreen frame renders at before downscaling. */
const CAPTURE_VIEWPORT = { width: 1280, height: 800 };
/** Stored cover size — 16:9 to match the Home card crop. Kept small on purpose:
 *  the cover is committed with the project, so ~640px WebP is the budget. */
const COVER_SIZE = { width: 640, height: 360 };
const COVER_QUALITY = 0.72;
/** Let the just-generated screen settle (HMR reload, fonts) before rasterizing. */
const SETTLE_DELAY_MS = 1200;
const FRAME_LOAD_TIMEOUT_MS = 8000;

interface CoverCaptureRequest {
  projectId: string;
  screenId: string;
}

/**
 * Run one cover capture at a time while coalescing a burst to the newest
 * pending request. The previous `if (inFlight) return` guard silently dropped
 * the second completed run (and pin captures), leaving an older cover behind.
 */
export function createLatestProjectCoverCaptureRunner<T>(
  worker: (input: T) => Promise<void>,
): (input: T) => Promise<void> {
  let pending: { input: T } | null = null;
  let running = false;
  let completion = Promise.resolve();

  const drain = async () => {
    while (pending) {
      const current = pending.input;
      pending = null;
      try {
        await worker(current);
      } catch {
        // Cover capture is best-effort. A failed item must not strand the newest
        // request that arrived while it was running.
      }
    }
    // There is no await between the final pending check and this assignment,
    // so a later enqueue observes `running = false` and starts a fresh drain.
    running = false;
  };

  return (input) => {
    pending = { input };
    if (!running) {
      running = true;
      completion = drain();
    }
    return completion;
  };
}

const enqueueProjectCoverCapture = createLatestProjectCoverCaptureRunner(
  performProjectCoverCapture,
);

/**
 * Refresh the project cover after a successful generation run.
 *
 * `screenId` is the run's target screen. With a pinned cover screen the call is
 * ignored unless the pinned screen is the one that changed.
 */
export function captureCoverAfterRun(screenId: string | null | undefined): void {
  if (!screenId) return;
  const { projectId, coverScreenId } = useEditorStore.getState();
  if (!projectId) return;
  // Pinned cover: only the pinned screen refreshes it, so the cover stops
  // following every new generation.
  if (coverScreenId && coverScreenId !== screenId) return;

  void captureProjectCover({ projectId, screenId });
}

/**
 * Pin (or unpin) the screen the cover is captured from. Pinning captures that
 * screen right away so the choice takes effect without waiting for a run;
 * unpinning returns to "follow the latest generated screen".
 */
export async function toggleCoverScreenPin(screenId: string, pinned: boolean): Promise<void> {
  if (!useThemeStore.getState().generativeThumbnailEnabled) return;
  const { projectId, coverScreenId: previousCoverScreenId } = useEditorStore.getState();
  if (!projectId) return;
  const nextScreenId = pinned ? screenId : null;
  useEditorStore.getState().setCoverScreenId(nextScreenId);
  try {
    await setProjectCoverScreen(projectId, nextScreenId);
  } catch {
    // Roll back only if a newer pin action has not already replaced this
    // optimistic value.
    if (useEditorStore.getState().coverScreenId === nextScreenId) {
      useEditorStore.getState().setCoverScreenId(previousCoverScreenId);
    }
    return;
  }
  if (pinned) await captureProjectCover({ projectId, screenId });
}

/**
 * A deleted screen must not leave an orphan pin that suppresses every future
 * automatic cover update. Keep the local runtime unblocked even if the
 * best-effort registry cleanup fails; the projects API also heals stale pins on
 * the next open.
 */
export async function clearCoverScreenPinForDeletedScreen(screenId: string): Promise<void> {
  const { projectId, coverScreenId } = useEditorStore.getState();
  if (!projectId || coverScreenId !== screenId) return;
  useEditorStore.getState().setCoverScreenId(null);
  await setProjectCoverScreen(projectId, null).catch(() => undefined);
}

function captureProjectCover(input: CoverCaptureRequest): Promise<void> {
  if (!useThemeStore.getState().generativeThumbnailEnabled) return Promise.resolve();
  return enqueueProjectCoverCapture(input);
}

async function performProjectCoverCapture(input: CoverCaptureRequest): Promise<void> {
  if (!useThemeStore.getState().generativeThumbnailEnabled) return;
  if (useEditorStore.getState().projectId !== input.projectId) return;
  const screen = findScreen(input.screenId);
  if (!screen) return;
  const previewUrl = useSandboxStore.getState().session?.previewUrl;
  if (!previewUrl) return;

  const fallbackCanvasUrl = useEditorStore.getState().canvasUrl;
  const url = screenPreviewUrl(screen, previewUrl, fallbackCanvasUrl);
  const dataUrl = await captureCoverImage(url);
  if (!dataUrl || !captureStillAllowed(input)) return;
  await updateProjectCover(input.projectId, { dataUrl, screenId: input.screenId });
}

function captureStillAllowed(input: CoverCaptureRequest): boolean {
  if (!useThemeStore.getState().generativeThumbnailEnabled) return false;
  const { projectId, coverScreenId } = useEditorStore.getState();
  // Navigation, deletion or a newer pin makes the in-flight image stale. Do
  // not upload it into the previous project or over the newly chosen source.
  return (
    projectId === input.projectId &&
    Boolean(findScreen(input.screenId)) &&
    (!coverScreenId || coverScreenId === input.screenId)
  );
}

function findScreen(screenId: string): ProjectScreen | null {
  const project = useProjectStore.getState().project;
  return project?.screens.find((screen) => screen.id === screenId) ?? null;
}

async function captureCoverImage(url: string): Promise<string | null> {
  if (typeof document === 'undefined') return null;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${CAPTURE_VIEWPORT.width}px`,
    height: `${CAPTURE_VIEWPORT.height}px`,
    border: '0',
    opacity: '0',
    pointerEvents: 'none',
  } satisfies Partial<CSSStyleDeclaration>);

  const loaded = new Promise<void>((resolve) => {
    iframe.addEventListener('load', () => resolve(), { once: true });
  });
  iframe.src = url;
  document.body.appendChild(iframe);

  try {
    await Promise.race([loaded, delay(FRAME_LOAD_TIMEOUT_MS)]);
    await delay(SETTLE_DELAY_MS);
    const snapshot = await requestCanvasSnapshotWithRetry(iframe);
    if (!snapshot?.dataUrl) return null;
    return await downscaleToCover(snapshot.dataUrl);
  } finally {
    iframe.remove();
  }
}

/**
 * Shrink the full-viewport snapshot to the stored cover size, cropping to the
 * card's 16:9 from the top (where a screen's header/hero lives) and encoding as
 * WebP so the committed file stays tens of kilobytes.
 */
export async function downscaleToCover(dataUrl: string): Promise<string | null> {
  const image = await loadImage(dataUrl);
  if (!image) return null;
  const canvas = document.createElement('canvas');
  canvas.width = COVER_SIZE.width;
  canvas.height = COVER_SIZE.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const scale = Math.max(COVER_SIZE.width / image.width, COVER_SIZE.height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Horizontally centered, top-aligned: keeps the top of the page in frame.
  ctx.drawImage(image, (COVER_SIZE.width - drawWidth) / 2, 0, drawWidth, drawHeight);

  try {
    const webp = canvas.toDataURL('image/webp', COVER_QUALITY);
    if (webp.startsWith('data:image/webp')) return webp;
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
