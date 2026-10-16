import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Loader2, RotateCw } from 'lucide-react';
import {
  screenSurface,
  type ProjectFlowEdge,
  type ProjectScreen,
} from '@sber-designer/shared-types';

import { useActiveScreenUrl } from '@/hooks/useActiveScreenUrl';
import { useFlowRuntime } from '@/hooks/useFlowRuntime';
import { useOverlayUnderlayLifecycle } from '@/hooks/useOverlayUnderlayLifecycle';
import { useSandboxSession } from '@/hooks/useSandboxSession';
import { useStandaloneModalCanvas } from '@/hooks/useStandaloneModalCanvas';
import { Button } from '@/components/ui/button';
import { shouldRenderCanvasIframe } from '@/lib/canvas-loading';
import { resolveBaseEdgeActivation, type OverlayAction } from '@/lib/overlay-runtime';
import {
  MAX_WARM_SCREEN_PREVIEWS,
  promoteScreenPreview,
  pruneScreenPreviewCache,
  type ScreenPreviewCacheEntry,
} from '@/lib/screen-preview-cache';
import { screenPreviewUrl } from '@/lib/screen-url';
import { modalCanvasFrameStyle } from '@/lib/modal-preview';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/editor-store';
import { useDesignStore } from '@/stores/design-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore, type SandboxSessionInfo } from '@/stores/sandbox-store';
import { DomOverlay } from './DomOverlay';
import { FlowOverlay } from './FlowOverlay';
import { MarkOverlay } from './MarkOverlay';

const EMPTY_SCREENS: readonly ProjectScreen[] = Object.freeze([]);
const EMPTY_FLOW: readonly ProjectFlowEdge[] = Object.freeze([]);

/**
 * Live-DOM canvas. An iframe loads either:
 *  - the active sandbox session's previewUrl (real Storybook spawned by
 *    services/sandbox), when one is connected, OR
 *  - the static `/demo-target/index.html` fixture, when no project is
 *    connected (handy for a quick smoke test of the editor itself).
 *
 * In Interact mode the iframe receives pointer events directly.
 * In Design mode the overlay sits above and captures hover/click,
 * resolving DOM nodes to JSX source via React Fiber `_debugSource`
 * (works on any React+Vite project) — see ADR-0007.
 *
 * For PoC-3 the sandbox previewUrl is a different origin (5173 → random
 * port). Browsers still let us read the iframe's `contentDocument`
 * because both run on `localhost`; in a stricter Phase-1 setup we'll
 * switch to a typed postMessage protocol when that boundary is introduced.
 */
