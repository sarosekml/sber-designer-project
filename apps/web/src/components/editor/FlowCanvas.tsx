import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type EdgeChange,
  MarkerType,
  type Node,
  type NodeChange,
  type NodeTypes,
  ReactFlow,
  ReactFlowProvider,
  type Viewport,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  screenSurface,
  type ProjectFlowEdge,
  type ProjectScreen,
} from '@sber-designer/shared-types';

import { resolveEdgePresentation, updateFlowEdgeSettings } from '@/lib/flow-runtime';

import { Button } from '@/components/ui/button';
import { FlowToolbar } from './FlowToolbar';
import { FlowField } from './FlowField';
import { FlowScreenNode, type ScreenFlowNode } from './FlowScreenNode';
import { buildFlowTrigger } from './flow-trigger';
import { captureFlowScreenPreviews } from '@/lib/api-client';
import {
  filterFlowTargets,
  listFlowTargetsFromIframe,
  type FlowTargetCandidate,
} from '@/lib/flow-targets';
import {
  createFlowEdgeFromConnection,
  applyFlowNodeSelection,
  flowEdgeHandles,
} from '@/lib/flow-graph';
import { flowEdgeDisplayLabel } from '@/lib/flow-runtime';
import { normalizeFlowView, visibleFlowEdges, visibleFlowScreens } from '@/lib/flow-view';
import {
  absoluteFlowPreviewUrl,
  flowScreenPreviewFingerprint,
  mergeFlowPreviewCaptures,
} from '@/lib/flow-preview';
import { livePreviewScreenIds } from '@/lib/flow-preview-visibility';
import { screenPreviewUrl } from '@/lib/screen-url';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';
import { useThemeStore } from '@/stores/theme-store';

/**
 * Flow editor (Phase 5.2b, drag-persist Phase 6.2). Each screen is a
 * node, each ProjectFlowEdge is an edge. Drawing a connection between
 * two nodes appends a new `manual`-trigger edge to the project;
 * deleting an edge removes it.
 *
 * Layout: if `screen.position` is set we honour it; otherwise nodes
 * fall back to a left→right auto-layout based on screen index. Drag-
 * stop writes the new {x,y} back into the project so the diagram is
 * stable across reloads (Phase 6.2).
 *
 * Triggers (Phase 6.7): clicking an edge opens a small picker dialog
 * that lets the user pick the trigger kind (click / link / on-mount
 * / manual) and fill the associated fields. Demo mode walks the flow
 * by matching against these triggers, so editing here is the only
 * way to make a freshly-drawn `manual` edge actually fire on a
 * button press in the running prototype.
 */
export function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowInner />
    </ReactFlowProvider>
  );
}

const COMPACT_NODE_WIDTH = 220;
const COMPACT_NODE_HEIGHT = 176;
const FRAME_NODE_WIDTH = 420;
const FRAME_NODE_HEIGHT = 304;
const COL_GAP = 100;
const FLOW_PREVIEW_BUFFER = 240;

const FLOW_NODE_TYPES: NodeTypes = {
  screen: FlowScreenNode,
};

type FlowViewportState = Viewport & { width: number; height: number };

