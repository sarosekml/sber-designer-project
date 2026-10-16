/** Active background assistant runs strip. */
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageCircle,
  Square,
  X,
} from 'lucide-react';
import { type AssistantActiveRun, type ProjectScreen } from '@sber-designer/shared-types';
import { Button } from '@/components/ui/button';
import { cancelAgentRun } from '@/lib/api-client';
import type { AgentPermissionRequest } from '@/lib/api-client';
import { useAssistantRunStore } from '@/stores/assistant-run-store';

export function BackgroundRunsStrip({
  runs,
  pendingPermissionsByRunId = {},
  projectScreens,
  activeRunCount = runs.length,
  onOpenRun,
  onStopRun,
}: {
  runs: AssistantActiveRun[];
  pendingPermissionsByRunId?: Record<string, AgentPermissionRequest>;
  projectScreens: ProjectScreen[];
  activeRunCount?: number;
  onOpenRun: (run: AssistantActiveRun) => void;
  onStopRun: (run: AssistantActiveRun) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const visibleRuns = expanded ? runs : runs.slice(0, 3);
  const hiddenCount = Math.max(0, runs.length - visibleRuns.length);
  const showWarning = shouldShowHighConcurrencyWarning(activeRunCount, warningDismissed);

  useEffect(() => {
    if (activeRunCount <= HIGH_CONCURRENCY_THRESHOLD) setWarningDismissed(false);
  }, [activeRunCount]);

  return (
    <div className="mx-4 mb-2 grid gap-1 rounded-md border border-border bg-card px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2 pb-0.5 text-[10px] text-muted-foreground">
        <span>{activeRunCount} active</span>
        {runs.length > 3 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-5 px-1.5 text-[10px]"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            {expanded ? 'Show less' : 'View all'}
          </Button>
        )}
      </div>
      {showWarning && (
        <div
          aria-live="polite"
          className="mb-1 flex items-start gap-2 rounded border border-warning/35 bg-warning/10 px-2 py-1.5 text-[11px] text-foreground"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-warning" />
          <span className="min-w-0 flex-1">
            <span className="font-medium">High concurrent activity</span> · {activeRunCount}{' '}
            assistant runs are active. Responses and preview updates may slow down.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="-mr-1 -mt-1 size-6 shrink-0"
            aria-label="Dismiss high concurrent activity warning"
            onClick={() => setWarningDismissed(true)}
          >
            <X className="size-3" />
          </Button>
        </div>
      )}
      {visibleRuns.map((run) => {
        const screenName =
          projectScreens.find((screen) => screen.id === run.screenId)?.name ?? run.screenId;
        const waitingForPermission = Boolean(
          (run.runId ? pendingPermissionsByRunId[run.runId] : null) ??
          pendingPermissionsByRunId[run.clientRunId],
        );
        return (
          <div
            key={run.clientRunId}
            className="flex min-w-0 items-center gap-2 text-muted-foreground"
          >
            {waitingForPermission ? (
              <AlertCircle className="size-3 text-warning" />
            ) : (
              <Loader2 className="size-3 animate-spin text-primary" />
            )}
            <span className="min-w-0 flex-1 truncate">
              {waitingForPermission ? 'Waiting for permission on ' : 'Assistant running on '}
              <span className="text-foreground">{screenName}</span>
              {run.displayName ? ` · ${run.displayName}` : ''}
            </span>
            <span className="shrink-0 font-mono text-[10px] uppercase">{run.status}</span>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => onOpenRun(run)}
              title={`Open ${screenName} task`}
              className="h-6 w-6 shrink-0"
            >
              <MessageCircle className="size-3" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => onStopRun(run)}
              title={`Stop ${screenName} task`}
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Square className="size-3" />
            </Button>
          </div>
        );
      })}
      {hiddenCount > 0 && (
        <div className="text-[10px] text-muted-foreground">
          +{hiddenCount} more background run{hiddenCount === 1 ? '' : 's'}
        </div>
      )}
    </div>
  );
}

export const HIGH_CONCURRENCY_THRESHOLD = 5;

export function shouldShowHighConcurrencyWarning(
  activeRunCount: number,
  dismissed: boolean,
): boolean {
  return activeRunCount > HIGH_CONCURRENCY_THRESHOLD && !dismissed;
}

export function stopAssistantRun(run: AssistantActiveRun): void {
  useAssistantRunStore.getState().updateRun(run.clientRunId, { status: 'stopping' });
  const localCancelled = useAssistantRunStore.getState().cancelLocal(run.clientRunId);
  const serverRunId = run.runId ?? run.clientRunId;
  void cancelAgentRun(serverRunId).catch(() => {
    if (!localCancelled) {
      useAssistantRunStore.getState().finishRun(run.clientRunId);
    }
  });
}

export function isInteractiveRunStatus(status: AssistantActiveRun['status']): boolean {
  return status === 'queued' || status === 'running' || status === 'stopping';
}
