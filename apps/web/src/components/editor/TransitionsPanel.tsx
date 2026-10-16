import { ArrowRight, Eye, EyeOff, FileText, MousePointer2, Workflow } from 'lucide-react';

import { outgoingFlowEdges } from '@/lib/flow-graph';
import { edgeTargetMode, flowEdgeDisplayLabel, transitionStatusLabel } from '@/lib/flow-runtime';
import { normalizeFlowView, toggleFlowEdgeHidden } from '@/lib/flow-view';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';

export function TransitionsPanel() {
  const project = useProjectStore((s) => s.project);
  const setProject = useProjectStore((s) => s.setProject);
  const activeScreenId = useEditorStore((s) => s.activeScreenId);
  const setEditingFlowEdgeId = useEditorStore((s) => s.setEditingFlowEdgeId);

  const screens = project?.screens ?? [];
  const activeScreen = screens.find((screen) => screen.id === activeScreenId) ?? null;
  const outgoing = outgoingFlowEdges(project?.flow ?? [], activeScreenId);
  const flowView = normalizeFlowView(project?.flowView);

  const updateActiveScreenDescription = (description: string) => {
    if (!project || !activeScreen) return;
    const trimmed = description.trim();
    setProject({
      ...project,
      screens: project.screens.map((screen) => {
        if (screen.id !== activeScreen.id) return screen;
        const { description: _description, ...rest } = screen;
        void _description;
        return trimmed ? { ...rest, description } : rest;
      }),
    });
  };

  const toggleEdgeHidden = (edgeId: string) => {
    if (!project) return;
    setProject({ ...project, flowView: toggleFlowEdgeHidden(project.flowView, edgeId) });
  };

  return (
    <aside className="flex min-h-0 flex-col border-r border-border bg-card">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Workflow className="size-4 text-primary" />
          <span className="truncate text-xs font-semibold">Transitions</span>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          {outgoing.length}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {!activeScreen ? (
          <div className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
            Select a screen to see its outgoing transitions.
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="rounded-md border border-border bg-background p-2.5">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
                <FileText className="size-3.5 text-muted-foreground" />
                Notes
              </div>
              <textarea
                value={activeScreen.description ?? ''}
                onChange={(event) => updateActiveScreenDescription(event.target.value)}
                placeholder="Add notes for this screen..."
                className="min-h-20 w-full resize-y rounded-md border border-border bg-card px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            {outgoing.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                No transitions from {activeScreen.name}. Draw a line on the map to create one.
              </div>
            ) : (
              <div className="grid gap-1.5">
                {outgoing.map((edge) => {
                  const target = screens.find((screen) => screen.id === edge.toScreenId);
                  const mode = edgeTargetMode(edge, target);
                  const hidden = flowView.hiddenEdgeIds.includes(edge.id);
                  return (
                    <div
                      key={edge.id}
                      className={cn(
                        'grid grid-cols-[minmax(0,1fr)_auto] gap-1 rounded-md border border-border bg-background px-2.5 py-2 transition-colors hover:border-primary/50 hover:bg-accent',
                        hidden && 'opacity-60',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setEditingFlowEdgeId(edge.id)}
                        className="grid min-w-0 gap-1 text-left"
                      >
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <MousePointer2 className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">
                            {flowEdgeDisplayLabel(edge)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <ArrowRight className="size-3 shrink-0" />
                          <span className="min-w-0 flex-1 truncate">
                            {target?.name ?? edge.toScreenId}
                          </span>
                        </div>
                        <span
                          className={cn(
                            'w-fit rounded-full px-1.5 py-0.5 text-[10px]',
                            hidden && 'bg-muted text-muted-foreground',
                            !hidden && mode === 'overlay' && 'bg-primary/15 text-primary',
                            !hidden && mode === 'setup' && 'bg-warning/10 text-warning',
                            !hidden && mode === 'navigate' && 'bg-success/10 text-success',
                            !hidden && mode === 'diagram' && 'bg-muted text-muted-foreground',
                          )}
                        >
                          {hidden ? 'Hidden in Flow' : transitionStatusLabel(edge, target)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleEdgeHidden(edge.id)}
                        title={hidden ? 'Show connection in Flow' : 'Hide connection in Flow'}
                        className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
