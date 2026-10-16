import { useEffect, useRef, type RefObject } from 'react';
import type { ProjectFlowEdge } from '@sber-designer/shared-types';

import { bridgeRuntimeEdges, matchClickEdge, matchLinkEdge } from '@/lib/flow-runtime';

interface FlowRuntimeOptions {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  enabled: boolean;
  ready: boolean;
  edges: readonly ProjectFlowEdge[];
  onActivate: (edge: ProjectFlowEdge) => void;
  /**
   * When several edges share one trigger, prefer the edge targeting this
   * screen (the current underlay) so a reused modal's Cancel returns to the
   * screen that opened it (0132, Р-19).
   */
  preferToScreenId?: string | null;
  /** Ask the preview bridge to move initial focus into the modal. */
  focusModal?: boolean;
  /** Receives Escape pressed inside a cross-origin preview iframe. */
  onEscape?: () => void;
}

type FlowRuntimeEvent =
  | { type: 'sber-designer:flow-edge-activated'; edgeId: string }
  | { type: 'sber-designer:flow-runtime-escape' };

/**
 * Wires project Flow transitions into a rendered iframe.
 *
 * Same-origin fallback attaches click listeners directly. Real project
 * previews normally come through /api/preview, so the parent cannot read
 * the iframe DOM; in that path we post a compact runtime config to the
 * injected preview bridge and receive activated edge ids back.
 */
export function useFlowRuntime({
  iframeRef,
  enabled,
  ready,
  edges,
  onActivate,
  preferToScreenId,
  focusModal = false,
  onEscape,
}: FlowRuntimeOptions): void {
  const onActivateRef = useRef(onActivate);
  const onEscapeRef = useRef(onEscape);
  const escapeEnabled = Boolean(onEscape);

  useEffect(() => {
    onActivateRef.current = onActivate;
  }, [onActivate]);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!ready) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    if (!enabled) {
      postBridgeConfig(iframe.contentWindow, [], {});
      return;
    }

    const bridgeEdges = bridgeRuntimeEdges(edges);

    try {
      const doc = iframe.contentDocument;
      if (doc) {
        const onClick = (event: MouseEvent) => {
          const target = event.target instanceof Element ? event.target : null;
          if (!target) return;
          const edge = directEdgeForClick(edges, target, preferToScreenId);
          if (!edge) return;
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          onActivateRef.current(edge);
        };
        doc.addEventListener('click', onClick, true);
        return () => doc.removeEventListener('click', onClick, true);
      }
    } catch {
      // Cross-origin preview: use the injected /api/preview bridge below.
    }

    const targetWindow = iframe.contentWindow;
    if (!targetWindow) return;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== targetWindow) return;
      const data = event.data as Partial<FlowRuntimeEvent> | null;
      if (data?.type === 'sber-designer:flow-runtime-escape') {
        onEscapeRef.current?.();
        return;
      }
      if (data?.type !== 'sber-designer:flow-edge-activated') return;
      const edge = edges.find((item) => item.id === data.edgeId);
      if (edge) onActivateRef.current(edge);
    };

    window.addEventListener('message', onMessage);
    postBridgeConfig(targetWindow, bridgeEdges, {
      ...(preferToScreenId ? { preferToScreenId } : {}),
      closeOnEscape: escapeEnabled,
      focusModal,
    });
    return () => {
      window.removeEventListener('message', onMessage);
      postBridgeConfig(targetWindow, [], {});
    };
  }, [edges, enabled, escapeEnabled, focusModal, iframeRef, preferToScreenId, ready]);
}

function directEdgeForClick(
  edges: readonly ProjectFlowEdge[],
  target: Element,
  preferToScreenId?: string | null,
): ProjectFlowEdge | undefined {
  const anchor = target.closest<HTMLAnchorElement>('a[href]');
  if (anchor) {
    const edge = matchLinkEdge(edges, anchor.getAttribute('href') ?? '', preferToScreenId);
    if (edge) return edge;
  }
  return matchClickEdge(edges, target, preferToScreenId);
}

function postBridgeConfig(
  targetWindow: Window | null,
  edges: ReturnType<typeof bridgeRuntimeEdges>,
  options: {
    preferToScreenId?: string | null;
    closeOnEscape?: boolean;
    focusModal?: boolean;
  },
): void {
  targetWindow?.postMessage(
    {
      type: 'sber-designer:flow-runtime-config',
      edges,
      ...(options.preferToScreenId ? { preferToScreenId: options.preferToScreenId } : {}),
      ...(options.closeOnEscape ? { closeOnEscape: true } : {}),
      ...(options.focusModal ? { focusModal: true } : {}),
    },
    '*',
  );
}
