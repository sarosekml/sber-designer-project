import {
  MODAL_CONTENT_ATTR,
  MODAL_HEIGHT_VAR,
  MODAL_WIDTH_VAR,
  MODAL_WINDOW_MARKER,
  type ModalLongContent,
} from '@sber-designer/shared-types';
import type { CSSProperties } from 'react';

export type ModalPreviewStatus = 'ok' | 'unmanaged' | 'ambiguous';

export interface ModalPreviewValues {
  width: string;
  height: string;
  longContent: ModalLongContent;
}

export interface ModalPreviewSnapshot {
  status: ModalPreviewStatus;
  values?: ModalPreviewValues;
  rect?: { width: number; height: number };
}

interface ModalPreviewResultMessage extends ModalPreviewSnapshot {
  type: 'sber-designer:modal-contract-result';
  requestId: number;
}

export const MODAL_PREVIEW_CHANGED_EVENT = 'sber-designer:modal-preview-changed';

const STANDALONE_STYLE_ID = 'sber-designer-standalone-modal-preview';
const requestSequence = { current: 1 };
const directBaselines = new WeakMap<Window, ModalPreviewValues>();

export async function readModalPreview(targetWindow: Window): Promise<ModalPreviewSnapshot> {
  const direct = directDocument(targetWindow);
  if (direct) return publish(targetWindow, snapshotFromDocument(direct));
  return requestViaBridge(targetWindow, { action: 'read' });
}

export async function previewModalValues(
  targetWindow: Window,
  values: ModalPreviewValues,
): Promise<ModalPreviewSnapshot> {
  const direct = directDocument(targetWindow);
  if (direct) {
    const before = snapshotFromDocument(direct);
    if (before.status === 'ok' && before.values && !directBaselines.has(targetWindow)) {
      directBaselines.set(targetWindow, before.values);
    }
    applyValues(direct, values);
    return publish(targetWindow, snapshotFromDocument(direct));
  }
  return requestViaBridge(targetWindow, { action: 'preview', values });
}

export async function resetModalPreview(targetWindow: Window): Promise<ModalPreviewSnapshot> {
  const direct = directDocument(targetWindow);
  if (direct) {
    const baseline = directBaselines.get(targetWindow);
    if (baseline) applyValues(direct, baseline);
    directBaselines.delete(targetWindow);
    return publish(targetWindow, snapshotFromDocument(direct));
  }
  return requestViaBridge(targetWindow, { action: 'reset' });
}

export async function setStandaloneModalPreview(
  targetWindow: Window,
  enabled: boolean,
): Promise<ModalPreviewSnapshot> {
  const direct = directDocument(targetWindow);
  if (direct) {
    setStandaloneStyle(direct, enabled);
    return snapshotFromDocument(direct);
  }
  return requestViaBridge(targetWindow, { action: 'standalone', enabled }, false);
}

export function modalCanvasFrameStyle(
  snapshot: ModalPreviewSnapshot | null,
): CSSProperties | undefined {
  if (snapshot?.status !== 'ok' || !snapshot.values) return undefined;
  const { values, rect } = snapshot;
  const autoHeight = values.height === 'auto' || values.longContent === 'grow';
  return {
    width: values.width || (rect ? `${Math.ceil(rect.width)}px` : '640px'),
    height: autoHeight
      ? `${Math.max(1, Math.ceil(rect?.height ?? 1))}px`
      : values.height || `${Math.max(1, Math.ceil(rect?.height ?? 1))}px`,
    maxWidth: '100%',
    maxHeight: '100%',
  };
}

function directDocument(targetWindow: Window): Document | null {
  try {
    return targetWindow.document ?? null;
  } catch {
    return null;
  }
}

function snapshotFromDocument(doc: Document): ModalPreviewSnapshot {
  const nodes = doc.querySelectorAll<HTMLElement>(`[${MODAL_WINDOW_MARKER}]`);
  if (nodes.length === 0) return { status: 'unmanaged' };
  if (nodes.length > 1) return { status: 'ambiguous' };
  const element = nodes[0]!;
  const rect = element.getBoundingClientRect();
  return {
    status: 'ok',
    values: {
      width: element.style.getPropertyValue(MODAL_WIDTH_VAR).trim(),
      height: element.style.getPropertyValue(MODAL_HEIGHT_VAR).trim(),
      longContent: element.getAttribute(MODAL_CONTENT_ATTR) === 'grow' ? 'grow' : 'scroll',
    },
    rect: { width: rect.width, height: rect.height },
  };
}

function applyValues(doc: Document, values: ModalPreviewValues): void {
  const nodes = doc.querySelectorAll<HTMLElement>(`[${MODAL_WINDOW_MARKER}]`);
  if (nodes.length !== 1) return;
  const element = nodes[0]!;
  element.style.setProperty(MODAL_WIDTH_VAR, values.width);
  element.style.setProperty(MODAL_HEIGHT_VAR, values.height);
  element.setAttribute(MODAL_CONTENT_ATTR, values.longContent);
}

function setStandaloneStyle(doc: Document, enabled: boolean): void {
  doc.getElementById(STANDALONE_STYLE_ID)?.remove();
  if (!enabled) return;
  const style = doc.createElement('style');
  style.id = STANDALONE_STYLE_ID;
  style.textContent = standaloneModalCss();
  doc.head.append(style);
}

function standaloneModalCss(): string {
  return `
html, body {
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
  overflow: hidden !important;
  background: transparent !important;
}
[data-sd-modal-backdrop] {
  position: relative !important;
  inset: auto !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  background: transparent !important;
}
[data-sd-modal-window] {
  width: 100% !important;
  max-width: none !important;
}
[data-sd-modal-window][data-sd-modal-content="scroll"] {
  height: 100% !important;
  max-height: none !important;
}
[data-sd-modal-window][data-sd-modal-content="grow"] {
  max-height: none !important;
}
`;
}

async function requestViaBridge(
  targetWindow: Window,
  payload:
    | { action: 'read' | 'reset' }
    | { action: 'preview'; values: ModalPreviewValues }
    | { action: 'standalone'; enabled: boolean },
  publishResult = true,
): Promise<ModalPreviewSnapshot> {
  const requestId = requestSequence.current++;
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('The modal preview bridge did not respond.'));
    }, 2_000);
    const onMessage = (event: MessageEvent) => {
      if (event.source !== targetWindow) return;
      const data = event.data as Partial<ModalPreviewResultMessage> | null;
      if (
        data?.type !== 'sber-designer:modal-contract-result' ||
        data.requestId !== requestId ||
        (data.status !== 'ok' && data.status !== 'unmanaged' && data.status !== 'ambiguous')
      ) {
        return;
      }
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      const snapshot = {
        status: data.status,
        ...(data.values ? { values: data.values } : {}),
        ...(data.rect ? { rect: data.rect } : {}),
      } satisfies ModalPreviewSnapshot;
      resolve(publishResult ? publish(targetWindow, snapshot) : snapshot);
    };
    window.addEventListener('message', onMessage);
    targetWindow.postMessage({ type: 'sber-designer:modal-contract', requestId, ...payload }, '*');
  });
}

function publish(targetWindow: Window, snapshot: ModalPreviewSnapshot): ModalPreviewSnapshot {
  window.dispatchEvent(
    new CustomEvent(MODAL_PREVIEW_CHANGED_EVENT, {
      detail: { targetWindow, snapshot },
    }),
  );
  return snapshot;
}
