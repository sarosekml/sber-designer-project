import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, MessageSquarePlus } from 'lucide-react';
import type { ProjectFlowEdge, ProjectScreen } from '@sber-designer/shared-types';

import { Button } from '@/components/ui/button';
import { useActiveScreenUrl } from '@/hooks/useActiveScreenUrl';
import { useFlowRuntime } from '@/hooks/useFlowRuntime';
import { useOverlayUnderlayLifecycle } from '@/hooks/useOverlayUnderlayLifecycle';
import { resolveBaseEdgeActivation, type OverlayAction } from '@/lib/overlay-runtime';
import { commentsForScreen } from '@/lib/project-comments';
import { screenPreviewUrl } from '@/lib/screen-url';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';
import { DemoCommentsLayer } from './DemoCommentsLayer';
import { FlowOverlay } from './FlowOverlay';

// Stable empty-array references — see useActiveScreenUrl.ts for why.
const EMPTY_SCREENS: readonly ProjectScreen[] = Object.freeze([]);
const EMPTY_FLOW: readonly ProjectFlowEdge[] = Object.freeze([]);

/**
 * Full-screen prototype runner (Phase 5.3).
 *
 * - Loads the active screen in an iframe (uses the same useActiveScreenUrl
 *   hook as the editor canvas — so Demo and Edit share the previewUrl).
 * - Wires `click` / `link` flow triggers: any click inside the iframe
 *   that matches a `from === activeScreenId` edge selector switches
 *   activeScreenId to the edge's target. The shell renders a fresh
 *   iframe.
 * - `on-mount` edges fire on every screen entry (useful for splash →
 *   home auto-redirects).
 * - Esc exits Demo back to Edit. Shared editor chrome owns the visible
 *   Edit / Flow / Demo navigation and the Screens panel provides fallback
 *   manual navigation.
 */
export function DemoCanvas() {
  const url = useActiveScreenUrl();
  const setView = useEditorStore((s) => s.setView);
  const setActiveScreenId = useEditorStore((s) => s.setActiveScreenId);
  const activeScreenId = useEditorStore((s) => s.activeScreenId);
  const fallbackCanvasUrl = useEditorStore((s) => s.canvasUrl);
  const project = useProjectStore((s) => s.project);
  const screens = project?.screens ?? EMPTY_SCREENS;
  const flow = project?.flow ?? EMPTY_FLOW;
  const session = useSandboxStore((s) => s.session);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [overlayScreenId, setOverlayScreenId] = useState<string | null>(null);
  const [commentsVisible, setCommentsVisible] = useState(true);
  const [addingComment, setAddingComment] = useState(false);

  const activeScreen = screens.find((s) => s.id === activeScreenId);
  const overlayScreen = screens.find((s) => s.id === overlayScreenId) ?? null;
  const overlayUrl = screenPreviewUrl(overlayScreen, session?.previewUrl, fallbackCanvasUrl);
  const outgoingEdges = useMemo(
    () => flow.filter((e) => e.fromScreenId === activeScreenId),
    [activeScreenId, flow],
  );
  const openCommentsCount = useMemo(
    () => (project ? commentsForScreen(project, activeScreenId).length : 0),
    [activeScreenId, project],
  );

  const activateEdge = useCallback(
    (edge: ProjectFlowEdge) => {
      const action = resolveBaseEdgeActivation(edge, screens);
      if (action.kind === 'open-overlay') {
        setOverlayScreenId(action.screenId);
        return;
      }
      setOverlayScreenId(null);
      setActiveScreenId(action.screenId);
    },
    [screens, setActiveScreenId],
  );

  const handleOverlayAction = useCallback(
    (action: OverlayAction) => {
      switch (action.kind) {
        case 'close-overlay':
          setOverlayScreenId(null);
          return;
        case 'open-overlay':
        case 'replace-overlay':
          setOverlayScreenId(action.screenId);
          return;
        case 'navigate':
        case 'navigate-and-close':
          setOverlayScreenId(null);
          setActiveScreenId(action.screenId);
          return;
      }
    },
    [setActiveScreenId],
  );

  // Esc → exit demo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (addingComment) {
          setAddingComment(false);
        } else if (overlayScreenId) {
          setOverlayScreenId(null);
        } else {
          setView('edit');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addingComment, overlayScreenId, setView]);

  // on-mount edges: fire once per screen entry.
  useEffect(() => {
    const onMount = outgoingEdges.find((e) => e.trigger.kind === 'on-mount');
    if (onMount) {
      const t = window.setTimeout(() => activateEdge(onMount), 50);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [activeScreenId, activateEdge, outgoingEdges]);

  useEffect(() => {
    setIframeReady(false);
  }, [url]);

  useEffect(() => {
    setAddingComment(false);
  }, [activeScreenId]);

  useFlowRuntime({
    iframeRef,
    // Pause the underlay runtime while a modal overlay is open (риск №3).
    enabled: Boolean(activeScreen) && !overlayScreenId,
    ready: iframeReady,
    edges: outgoingEdges,
    onActivate: activateEdge,
  });
  useOverlayUnderlayLifecycle(activeScreenId, overlayScreenId, () => setOverlayScreenId(null));

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-black">
      <div className="relative min-h-0 flex-1 bg-white">
        {activeScreen ? (
          <>
            <iframe
              ref={iframeRef}
              key={url}
              title="demo"
              src={url}
              sandbox="allow-scripts allow-same-origin allow-forms"
              className="h-full w-full border-0"
              inert={overlayScreen ? true : undefined}
              onLoad={() => setIframeReady(true)}
            />
            {/* While a modal overlay is open, hide the base comments layer and
                toolbar so they never sit above the modal (риск №3). */}
            {!overlayScreen && (
              <DemoCommentsLayer
                screenId={activeScreenId}
                visible={commentsVisible}
                addMode={addingComment}
                onAddModeChange={setAddingComment}
              />
            )}
            <div
              className={cn(
                'absolute bottom-3 right-3 z-30 flex items-center gap-2 rounded-md border border-border bg-card/95 p-1 shadow-lg backdrop-blur',
                overlayScreen && 'hidden',
              )}
            >
              <Button
                type="button"
                size="sm"
                variant={commentsVisible ? 'secondary' : 'ghost'}
                onClick={() => {
                  setAddingComment(false);
                  setCommentsVisible((current) => !current);
                }}
                title={commentsVisible ? 'Hide comments' : 'Show comments'}
              >
                <MessageCircle className="size-3.5" />
                Comments {commentsVisible ? `(${openCommentsCount})` : 'off'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={addingComment ? 'default' : 'ghost'}
                disabled={!activeScreen}
                onClick={() => {
                  setCommentsVisible(true);
                  setAddingComment((current) => !current);
                }}
                title="Add comment"
              >
                <MessageSquarePlus className="size-3.5" />
                Add comment
              </Button>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            Add screens in Edit mode first, then open Demo to walk through them.
          </div>
        )}
      </div>
      {overlayScreen && (
        <FlowOverlay
          overlayScreen={overlayScreen}
          overlayUrl={overlayUrl}
          underlayScreenId={activeScreenId}
          screens={screens}
          flow={flow}
          onClose={() => setOverlayScreenId(null)}
          onAction={handleOverlayAction}
          className="z-40"
        />
      )}
    </div>
  );
}