export function CanvasFrame({ reloadKey = 0 }: { reloadKey?: number }) {
  const mode = useEditorStore((s) => s.mode);
  const markActive = useEditorStore((s) => s.markActive);
  const setPreviewWindow = useDesignStore((s) => s.setPreviewWindow);
  const canvasView = useEditorStore((s) => s.canvasView);
  const setCanvasView = useEditorStore((s) => s.setCanvasView);
  const activeScreenId = useEditorStore((s) => s.activeScreenId);
  const openScreenTabIds = useEditorStore((s) => s.openScreenTabIds);
  const activeScreenSelectionSource = useEditorStore((s) => s.activeScreenSelectionSource);
  const setActiveScreenId = useEditorStore((s) => s.setActiveScreenId);
  const fallbackCanvasUrl = useEditorStore((s) => s.canvasUrl);
  const screenPreviewRevisions = useEditorStore((s) => s.screenPreviewRevisions);
  const screenPreviewEpoch = useEditorStore((s) => s.screenPreviewEpoch);
  const projectScope = useProjectStore(
    (s) => s.project?.workspacePath ?? s.project?.name ?? 'no-project',
  );
  const screens = useProjectStore((s) => s.project?.screens) ?? EMPTY_SCREENS;
  const flow = useProjectStore((s) => s.project?.flow) ?? EMPTY_FLOW;
  const session = useSandboxStore((s) => s.session);
  const { createSession } = useSandboxSession();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameRefs = useRef(new Map<string, HTMLIFrameElement>());
  const previousPoolScopeRef = useRef('');
  const [restarting, setRestarting] = useState(false);
  const [readyFrameKeys, setReadyFrameKeys] = useState<Set<string>>(() => new Set());
  const [screenPreviewPool, setScreenPreviewPool] = useState<ScreenPreviewCacheEntry[]>([]);
  const [overlayScreenId, setOverlayScreenId] = useState<string | null>(null);
  const [localReloadKeys, setLocalReloadKeys] = useState<Record<string, number>>({});
  const [canvasWarning, setCanvasWarning] = useState<CanvasFrameWarning | null>(null);
  const effectiveUrl = useActiveScreenUrl();
  const renderIframe = shouldRenderCanvasIframe(session?.status);
  const activeScreen = useMemo(
    () => screens.find((screen) => screen.id === activeScreenId) ?? null,
    [activeScreenId, screens],
  );
  const outgoingEdges = useMemo(
    () => flow.filter((edge) => edge.fromScreenId === activeScreenId),
    [activeScreenId, flow],
  );
  const overlayScreen = screens.find((screen) => screen.id === overlayScreenId) ?? null;
  const overlayUrl = screenPreviewUrl(overlayScreen, session?.previewUrl, fallbackCanvasUrl);
  const activeScreenUrl = screenPreviewUrl(activeScreen, session?.previewUrl, fallbackCanvasUrl);
  const poolScope = `${projectScope}:${session?.id ?? 'fallback'}:${reloadKey}:${screenPreviewEpoch}`;
  const maxWarmPreviews = overlayScreen ? 1 : MAX_WARM_SCREEN_PREVIEWS;
  const activePreviewEntry =
    canvasView === 'screen' && activeScreen
      ? {
          screenId: activeScreen.id,
          url: activeScreenUrl,
          revision: screenPreviewRevisions[activeScreen.id] ?? 0,
        }
      : null;
  const activeFrameKey = activePreviewEntry
    ? previewFrameKey(
        activePreviewEntry,
        poolScope,
        localReloadKeys[activePreviewEntry.screenId] ?? 0,
      )
    : canvasView !== 'screen'
      ? `${canvasView}:${effectiveUrl}:${poolScope}`
      : `root:${effectiveUrl}:${poolScope}:${localReloadKeys.__root__ ?? 0}`;
  const iframeReady = readyFrameKeys.has(activeFrameKey);
  const standaloneModal = canvasView === 'screen' && screenSurface(activeScreen) === 'modal';
  const flowRuntimeEnabled =
    renderIframe && mode === 'interact' && canvasView === 'screen' && Boolean(activeScreen);
  // Pause the underlay runtime while a modal overlay is open (риск №3).
  const baseRuntimeEnabled = flowRuntimeEnabled && !overlayScreen;

  const activateEdge = useCallback(
    (edge: ProjectFlowEdge) => {
      const action = resolveBaseEdgeActivation(edge, screens);
      if (action.kind === 'open-overlay') {
        setOverlayScreenId(action.screenId);
        return;
      }
      setOverlayScreenId(null);
      setActiveScreenId(action.screenId, { source: 'flow' });
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
          setActiveScreenId(action.screenId, { source: 'flow' });
          return;
      }
    },
    [setActiveScreenId],
  );

  useLayoutEffect(() => {
    if (!renderIframe || canvasView !== 'screen' || !activePreviewEntry) {
      previousPoolScopeRef.current = poolScope;
      setScreenPreviewPool([]);
      return;
    }
    setScreenPreviewPool((current) => {
      const sameScope = previousPoolScopeRef.current === poolScope;
      previousPoolScopeRef.current = poolScope;
      const cacheableIds =
        openScreenTabIds.length > 0
          ? Array.from(new Set([...openScreenTabIds, activePreviewEntry.screenId]))
          : screens.map((screen) => screen.id);
      const retained = sameScope
        ? pruneScreenPreviewCache(current, cacheableIds, screenPreviewRevisions)
        : [];
      return promoteScreenPreview(retained, activePreviewEntry, maxWarmPreviews);
    });
  }, [
    activePreviewEntry?.revision,
    activePreviewEntry?.screenId,
    activePreviewEntry?.url,
    canvasView,
    maxWarmPreviews,
    openScreenTabIds,
    poolScope,
    renderIframe,
    screenPreviewRevisions,
    screens,
  ]);

  useLayoutEffect(() => {
    const frame = frameRefs.current.get(activeFrameKey) ?? null;
    iframeRef.current = frame;
    setCanvasWarning(null);
    setPreviewWindow(iframeReady ? (frame?.contentWindow ?? null) : null);
    if (iframeReady && canvasView === 'screen') setCanvasWarning(readCanvasFrameWarning(frame));
  }, [activeFrameKey, canvasView, iframeReady, screenPreviewPool, setPreviewWindow]);

  useEffect(() => {
    const liveKeys = new Set(
      screenPreviewPool.map((entry) =>
        previewFrameKey(entry, poolScope, localReloadKeys[entry.screenId] ?? 0),
      ),
    );
    liveKeys.add(activeFrameKey);
    setReadyFrameKeys((current) => {
      const next = new Set(Array.from(current).filter((key) => liveKeys.has(key)));
      return next.size === current.size ? current : next;
    });
  }, [activeFrameKey, localReloadKeys, poolScope, screenPreviewPool]);

  useEffect(() => () => setPreviewWindow(null), [setPreviewWindow]);

  useEffect(() => {
    if (!baseRuntimeEnabled) return;
    const onMount = outgoingEdges.find((edge) => edge.trigger.kind === 'on-mount');
    if (!onMount) return;
    const timer = window.setTimeout(() => {
      // A deliberate sidebar selection wins over an automatic on-mount edge.
      // Runtime interactions still call activateEdge with source=flow.
      if (useEditorStore.getState().activeScreenSelectionSource === 'user') return;
      activateEdge(onMount);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [activateEdge, activeScreenSelectionSource, baseRuntimeEnabled, outgoingEdges]);

  useEffect(() => {
    if (canvasView !== 'screen' || mode !== 'interact') {
      setOverlayScreenId(null);
    }
  }, [canvasView, mode]);
  useOverlayUnderlayLifecycle(activeScreenId, overlayScreenId, () => setOverlayScreenId(null));
  useFlowRuntime({
    iframeRef,
    enabled: baseRuntimeEnabled,
    ready: iframeReady,
    edges: outgoingEdges,
    onActivate: activateEdge,
  });
  const modalPreview = useStandaloneModalCanvas({
    iframeRef,
    enabled: renderIframe && standaloneModal,
    ready: iframeReady,
    identity: activeFrameKey,
  });
  const standaloneFrameStyle = standaloneModal
    ? (modalCanvasFrameStyle(modalPreview) ?? {
        width: 'min(640px, 100%)',
        height: 'min(480px, 100%)',
      })
    : undefined;

  return (
    <div className="relative h-full w-full bg-background">
      {session?.status === 'starting' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
          <div className="rounded-md border border-border bg-card px-4 py-3 text-sm shadow-lg">
            Booting sandbox dev-server…
          </div>
        </div>
      )}
      {session?.status === 'failed' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <SandboxOverlay
            message={sandboxFailureMessage(session)}
            detail={sandboxFailureDetail(session)}
            restarting={restarting}
            onRestart={() =>
              void restartStorybook(
                session.workspacePath,
                createSession,
                setCanvasView,
                setRestarting,
              )
            }
            tone="error"
          />
        </div>
      )}
      {session?.status === 'stopped' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <SandboxOverlay
            message="Storybook is stopped."
            detail={
              session.errorMessage ??
              'Restart it to inspect the catalog, switch to Storybook, or keep editing live screens.'
            }
            restarting={restarting}
            onRestart={() =>
              void restartStorybook(
                session.workspacePath,
                createSession,
                setCanvasView,
                setRestarting,
              )
            }
          />
        </div>
      )}
      {renderIframe && canvasView === 'screen' && activePreviewEntry
        ? screenPreviewPool.map((entry) => {
            const active = entry.screenId === activePreviewEntry.screenId;
            const frameKey = previewFrameKey(
              entry,
              poolScope,
              localReloadKeys[entry.screenId] ?? 0,
            );
            return (
              <iframe
                key={frameKey}
                ref={(node) => {
                  if (node) frameRefs.current.set(frameKey, node);
                  else frameRefs.current.delete(frameKey);
                }}
                title={active ? 'canvas' : `Warm preview: ${entry.screenId}`}
                src={entry.url}
                sandbox="allow-scripts allow-same-origin allow-forms"
                tabIndex={active && !overlayScreen ? 0 : -1}
                aria-hidden={active && !overlayScreen ? undefined : true}
                inert={active && !overlayScreen ? undefined : true}
                className={cn(
                  'absolute border-0',
                  active && standaloneModal
                    ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-transparent'
                    : 'inset-0 h-full w-full bg-white',
                  active ? 'visible' : 'invisible',
                  active && !overlayScreen ? 'pointer-events-auto' : 'pointer-events-none',
                )}
                style={active && standaloneModal ? standaloneFrameStyle : undefined}
                onLoad={() => {
                  setReadyFrameKeys((current) => new Set(current).add(frameKey));
                  if (
                    useEditorStore.getState().canvasView === 'screen' &&
                    useEditorStore.getState().activeScreenId === entry.screenId
                  ) {
                    const frame = frameRefs.current.get(frameKey) ?? null;
                    iframeRef.current = frame;
                    setPreviewWindow(frame?.contentWindow ?? null);
                    setCanvasWarning(readCanvasFrameWarning(frame));
                  }
                }}
              />
            );
          })
        : renderIframe && (
            <iframe
              key={activeFrameKey}
              ref={(node) => {
                iframeRef.current = node;
                if (node) frameRefs.current.set(activeFrameKey, node);
                else frameRefs.current.delete(activeFrameKey);
              }}
              title="canvas"
              src={effectiveUrl}
              sandbox="allow-scripts allow-same-origin allow-forms"
              className="h-full w-full border-0 bg-white"
              onLoad={() => {
                setReadyFrameKeys((current) => new Set(current).add(activeFrameKey));
                setPreviewWindow(iframeRef.current?.contentWindow ?? null);
                if (canvasView === 'screen') {
                  setCanvasWarning(readCanvasFrameWarning(iframeRef.current));
                }
              }}
            />
          )}
      {renderIframe && canvasWarning && (
        <CanvasWarningOverlay
          warning={canvasWarning}
          restarting={restarting}
          canRestart={Boolean(session?.workspacePath)}
          onReload={() => {
            const targetId = activeScreenId ?? '__root__';
            setLocalReloadKeys((keys) => ({
              ...keys,
              [targetId]: (keys[targetId] ?? 0) + 1,
            }));
          }}
          onRestart={() =>
            session?.workspacePath
              ? void restartStorybook(
                  session.workspacePath,
                  createSession,
                  setCanvasView,
                  setRestarting,
                )
              : undefined
          }
        />
      )}
      {renderIframe && (mode === 'design' || mode === 'code') && canvasView === 'screen' && (
        <CanvasInteractionLayer
          {...(standaloneFrameStyle ? { standaloneStyle: standaloneFrameStyle } : {})}
        >
          <DomOverlay iframeRef={iframeRef} variant={mode === 'code' ? 'code' : 'design'} />
        </CanvasInteractionLayer>
      )}
      {renderIframe && markActive && canvasView === 'screen' && (
        <CanvasInteractionLayer
          {...(standaloneFrameStyle ? { standaloneStyle: standaloneFrameStyle } : {})}
        >
          <MarkOverlay iframeRef={iframeRef} />
        </CanvasInteractionLayer>
      )}
      {flowRuntimeEnabled && overlayScreen && (
        <FlowOverlay
          overlayScreen={overlayScreen}
          overlayUrl={overlayUrl}
          underlayScreenId={activeScreenId}
          screens={screens}
          flow={flow}
          onClose={() => setOverlayScreenId(null)}
          onAction={handleOverlayAction}
          className="z-20"
        />
      )}
    </div>
  );
}

