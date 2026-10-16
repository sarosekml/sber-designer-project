import { Eye, EyeOff, FileText, Monitor, RefreshCw, Rows3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  normalizeFlowView,
  setFlowConnectionsVisible,
  setFlowDescriptionsVisible,
  setFlowPreviewSize,
} from '@/lib/flow-view';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/project-store';

export function FlowToolbar({
  onRefreshPreviews,
  refreshing,
  status,
}: {
  onRefreshPreviews: () => void;
  refreshing: boolean;
  status: string;
}) {
  const project = useProjectStore((s) => s.project);
  const setProject = useProjectStore((s) => s.setProject);
  const view = normalizeFlowView(project?.flowView);

  const updateFlowView = (next: ReturnType<typeof normalizeFlowView>) => {
    if (!project) return;
    setProject({ ...project, flowView: next });
  };

  return (
    <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-md border border-border bg-card/95 p-1 text-xs shadow-lg backdrop-blur">
      <div className="flex overflow-hidden rounded border border-border">
        <ToolbarSegment
          active={view.previewSize === 'compact'}
          title="Compact previews"
          onClick={() => updateFlowView(setFlowPreviewSize(view, 'compact'))}
        >
          <Rows3 className="size-3.5" />
          Compact
        </ToolbarSegment>
        <ToolbarSegment
          active={view.previewSize === 'frames'}
          title="Full screen frames"
          onClick={() => updateFlowView(setFlowPreviewSize(view, 'frames'))}
        >
          <Monitor className="size-3.5" />
          Frames
        </ToolbarSegment>
      </div>
      <Button
        type="button"
        size="sm"
        variant={view.showConnections ? 'secondary' : 'ghost'}
        className="h-7 px-2 text-xs"
        onClick={() => updateFlowView(setFlowConnectionsVisible(view, !view.showConnections))}
        title={view.showConnections ? 'Hide connections' : 'Show connections'}
        disabled={!project}
      >
        {view.showConnections ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        Connections
      </Button>
      <Button
        type="button"
        size="sm"
        variant={view.showDescriptions ? 'secondary' : 'ghost'}
        className="h-7 px-2 text-xs"
        onClick={() => updateFlowView(setFlowDescriptionsVisible(view, !view.showDescriptions))}
        title={view.showDescriptions ? 'Hide notes' : 'Show notes'}
        disabled={!project}
      >
        <FileText className="size-3.5" />
        Notes
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="h-7 w-7"
        title={status}
        onClick={onRefreshPreviews}
        disabled={!project || refreshing}
      >
        <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
      </Button>
      <span className="max-w-40 truncate px-1.5 text-[10px] text-muted-foreground">{status}</span>
    </div>
  );
}

function ToolbarSegment({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 px-2 text-xs transition-colors',
        active ? 'bg-secondary text-secondary-foreground' : 'bg-background hover:bg-accent',
      )}
    >
      {children}
    </button>
  );
}
