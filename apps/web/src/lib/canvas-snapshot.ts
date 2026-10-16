/**
 * Client half of the Mark-layer snapshot bridge (0127).
 *
 * The canvas iframe is served through the /api/preview proxy, which injects a
 * `sber-designer:snapshot` handler (services/api/src/routes/preview.ts). This
 * module requests a viewport screenshot over postMessage and composites the
 * Mark scene on top, so the assistant sees exactly what the user marked.
 */
import { paintMarkScene, type MarkScene } from './canvas-mark';

export interface CanvasSnapshot {
  dataUrl: string;
  w: number;
  h: number;
}

let nextSnapshotRequestId = 1;

export function requestCanvasSnapshot(
  iframe: HTMLIFrameElement,
  timeoutMs = 8000,
): Promise<CanvasSnapshot | null> {
  const target = iframe.contentWindow;
  if (!target) return Promise.resolve(null);
  const requestId = nextSnapshotRequestId++;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (snapshot: CanvasSnapshot | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timer);
      resolve(snapshot);
    };
    function onMessage(event: MessageEvent) {
      if (event.source !== target) return;
      const data = event.data as {
        type?: string;
        requestId?: number;
        dataUrl?: string;
        w?: number;
        h?: number;
        error?: string;
      } | null;
      if (!data || data.type !== 'sber-designer:snapshot-result') return;
      if (data.requestId !== requestId) return;
      if (data.dataUrl && data.w && data.h) {
        finish({ dataUrl: data.dataUrl, w: data.w, h: data.h });
      } else {
        finish(null);
      }
    }
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    window.addEventListener('message', onMessage);
    try {
      target.postMessage({ type: 'sber-designer:snapshot', requestId }, '*');
    } catch {
      finish(null);
    }
  });
}

/** Retry with growing timeouts — the sandbox page may still be settling. */
export async function requestCanvasSnapshotWithRetry(
  iframe: HTMLIFrameElement,
): Promise<CanvasSnapshot | null> {
  for (const timeout of [2000, 4000, 8000]) {
    const snapshot = await requestCanvasSnapshot(iframe, timeout);
    if (snapshot) return snapshot;
  }
  return null;
}

/**
 * Forward a wheel delta into the canvas page so the user can scroll the
 * screen underneath while the Mark layer covers it. Direct same-origin
 * scroll first; the injected bridge handles the cross-origin dev setup.
 */
export function scrollCanvasBy(iframe: HTMLIFrameElement, left: number, top: number): void {
  const win = iframe.contentWindow;
  if (!win) return;
  try {
    win.scrollBy({ left, top, behavior: 'auto' });
    return;
  } catch {
    // Cross-origin frame: fall through to the postMessage bridge.
  }
  try {
    win.postMessage({ type: 'sber-designer:scroll-by', left, top }, '*');
  } catch {
    // No bridge either — scrolling is unavailable, not fatal.
  }
}

/**
 * Paint the captured screenshot plus the mark scene into one PNG data URL.
 * An opaque white base keeps transparent captures readable in the transcript.
 */
export async function compositeMarkScreenshot(
  snapshot: CanvasSnapshot,
  scene: MarkScene,
  frameSize: { width: number; height: number },
): Promise<string | null> {
  const background = await loadImage(snapshot.dataUrl);
  if (!background) return null;
  const out = document.createElement('canvas');
  out.width = snapshot.w;
  out.height = snapshot.h;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(background, 0, 0, snapshot.w, snapshot.h);
  const strokeScale = frameSize.width > 0 ? snapshot.w / frameSize.width : 1;
  paintMarkScene(ctx, scene, snapshot.w, snapshot.h, { strokeScale: Math.max(1, strokeScale) });
  try {
    return out.toDataURL('image/png');
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