function FlowInner() {
  const appTheme = useThemeStore((s) => s.theme);
  const project = useProjectStore((s) => s.project);
  const setProject = useProjectStore((s) => s.setProject);
  const activeScreenId = useEditorStore((s) => s.activeScreenId);
  const setActiveScreenId = useEditorStore((s) => s.setActiveScreenId);
  const fallbackCanvasUrl = useEditorStore((s) => s.canvasUrl);
  const editingEdgeId = useEditorStore((s) => s.editingFlowEdgeId);
  const setEditingEdgeId = useEditorStore((s) => s.setEditingFlowEdgeId);
  const session = useSandboxStore((s) => s.session);
  const flowCanvasRef = useRef<HTMLDivElement | null>(null);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [previewRefreshing, setPreviewRefreshing] = useState(false);
  const [previewStatus, setPreviewStatus] = useState('Live previews');
  const [flowViewport, setFlowViewport] = useState<FlowViewportState>({
    x: 0,
    y: 0,
    zoom: 1,
    width: 0,
    height: 0,
  });

  const screens: ProjectScreen[] = project?.screens ?? [];
  const flow: ProjectFlowEdge[] = project?.flow ?? [];
  const flowView = useMemo(() => normalizeFlowView(project?.flowView), [project?.flowView]);
  const visibleScreens = useMemo(() => visibleFlowScreens(screens, flowView), [screens, flowView]);
  const visibleFlow = useMemo(
    () => visibleFlowEdges(flow, screens, flowView),
    [flow, screens, flowView],
  );
  const editingEdge = editingEdgeId ? (flow.find((e) => e.id === editingEdgeId) ?? null) : null;
  const nodeWidth = flowView.previewSize === 'frames' ? FRAME_NODE_WIDTH : COMPACT_NODE_WIDTH;
  const nodeHeight = flowView.previewSize === 'frames' ? FRAME_NODE_HEIGHT : COMPACT_NODE_HEIGHT;

  useEffect(() => {
    const element = flowCanvasRef.current;
    if (!element) return;
    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setFlowViewport((current) => ({ ...current, width: rect.width, height: rect.height }));
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const flowNodeRects = useMemo(
    () =>
      visibleScreens.map((screen, i) => {
        const position = screen.position ?? { x: i * (nodeWidth + COL_GAP), y: 80 };
        return {
          id: screen.id,
          screen,
          x: position.x,
          y: position.y,
          width: nodeWidth,
          height: nodeHeight,
        };
      }),
    [nodeHeight, nodeWidth, visibleScreens],
  );

  const livePreviewIds = useMemo(
    () =>
      flowView.previewSize === 'frames'
        ? livePreviewScreenIds(flowNodeRects, {
            ...flowViewport,
            buffer: FLOW_PREVIEW_BUFFER,
          })
        : new Set<string>(),
    [flowNodeRects, flowView.previewSize, flowViewport],
  );

  // Controlled selection (0138 C1): `selected` derives from activeScreenId so
  // sidebar and Flow clicks share one selection state and no transient
  // React Flow selection survives the next nodes rebuild.
  const nodes = useMemo<ScreenFlowNode[]>(
    () =>
      applyFlowNodeSelection(
        flowNodeRects.map((item) => ({
          id: item.id,
          type: 'screen',
          position: { x: item.x, y: item.y },
          data: {
            screen: item.screen,
            flowView,
            livePreviewAllowed: livePreviewIds.has(item.id),
            previewFrameWidth: nodeWidth - 24,
            previewRefreshKey,
          },
          style: {
            width: nodeWidth,
            height: nodeHeight,
          },
        })),
        activeScreenId,
      ),
    [
      activeScreenId,
      flowNodeRects,
      flowView,
      livePreviewIds,
      nodeHeight,
      nodeWidth,
      previewRefreshKey,
    ],
  );

  const edges = useMemo<Edge[]>(
    () =>
      visibleFlow.map((e) => {
        const handles = flowEdgeHandles(e, screens);
        return {
          id: e.id,
          source: e.fromScreenId,
          target: e.toScreenId,
          sourceHandle: handles.sourceHandle,
          targetHandle: handles.targetHandle,
          type: 'smoothstep',
          label: flowEdgeDisplayLabel(e),
          animated: e.trigger.kind === 'on-mount',
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        };
      }),
    [visibleFlow, screens],
  );

  // Drag is the only NodeChange we care about — and only the final
  // position (not every intermediate frame), to keep the project store
  // dirty bit from churning. xyflow marks the last drag tick with
  // `dragging: false`, so we filter on that and skip rewrites that
  // don't actually move a node.
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!project) return;
      const moves: Record<string, { x: number; y: number }> = {};
      for (const c of changes) {
        if (c.type === 'position' && c.dragging === false && c.position) {
          moves[c.id] = c.position;
        }
      }
      if (Object.keys(moves).length === 0) return;
      let changed = false;
      const nextScreens = project.screens.map((s) => {
        const p = moves[s.id];
        if (!p) return s;
        if (s.position && s.position.x === p.x && s.position.y === p.y) return s;
        changed = true;
        return { ...s, position: p };
      });
      if (!changed) return;
      setProject({ ...project, screens: nextScreens });
    },
    [project, setProject],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (!project) return;
      const removed = new Set<string>();
      for (const c of changes) {
        if (c.type === 'remove') removed.add(c.id);
      }
      if (removed.size === 0) return;
      setProject({
        ...project,
        flow: project.flow.filter((e) => !removed.has(e.id)),
      });
    },
    [project, setProject],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!project) return;
      const newEdge = createFlowEdgeFromConnection(connection, project.flow);
      if (!newEdge) return;
      setProject({ ...project, flow: [...project.flow, newEdge] });
      setEditingEdgeId(newEdge.id);
    },
    [project, setProject, setEditingEdgeId],
  );

  const onNodeClick = useCallback(
    (_e: unknown, node: Node) => {
      // Clicking a Flow card is a Flow-sourced selection, keeping the
      // existing precedence contract vs sidebar/user selection (0138 C1).
      setActiveScreenId(node.id, { source: 'flow' });
    },
    [setActiveScreenId],
  );

  const onEdgeClick = useCallback(
    (_e: unknown, edge: Edge) => {
      setEditingEdgeId(edge.id);
    },
    [setEditingEdgeId],
  );

  const saveEdgeTrigger = useCallback(
    (
      edgeId: string,
      next: ProjectFlowEdge['trigger'],
      label?: string,
      presentationOverride?: 'navigate' | 'overlay',
    ) => {
      if (!project) return;
      setProject({
        ...project,
        flow: project.flow.map((e) => {
          if (e.id !== edgeId) return e;
          return updateFlowEdgeSettings(e, {
            trigger: next,
            ...(label ? { label } : {}),
            ...(presentationOverride ? { presentationOverride } : {}),
          });
        }),
      });
    },
    [project, setProject],
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      if (!project) return;
      setProject({ ...project, flow: project.flow.filter((e) => e.id !== edgeId) });
      setEditingEdgeId(null);
    },
    [project, setEditingEdgeId, setProject],
  );

  const handleViewportChange = useCallback((viewport: Viewport) => {
    setFlowViewport((current) => ({ ...current, ...viewport }));
  }, []);

  const refreshPreviews = useCallback(async () => {
    if (!project) return;
    setPreviewRefreshKey((key) => key + 1);
    setPreviewRefreshing(true);
    setPreviewStatus('Refreshing previews...');

    const visibleIds = new Set(visibleScreens.map((screen) => screen.id));
    const orderedScreens = [
      ...visibleScreens,
      ...screens.filter((screen) => !visibleIds.has(screen.id)),
    ];
    const captureScreens = orderedScreens.map((screen) => ({
      screenId: screen.id,
      url: absoluteFlowPreviewUrl(screenPreviewUrl(screen, session?.previewUrl, fallbackCanvasUrl)),
      sourceFingerprint: flowScreenPreviewFingerprint(screen),
    }));

    try {
      const response = await captureFlowScreenPreviews({
        viewport: flowView.previewViewport,
        screens: captureScreens,
      });
      if (response.captures.length > 0) {
        const latestProject = useProjectStore.getState().project;
        if (latestProject) {
          const latestFlowView = normalizeFlowView(latestProject.flowView);
          setProject({
            ...latestProject,
            flowView: {
              ...latestFlowView,
              previewCaptures: mergeFlowPreviewCaptures(
                latestFlowView.previewCaptures,
                response.captures,
              ),
            },
          });
        }
      }
      if (response.status === 'captured') {
        setPreviewStatus('Cached previews updated');
      } else if (response.status === 'partial') {
        setPreviewStatus(response.message ?? 'Some previews updated');
      } else {
        setPreviewStatus('Preview server unavailable');
      }
    } catch (err) {
      setPreviewStatus(err instanceof Error ? err.message : 'Preview refresh failed');
    } finally {
      setPreviewRefreshing(false);
    }
  }, [
    fallbackCanvasUrl,
    flowView.previewViewport,
    project,
    screens,
    session?.previewUrl,
    setProject,
    visibleScreens,
  ]);

  if (!project) {
    return <EmptyState text="Loading project…" />;
  }
  if (screens.length === 0) {
    return (
      <EmptyState text="No screens yet — go back to Edit, add screens from the catalog, then come back here to draw the flow." />
    );
  }

  // The sidebar keeps selection even when the screen is filtered out of the
  // canvas; say so instead of silently dropping the highlight (0138 C3).
  const activeScreenHiddenInFlow =
    Boolean(activeScreenId) &&
    screens.some((screen) => screen.id === activeScreenId) &&
    !visibleScreens.some((screen) => screen.id === activeScreenId);

  if (visibleScreens.length === 0) {
    return (
      <div className="relative h-full w-full">
        <FlowToolbar
          onRefreshPreviews={refreshPreviews}
          refreshing={previewRefreshing}
          status={previewStatus}
        />
        <EmptyState text="All screens are hidden in Flow. Use the eye controls in the Screens panel to show them again." />
      </div>
    );
  }

  return (
    <div ref={flowCanvasRef} className="relative h-full w-full">
      <FlowToolbar
        onRefreshPreviews={refreshPreviews}
        refreshing={previewRefreshing}
        status={previewStatus}
      />
      {activeScreenHiddenInFlow && (
        <div
          role="status"
          className="absolute left-3 top-14 z-10 max-w-64 rounded-md border border-border bg-card/95 px-2.5 py-1.5 text-[10px] text-muted-foreground shadow-sm backdrop-blur"
        >
          Selected screen is hidden in Flow — use the eye control in the Screens panel to show it.
        </div>
      )}
      <ReactFlow
        className="sd-flow"
        colorMode={appTheme}
        nodes={nodes}
        edges={edges}
        nodeTypes={FLOW_NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onInit={(instance) => handleViewportChange(instance.getViewport())}
        onMove={(_event, viewport) => handleViewportChange(viewport)}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
      </ReactFlow>
      {editingEdge && (
        <EdgeTriggerDialog
          edge={editingEdge}
          fromScreen={screens.find((s) => s.id === editingEdge.fromScreenId) ?? null}
          toScreen={screens.find((s) => s.id === editingEdge.toScreenId) ?? null}
          onClose={() => setEditingEdgeId(null)}
          onSave={(trigger, label, presentationOverride) => {
            saveEdgeTrigger(editingEdge.id, trigger, label, presentationOverride);
            setEditingEdgeId(null);
          }}
          onDelete={() => deleteEdge(editingEdge.id)}
        />
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

// ---------- Edge trigger picker (Phase 6.7) ----------

type TriggerKind = ProjectFlowEdge['trigger']['kind'];

const TRIGGER_KINDS: { id: TriggerKind; label: string; hint: string }[] = [
  {
    id: 'click',
    label: 'On click',
    hint: 'A user click in the prototype navigates here. Match by CSS selector or button text.',
  },
  {
    id: 'link',
    label: 'On link',
    hint: 'An <a href="…"> in the prototype navigates here. Match by full or trailing href.',
  },
  {
    id: 'on-mount',
    label: 'On mount',
    hint: 'Auto-navigate as soon as the source screen loads. Useful for splash → home.',
  },
  {
    id: 'manual',
    label: 'Manual',
    hint: 'Never fires by itself — used for back-buttons or routes you trigger from a sidebar.',
  },
];

interface EdgeTriggerDialogProps {
  edge: ProjectFlowEdge;
  fromScreen: ProjectScreen | null;
  toScreen: ProjectScreen | null;
  onClose: () => void;
  onSave: (
    trigger: ProjectFlowEdge['trigger'],
    label: string,
    presentationOverride?: 'navigate' | 'overlay',
  ) => void;
  onDelete: () => void;
}

function EdgeTriggerDialog({
  edge,
  fromScreen,
  toScreen,
  onClose,
  onSave,
  onDelete,
}: EdgeTriggerDialogProps) {
  const [kind, setKind] = useState<TriggerKind>(edge.trigger.kind);
  // Per-kind field state. We keep all four around so flipping the
  // radio doesn't wipe what the user typed in the previous shape.
  const [clickLabel, setClickLabel] = useState(
    edge.trigger.kind === 'click' ? (edge.trigger.label ?? '') : '',
  );
  const [clickSelector, setClickSelector] = useState(
    edge.trigger.kind === 'click' ? (edge.trigger.selector ?? '') : '',
  );
  const [linkHref, setLinkHref] = useState(edge.trigger.kind === 'link' ? edge.trigger.href : '');
  const [manualLabel, setManualLabel] = useState(
    edge.trigger.kind === 'manual' ? (edge.trigger.label ?? '') : '',
  );
  const [edgeLabel, setEdgeLabel] = useState(edge.label ?? '');
  // Preselect the target-aware default (overlay for a modal target) so an
  // unset edge shows what it will actually do (Р-5).
  const defaultPresentation: 'navigate' | 'overlay' =
    screenSurface(toScreen) === 'modal' ? 'overlay' : 'navigate';
  const [presentation, setPresentation] = useState<'navigate' | 'overlay'>(
    resolveEdgePresentation(edge, toScreen),
  );
  const [presentationTouched, setPresentationTouched] = useState(edge.presentation !== undefined);
  const fallbackCanvasUrl = useEditorStore((s) => s.canvasUrl);
  const session = useSandboxStore((s) => s.session);
  const sourceUrl = screenPreviewUrl(fromScreen, session?.previewUrl, fallbackCanvasUrl);
  const targetFrameRef = useRef<HTMLIFrameElement>(null);
  const [targetQuery, setTargetQuery] = useState('');
  const [targetFrameLoads, setTargetFrameLoads] = useState(0);
  const [targets, setTargets] = useState<FlowTargetCandidate[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);

  const handleSave = () => {
    const trigger = buildFlowTrigger(kind, {
      clickLabel,
      clickSelector,
      linkHref,
      manualLabel,
    });
    if (!trigger) return;
    onSave(trigger, edgeLabel.trim(), presentationTouched ? presentation : undefined);
  };

  const valid =
    (kind === 'click' && Boolean(clickLabel.trim() || clickSelector.trim())) ||
    (kind === 'link' && linkHref.trim().length > 0) ||
    kind === 'on-mount' ||
    kind === 'manual';
  const visibleTargets = filterFlowTargets(targets, targetQuery).slice(0, 8);

  useEffect(() => {
    if (kind !== 'click' || !fromScreen || targetFrameLoads === 0) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setTargetsLoading(true);
      void listFlowTargetsFromIframe(targetFrameRef.current, targetQuery)
        .then((next) => {
          if (!cancelled) setTargets(next);
        })
        .finally(() => {
          if (!cancelled) setTargetsLoading(false);
        });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [fromScreen, kind, sourceUrl, targetFrameLoads, targetQuery]);

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit transition</DialogTitle>
          <DialogDescription>
            {fromScreen?.name ?? '?'} → {toScreen?.name ?? '?'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div>
            <div className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              Trigger
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TRIGGER_KINDS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setKind(id)}
                  className={
                    'rounded-md border px-3 py-2 text-left text-xs transition-colors ' +
                    (kind === id
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-background hover:bg-accent')
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              {TRIGGER_KINDS.find((t) => t.id === kind)?.hint}
            </p>
          </div>

          {kind === 'click' && (
            <>
              <FlowField
                label="Click target"
                hint="Search source screen text, component names, selectors, and attributes."
              >
                <div className="grid gap-2">
                  <input
                    value={targetQuery}
                    onChange={(e) => setTargetQuery(e.target.value)}
                    placeholder='Search, e.g. "Funds"'
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <div className="max-h-52 overflow-y-auto rounded-md border border-border bg-background">
                    {targetsLoading ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Scanning screen…
                      </div>
                    ) : visibleTargets.length > 0 ? (
                      visibleTargets.map((target) => (
                        <button
                          key={target.id}
                          type="button"
                          onClick={() => {
                            setClickLabel(target.text ?? '');
                            setClickSelector(target.selector ?? '');
                            setTargetQuery(target.text ?? target.componentName ?? target.tagName);
                          }}
                          className="grid w-full gap-0.5 border-b border-border px-3 py-2 text-left text-xs last:border-b-0 hover:bg-accent"
                        >
                          <span className="truncate font-medium">
                            {target.text || target.selector || target.tagName.toLowerCase()}
                          </span>
                          <span className="truncate text-[11px] text-muted-foreground">
                            {target.componentName ?? target.tagName.toLowerCase()}
                            {target.selector ? ` · ${target.selector}` : ''}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        No matching targets in the source screen.
                      </div>
                    )}
                  </div>
                </div>
              </FlowField>
              <FlowField
                label="Button text (optional)"
                hint="Matches if the clicked element's text equals this."
              >
                <input
                  value={clickLabel}
                  onChange={(e) => setClickLabel(e.target.value)}
                  placeholder='e.g. "Continue"'
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </FlowField>
              <FlowField
                label="Selector fallback (optional)"
                hint="Matches if the clicked element matches this selector. Wins over text."
              >
                <input
                  value={clickSelector}
                  onChange={(e) => setClickSelector(e.target.value)}
                  placeholder='e.g. button[data-id="next"]'
                  className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </FlowField>
            </>
          )}

          {kind === 'link' && (
            <FlowField
              label="href"
              hint="Required. Suffix-match works too — '/orders' matches '…/orders'."
            >
              <input
                value={linkHref}
                onChange={(e) => setLinkHref(e.target.value)}
                placeholder="e.g. /orders/new"
                className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </FlowField>
          )}

          {kind === 'manual' && (
            <FlowField label="Label (optional)" hint="Shown on the edge in the diagram.">
              <input
                value={manualLabel}
                onChange={(e) => setManualLabel(e.target.value)}
                placeholder='e.g. "back"'
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </FlowField>
          )}

          <FlowField
            label="Open as"
            hint={
              defaultPresentation === 'overlay'
                ? 'The target is a modal, so it opens as an overlay by default.'
                : 'Overlay keeps the source screen behind the target.'
            }
          >
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'navigate' as const, label: 'Screen' },
                { id: 'overlay' as const, label: 'Overlay' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setPresentation(item.id);
                    setPresentationTouched(true);
                  }}
                  className={
                    'rounded-md border px-3 py-2 text-left text-xs transition-colors ' +
                    (presentation === item.id
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-background hover:bg-accent')
                  }
                >
                  {item.label}
                  {item.id === defaultPresentation && (
                    <span className="ml-1 text-[10px] text-muted-foreground">· default</span>
                  )}
                </button>
              ))}
            </div>
          </FlowField>

          <FlowField
            label="Edge label override (optional)"
            hint="Wins over the auto-generated label."
          >
            <input
              value={edgeLabel}
              onChange={(e) => setEdgeLabel(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </FlowField>

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-destructive hover:text-destructive"
            >
              Delete edge
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" disabled={!valid} onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        </div>
        {kind === 'click' && fromScreen && (
          <iframe
            ref={targetFrameRef}
            title="Source screen target scanner"
            src={sourceUrl}
            sandbox="allow-scripts allow-same-origin allow-forms"
            aria-hidden="true"
            tabIndex={-1}
            className="pointer-events-none absolute -left-[10000px] top-0 h-[720px] w-[1280px] opacity-0"
            onLoad={() => setTargetFrameLoads((count) => count + 1)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
