import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  screenSurface,
  type ProjectFlowEdge,
  type ProjectScreen,
} from '@sber-designer/shared-types';

import { useFlowRuntime } from '@/hooks/useFlowRuntime';
import { resolveOverlayEdgeActivation, type OverlayAction } from '@/lib/overlay-runtime';
import { cn } from '@/lib/utils';

/**
 * Honest overlay presentation shared by the three players (0132.2, Р-4/Р-6/Р-18).
 *
 * A `modal` target renders as a full-viewport transparent iframe: the page's
 * own scrim and centered dialog show, and the still-live underlay shows through.
 * The overlay iframe is wired to its own flow runtime, so Cancel/Save inside the
 * modal work and resolve underlay-aware (Р-19). A non-modal overlay target keeps
 * the legacy windowed box so existing overlay edges behave as before.
 */
export function FlowOverlay({
  overlayScreen,
  overlayUrl,
  underlayScreenId,
  screens,
  flow,
  onClose,
  onAction,
  className,
}: {
  overlayScreen: ProjectScreen;
  overlayUrl: string;
  underlayScreenId: string | null;
  screens: readonly ProjectScreen[];
  flow: readonly ProjectFlowEdge[];
  onClose: () => void;
  onAction: (action: OverlayAction) => void;
  className?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [ready, setReady] = useState(false);
  const isModal = screenSurface(overlayScreen) === 'modal';

  const outgoingEdges = useMemo(
    () => flow.filter((edge) => edge.fromScreenId === overlayScreen.id),
    [flow, overlayScreen.id],
  );

  // Keep activation inputs in a ref so the runtime/on-mount effects don't
  // re-fire (and re-trigger on-mount edges) when the parent re-renders.
  const activateRef = useRef<(edge: ProjectFlowEdge) => void>(() => {});
  activateRef.current = (edge) =>
    onAction(resolveOverlayEdgeActivation(edge, screens, underlayScreenId));

  useFlowRuntime({
    iframeRef,
    enabled: true,
    ready,
    edges: outgoingEdges,
    onActivate: (edge) => activateRef.current(edge),
    preferToScreenId: underlayScreenId,
    focusModal: isModal,
    onEscape: onClose,
  });

  // on-mount edge from the modal fires once per overlay entry.
  useEffect(() => {
    const onMount = outgoingEdges.find((edge) => edge.trigger.kind === 'on-mount');
    if (!onMount) return undefined;
    const timer = window.setTimeout(() => activateRef.current(onMount), 50);
    return () => window.clearTimeout(timer);
  }, [outgoingEdges]);

  // Reset ready state when the overlay target changes (replace, no stack).
  useEffect(() => {
    setReady(false);
  }, [overlayUrl]);

  // Esc closes — both from the parent window and, same-origin, from inside the
  // focused iframe (Р-18/риск №19). Focus moves into the dialog on open and is
  // restored to the trigger on close.
  useEffect(() => {
    triggerRef.current = document.activeElement;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const trigger = triggerRef.current;
      if (trigger instanceof HTMLElement) trigger.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    // Move focus into the dialog so keyboard/Esc land inside it.
    iframe.focus({ preventScroll: true });
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      const onKey = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        onCloseRef.current();
      };
      doc.addEventListener('keydown', onKey);
      const firstFocusable = doc.querySelector<HTMLElement>(
        '[data-sd-modal-window] button, [data-sd-modal-window] [href], [data-sd-modal-window] input, [data-sd-modal-window] select, [data-sd-modal-window] textarea, [data-sd-modal-window] [tabindex]:not([tabindex="-1"])',
      );
      firstFocusable?.focus({ preventScroll: true });
      return () => doc.removeEventListener('keydown', onKey);
    } catch {
      // Cross-origin focus + Escape are handled by the injected preview bridge.
    }
  }, [ready]);

  if (isModal) {
    return (
      <div className={cn('absolute inset-0', className)}>
        <iframe
          ref={iframeRef}
          key={overlayUrl}
          title={`modal: ${overlayScreen.name}`}
          src={overlayUrl}
          sandbox="allow-scripts allow-same-origin allow-forms"
          className="absolute inset-0 h-full w-full border-0 bg-transparent"
          onLoad={() => setReady(true)}
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card/95 px-2 py-1 text-xs text-muted-foreground shadow-lg backdrop-blur hover:text-foreground"
          title="Close (Esc)"
          aria-label={`Close ${overlayScreen.name}`}
        >
          <X className="size-3" />
          Close
        </button>
      </div>
    );
  }

  // Legacy windowed fallback for non-modal overlay targets.
  return (
    <div
      className={cn('absolute inset-0 flex items-center justify-center bg-black/55 p-6', className)}
    >
      <div className="flex h-[min(82%,720px)] w-[min(92%,960px)] flex-col overflow-hidden rounded-lg border border-border bg-white shadow-2xl">
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-card px-3 text-xs text-foreground">
          <span className="truncate font-medium">{overlayScreen.name}</span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Close overlay (Esc)"
          >
            <X className="size-3" />
            Close
          </button>
        </div>
        <iframe
          ref={iframeRef}
          key={overlayUrl}
          title={`overlay: ${overlayScreen.name}`}
          src={overlayUrl}
          sandbox="allow-scripts allow-same-origin allow-forms"
          className="min-h-0 flex-1 border-0 bg-white"
          onLoad={() => setReady(true)}
        />
      </div>
    </div>
  );
}