function CanvasInteractionLayer({
  standaloneStyle,
  children,
}: {
  standaloneStyle?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'absolute',
        standaloneStyle ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2' : 'inset-0',
      )}
      style={standaloneStyle}
    >
      {children}
    </div>
  );
}

function previewFrameKey(
  entry: ScreenPreviewCacheEntry,
  poolScope: string,
  localReloadKey: number,
): string {
  return `screen:${entry.screenId}:${entry.revision}:${poolScope}:${localReloadKey}`;
}

interface CanvasFrameWarning {
  message: string;
  detail: string;
}

export function canvasFrameWarningFromSnapshot(input: {
  rootFound: boolean;
  bodyText: string;
  url?: string;
}): CanvasFrameWarning | null {
  if (input.rootFound) return null;
  const bodyText = input.bodyText.replace(/\s+/gu, ' ').trim();
  if (bodyText.length > 0) {
    return {
      message: 'Canvas loaded without a screen root.',
      detail: bodyText.length > 220 ? `${bodyText.slice(0, 217)}...` : bodyText,
    };
  }
  // 0108.4.3: phrase the empty-canvas hint per profile. Storybook previews serve
  // at /iframe.html?id=…; static HTML pages load their file directly and must not
  // mention Storybook.
  return {
    message: 'Canvas loaded without a screen root.',
    detail: isStorybookPreviewUrl(input.url)
      ? 'The iframe finished loading, but the selected story did not expose data-sd-screen-root. Reload or restart Storybook.'
      : 'The iframe finished loading, but the page did not expose data-sd-screen-root. Reload the static HTML preview.',
  };
}

