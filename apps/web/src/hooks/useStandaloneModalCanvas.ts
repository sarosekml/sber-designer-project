import { useEffect, useState, type RefObject } from 'react';

import {
  MODAL_PREVIEW_CHANGED_EVENT,
  readModalPreview,
  setStandaloneModalPreview,
  type ModalPreviewSnapshot,
} from '@/lib/modal-preview';

interface ModalPreviewChangedDetail {
  targetWindow: Window;
  snapshot: ModalPreviewSnapshot;
}

export function useStandaloneModalCanvas(input: {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  enabled: boolean;
  ready: boolean;
  identity: string;
}): ModalPreviewSnapshot | null {
  const [snapshot, setSnapshot] = useState<ModalPreviewSnapshot | null>(null);

  useEffect(() => {
    setSnapshot(null);
  }, [input.identity]);

  useEffect(() => {
    if (!input.enabled || !input.ready) return;
    const targetWindow = input.iframeRef.current?.contentWindow;
    if (!targetWindow) return;
    let cancelled = false;
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<ModalPreviewChangedDetail>).detail;
      if (detail.targetWindow === targetWindow && !cancelled) setSnapshot(detail.snapshot);
    };
    window.addEventListener(MODAL_PREVIEW_CHANGED_EVENT, onChanged);
    void readModalPreview(targetWindow)
      .then((next) => {
        if (!cancelled) setSnapshot(next);
        return setStandaloneModalPreview(targetWindow, true);
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null);
      });
    return () => {
      cancelled = true;
      window.removeEventListener(MODAL_PREVIEW_CHANGED_EVENT, onChanged);
      void setStandaloneModalPreview(targetWindow, false).catch(() => undefined);
    };
  }, [input.enabled, input.identity, input.iframeRef, input.ready]);

  return snapshot;
}
