import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, GitPullRequestArrow, ListTodo, Loader2, RefreshCw } from 'lucide-react';
import type { ProjectTask } from '@sber-designer/shared-types';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';
import { useTasksStore } from '@/stores/tasks-store';

interface AutoModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when user clicks Start - kicks off the autonomous loop. */
  onStart: (selectedTaskIds: string[]) => Promise<void>;
}

export function AutoModeDialog({ open, onOpenChange, onStart }: AutoModeDialogProps) {
  const project = useProjectStore((s) => s.project);
  const session = useSandboxStore((s) => s.session);
  const tasks = useTasksStore((s) => s.tasks);
  const loading = useTasksStore((s) => s.loading);
  const error = useTasksStore((s) => s.error);
  const sync = useTasksStore((s) => s.sync);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    void sync();
  }, [open, sync]);

  useEffect(() => {
    if (!open) return;
    setSelectedIds(tasks.map((task) => task.id));
  }, [open, tasks]);

  const grouped = useMemo(
    () => groupTasks(tasks, project?.screens ?? []),
    [project?.screens, tasks],
  );
  const selectedSet = new Set(selectedIds);
  const screenCount = new Set(tasks.flatMap((task) => task.screenIds)).size;
  const warning = session
    ? project?.agentAutoPr
      ? 'The agent will make code changes and open one PR per task. Review each task before starting.'
      : "The agent will make code changes. You'll create PRs manually when ready."
    : 'The agent will make code changes. Connect a git repo in Settings to enable PR creation.';

  const toggleTask = (taskId: string) => {
    setSelectedIds((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId],
    );
  };

  const start = async () => {
    if (selectedIds.length === 0 || starting) return;
    setStarting(true);
    try {
      await onStart(selectedIds);
      onOpenChange(false);
    } finally {
      setStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review autonomous tasks</DialogTitle>
          <DialogDescription>
            Pick the tasks the agent should execute. Auto mode runs one task at a time.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-warning/35 bg-warning/10 px-3 py-2 text-xs">
          <div className="flex gap-2">
            <GitPullRequestArrow className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <span>{warning}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <ListTodo className="size-4 text-primary" />
            {loading
              ? 'Loading tasks...'
              : `${tasks.length} tasks found across ${screenCount} screens`}
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || starting}
            onClick={() => void sync()}
          >
            {loading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            Retry
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
            {error}
          </div>
        )}

        <div className="max-h-[420px] overflow-y-auto rounded-md border border-border bg-background">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Fetching tracker and comment tasks...
            </div>
          ) : tasks.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              No tasks found. Add open screen comments or connect Linear/Jira in Project settings.
            </div>
          ) : (
            <div className="grid">
              {grouped.map((group, groupIndex) => (
                <div key={group.id}>
                  {groupIndex > 0 && <Separator />}
                  <div className="bg-muted/30 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {group.name}
                  </div>
                  <div className="grid gap-1 p-2">
                    {group.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        checked={selectedSet.has(task.id)}
                        screenName={group.name}
                        onToggle={() => toggleTask(task.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" disabled={starting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={selectedIds.length === 0 || starting}
            onClick={() => void start()}
          >
            {starting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ListTodo className="size-3.5" />
            )}
            Start autonomous run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskRow({
  task,
  checked,
  screenName,
  onToggle,
}: {
  task: ProjectTask;
  checked: boolean;
  screenName: string;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        'grid cursor-pointer grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-2 rounded-md border px-2 py-2 text-xs transition-colors',
        checked
          ? 'border-primary/35 bg-primary/5 text-foreground'
          : 'border-border bg-card/50 text-muted-foreground',
      )}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-0.5 size-3.5" />
      <span className="min-w-0">
        <span className="block truncate font-medium">{task.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <SourceBadge source={task.source} />
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {screenName}
          </span>
          {task.status && <span className="text-[10px] text-muted-foreground">{task.status}</span>}
        </span>
      </span>
      {task.url && (
        <a
          href={task.url}
          target="_blank"
          rel="noreferrer"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={(event) => event.stopPropagation()}
          title="Open task"
        >
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </label>
  );
}

function SourceBadge({ source }: { source: ProjectTask['source'] }) {
  return (
    <span className="inline-flex h-5 items-center rounded-full bg-warning/15 px-1.5 text-[10px] font-medium uppercase leading-none tracking-wide text-warning">
      {source}
    </span>
  );
}

function groupTasks(tasks: ProjectTask[], screens: { id: string; name: string }[]) {
  const byScreen = new Map(
    screens.map((screen) => [screen.id, { ...screen, tasks: [] as ProjectTask[] }]),
  );
  const unassigned: ProjectTask[] = [];
  for (const task of tasks) {
    const firstScreenId = task.screenIds.find((screenId) => byScreen.has(screenId));
    if (!firstScreenId) {
      unassigned.push(task);
      continue;
    }
    byScreen.get(firstScreenId)?.tasks.push(task);
  }
  return [
    ...Array.from(byScreen.values())
      .filter((group) => group.tasks.length > 0)
      .map((group) => ({ id: group.id, name: group.name, tasks: group.tasks })),
    ...(unassigned.length > 0
      ? [{ id: 'unassigned', name: 'Unassigned to screen', tasks: unassigned }]
      : []),
  ];
}