function isStorybookPreviewUrl(url: string | undefined): boolean {
  if (!url) return false;
  return /\/iframe\.html\b/iu.test(url) || /[?&]id=/u.test(url);
}

function readCanvasFrameWarning(iframe: HTMLIFrameElement | null): CanvasFrameWarning | null {
  if (!iframe) return null;
  try {
    const doc = iframe.contentDocument;
    if (!doc) return null;
    return canvasFrameWarningFromSnapshot({
      rootFound: hasCanvasScreenRoot(doc),
      bodyText: doc.body?.innerText ?? doc.body?.textContent ?? '',
      url: iframe.src,
    });
  } catch {
    return null;
  }
}

export function hasCanvasScreenRoot(root: ParentNode): boolean {
  return Boolean(root.querySelector('[data-sd-screen-root]'));
}

function CanvasWarningOverlay({
  warning,
  restarting,
  canRestart,
  onReload,
  onRestart,
}: {
  warning: CanvasFrameWarning;
  restarting: boolean;
  canRestart: boolean;
  onReload: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex justify-center">
      <div className="pointer-events-auto max-w-xl rounded-md border border-warning/40 bg-warning px-4 py-3 text-sm text-warning-foreground shadow-lg">
        <div className="font-medium">{warning.message}</div>
        <div className="mt-1 text-xs opacity-85">{warning.detail}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onReload}>
            <RotateCw className="size-3.5" />
            Reload canvas
          </Button>
          {canRestart && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={restarting}
              onClick={onRestart}
            >
              {restarting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RotateCw className="size-3.5" />
              )}
              Restart Storybook
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SandboxOverlay({
  message,
  detail,
  restarting,
  onRestart,
  tone = 'default',
}: {
  message: string;
  detail: string;
  restarting: boolean;
  onRestart: () => void;
  tone?: 'default' | 'error';
}) {
  return (
    <div
      className={
        tone === 'error'
          ? 'max-w-xl rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground shadow-lg'
          : 'max-w-md rounded-md border border-border bg-card px-4 py-3 text-sm text-foreground shadow-lg'
      }
    >
      <div className="font-medium">{message}</div>
      <div className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{detail}</div>
      <Button size="sm" className="mt-3" disabled={restarting} onClick={onRestart}>
        {restarting ? <Loader2 className="animate-spin" /> : <RotateCw />}
        Restart Storybook
      </Button>
    </div>
  );
}

async function restartStorybook(
  workspacePath: string,
  createSession: (workspacePath: string, options?: { force?: boolean }) => Promise<unknown>,
  setCanvasView: (view: 'screen' | 'storybook' | 'design-system') => void,
  setRestarting: (restarting: boolean) => void,
) {
  setRestarting(true);
  try {
    await createSession(workspacePath, { force: true });
    setCanvasView('screen');
  } finally {
    setRestarting(false);
  }
}

function sandboxFailureMessage(session: SandboxSessionInfo): string {
  const reason = session.diagnostics?.reason;
  if (reason === 'binary_missing') return 'Sandbox dev-server binary is missing.';
  if (reason === 'package_install_blocked') return 'Dependency installation is blocked.';
  if (reason === 'dependencies_missing') return 'Project dependencies are incomplete.';
  return 'Storybook failed to start.';
}

function sandboxFailureDetail(session: SandboxSessionInfo): string {
  const diagnostic = session.diagnostics;
  if (!diagnostic) return session.errorMessage ?? 'Check services/sandbox logs.';

  const lines = [
    diagnostic.message,
    `Command: ${diagnostic.command}`,
    diagnostic.registry ? `Registry: ${diagnostic.registry}` : null,
    `Next action: ${diagnostic.suggestedAction}`,
    diagnostic.evidence.length > 0 ? 'Evidence:' : null,
    ...diagnostic.evidence.slice(0, 4).map((line) => `- ${line}`),
  ].filter((line): line is string => Boolean(line));
  return lines.join('\n');
}
