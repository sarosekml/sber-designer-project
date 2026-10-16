/** Compact context strip: component/tasks/comments/selection blocks. */
import { useEffect, useRef } from 'react';
import {
  BookOpen,
  Boxes,
  Check,
  ListTodo,
  MessageCircle,
  SquareMousePointer,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type AgentKitInventory } from '@/lib/api-client';
import { buildContextStripMetrics, type ContextStripMetric } from '@/lib/context-strip-metrics';
import { commentsForScreen } from '@/lib/project-comments';
import { tasksForComponentCatalog } from '@/lib/storybook-component-tasks';
import { cn } from '@/lib/utils';
import { useCatalogStore } from '@/stores/catalog-store';
import { useChatStore } from '@/stores/chat-store';
import { useEditorStore, type AssistantTaskIntent } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';
import { resolveTaskContext, tasksForScreen, useTasksStore } from '@/stores/tasks-store';

export function ContextStrip() {
  const catalog = useCatalogStore((s) => s.catalog);
  const canvasView = useEditorStore((s) => s.canvasView);
  const activeComponentId = useEditorStore((s) => s.activeComponentId);
  const selection = useEditorStore((s) => s.selected);
  const selectedCommentId = useEditorStore((s) => s.selectedCommentId);
  const commentContextMode = useEditorStore((s) => s.commentContextMode);
  const commentContextIds = useEditorStore((s) => s.commentContextIds);
  const mode = useEditorStore((s) => s.mode);
  const autoRunArmed = useEditorStore((s) => s.autoRunArmed);
  const taskIntent = useEditorStore((s) => s.assistantTaskIntent);
  const activeScreenId = useEditorStore((s) => s.activeScreenId);
  const project = useProjectStore((s) => s.project);
  const assistantContextSummary = useChatStore((s) => s.lastContextSummary);
  const activeAssistantSession = useChatStore((s) => s.activeSession());
  const tasks = useTasksStore((s) => s.tasks);
  const taskContextMode = useTasksStore((s) => s.taskContextMode);
  const taskContextIds = useTasksStore((s) => s.taskContextIds);
  const activeComponent = activeComponentId
    ? (catalog?.components.find((component) => component.id === activeComponentId) ?? null)
    : null;
  if (canvasView !== 'screen') {
    const componentTasks = tasksForComponentCatalog(tasks, {
      components: catalog?.components ?? [],
      screenNames: project?.screens.map((screen) => screen.name) ?? [],
    });
    const components = catalog?.components.length ?? 0;
    const metrics = buildContextStripMetrics({
      componentsCount: components,
      hasSelection: Boolean(activeComponent),
      currentTaskMessageCount: assistantContextSummary?.includedCount ?? 0,
    });
    const hasContext = components > 0 || activeComponent || componentTasks.length > 0;
    return (
      <div
        className={cn(
          'mx-4 my-2 flex items-center gap-3 rounded-md border px-2.5 py-1.5 text-[11px]',
          hasContext
            ? 'border-primary/30 bg-primary/5 text-foreground'
            : 'border-border bg-card/50 text-muted-foreground',
        )}
        title="Storybook component context sent to the model on every message"
      >
        <ContextMetric metric={metrics[0]} icon={Boxes} />
        <ContextMetric metric={metrics[1]} icon={BookOpen} />
        {componentTasks.length > 0 && (
          <ContextMetric
            metric={{ label: 'Tasks', count: componentTasks.length }}
            icon={ListTodo}
          />
        )}
        <ContextMetric metric={metrics[2]} icon={MessageCircle} />
        <span className="ml-auto rounded-full bg-background/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide">
          Storybook
        </span>
      </div>
    );
  }
  const selectedComment = project?.comments?.find((comment) => comment.id === selectedCommentId);
  const activeComments = project ? commentsForScreen(project, activeScreenId) : [];
  const attachedComments =
    commentContextMode === 'all'
      ? activeComments
      : commentContextMode === 'custom'
        ? activeComments.filter((comment) => commentContextIds.includes(comment.id))
        : [];
  const activeTasks = tasksForScreen(tasks, activeScreenId);
  const attachedTasks = resolveTaskContext(tasks, activeScreenId, taskContextMode, taskContextIds);

  const components = catalog?.components.length ?? 0;
  const metrics = buildContextStripMetrics({
    componentsCount: components,
    hasSelection: Boolean(selection),
    currentTaskMessageCount: assistantContextSummary?.includedCount ?? 0,
  });
  const hasContext =
    components > 0 ||
    selection ||
    attachedComments.length > 0 ||
    selectedComment ||
    attachedTasks.length > 0 ||
    activeAssistantSession ||
    taskIntent ||
    autoRunArmed;

  return (
    <div
      className={cn(
        'mx-4 my-2 flex items-center gap-3 rounded-md border px-2.5 py-1.5 text-[11px]',
        hasContext
          ? 'border-primary/30 bg-primary/5 text-foreground'
          : 'border-border bg-card/50 text-muted-foreground',
      )}
      title="Sent as system context to the model on every message (ADR-0012)"
    >
      <ContextMetric metric={metrics[0]} icon={Boxes} />
      <ContextMetric metric={metrics[1]} icon={SquareMousePointer} />
      {activeComments.length > 0 && (
        <ContextMetric
          metric={{ label: 'Comments', count: attachedComments.length }}
          icon={MessageCircle}
        />
      )}
      {activeTasks.length > 0 && (
        <ContextMetric metric={{ label: 'Tasks', count: attachedTasks.length }} icon={ListTodo} />
      )}
      {autoRunArmed && <ContextMetric metric={{ label: 'Auto mode', count: 1 }} icon={ListTodo} />}
      <ContextMetric metric={metrics[2]} icon={MessageCircle} />
      {taskIntent && (
        <ContextMetric metric={{ label: formatTaskIntent(taskIntent), count: 1 }} icon={Sparkles} />
      )}
      <span className="ml-auto rounded-full bg-background/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide">
        {mode}
      </span>
    </div>
  );
}

function ContextMetric({
  metric,
  icon: Icon,
}: {
  metric: Pick<ContextStripMetric, 'label' | 'count'>;
  icon: LucideIcon;
}) {
  return (
    <span
      className="flex min-w-0 items-center gap-1.5 tabular-nums"
      title={metric.label}
      aria-label={`${metric.label}: ${metric.count}`}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span>{metric.count}</span>
    </span>
  );
}

function formatTaskIntent(intent: AssistantTaskIntent): string {
  if (intent.kind === 'create-screen-from-story') return `creating ${intent.targetName}`;
  if (intent.kind === 'fill-generated-screen') return `building ${intent.targetName}`;
  return 'editing current screen';
}

export function formatActiveAgentTitle(
  agent: AgentKitInventory['agents'][number] | null,
  inventory: AgentKitInventory | null,
): string {
  if (!agent && !inventory) return 'Active agent';
  const lines: string[] = [];
  if (agent) {
    lines.push(`Active agent: ${agent.description}`);
  } else {
    lines.push('Active agent');
  }
  if (inventory) {
    const docs = inventory.knowledge.length;
    const skills = inventory.skills.length;
    const subagents = inventory.agents.filter(
      (candidate) =>
        !candidate.hidden && (candidate.mode === 'subagent' || candidate.mode === 'all'),
    ).length;
    lines.push(
      `Agent kit: ${inventory.defaultAgent.name} · ${subagents} subagent${subagents === 1 ? '' : 's'} · ${skills} skill${skills === 1 ? '' : 's'} · ${docs} doc${docs === 1 ? '' : 's'}`,
    );
    lines.push(`Source: ${inventory.defaultAgent.path}`);
  }
  lines.push('Press Tab to switch.');
  return lines.join('\n');
}

export function ActiveComponentContext() {
  const catalog = useCatalogStore((s) => s.catalog);
  const activeComponentId = useEditorStore((s) => s.activeComponentId);
  const setActiveComponentId = useEditorStore((s) => s.setActiveComponentId);
  const activeComponent = activeComponentId
    ? (catalog?.components.find((component) => component.id === activeComponentId) ?? null)
    : null;
  if (!activeComponent) {
    return (
      <div className="mx-4 mb-2 rounded-md border border-border bg-card/50 px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <BookOpen className="size-3.5 shrink-0 text-primary" />
          <span>Pick a component on the left to focus the agent on it.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-xs">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 font-medium">
          <BookOpen className="size-3.5 shrink-0 text-primary" />
          <span className="truncate">Active component is in context</span>
        </div>
        <button
          type="button"
          onClick={() => setActiveComponentId(null)}
          className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          Clear
        </button>
      </div>
      <div className="grid gap-1 text-[11px] text-muted-foreground">
        <div>
          <span className="text-foreground">{activeComponent.shortName}</span>
          <span className="ml-1"> is the target for the next request.</span>
        </div>
        <div className="truncate font-mono" title={activeComponent.filePath}>
          {activeComponent.filePath}
        </div>
        <div className="truncate" title={activeComponent.title}>
          {activeComponent.title}
        </div>
      </div>
    </div>
  );
}

export function ComponentTasksContext() {
  const catalog = useCatalogStore((s) => s.catalog);
  const project = useProjectStore((s) => s.project);
  const tasks = useTasksStore((s) => s.tasks);
  const taskContextMode = useTasksStore((s) => s.taskContextMode);
  const taskContextIds = useTasksStore((s) => s.taskContextIds);
  const setTaskContextMode = useTasksStore((s) => s.setTaskContextMode);
  const setTaskContextIds = useTasksStore((s) => s.setTaskContextIds);
  const componentTasks = tasksForComponentCatalog(tasks, {
    components: catalog?.components ?? [],
    screenNames: project?.screens.map((screen) => screen.name) ?? [],
  });
  const allIds = componentTasks.map((task) => task.id);
  const includedIds =
    taskContextMode === 'all'
      ? allIds
      : taskContextMode === 'custom'
        ? taskContextIds.filter((id) => allIds.includes(id))
        : [];
  const includedSet = new Set(includedIds);

  const scopeKey = allIds.join('|');
  useEffect(() => {
    setTaskContextMode('all');
    setTaskContextIds([]);
  }, [scopeKey, setTaskContextIds, setTaskContextMode]);

  const applyIncludedIds = (nextIds: string[]) => {
    const unique = Array.from(new Set(nextIds.filter((id) => allIds.includes(id))));
    if (unique.length === 0) {
      setTaskContextMode('none');
      setTaskContextIds([]);
      return;
    }
    if (unique.length === allIds.length) {
      setTaskContextMode('all');
      setTaskContextIds([]);
      return;
    }
    setTaskContextMode('custom');
    setTaskContextIds(unique);
  };

  if (componentTasks.length === 0) return null;

  return (
    <div className="mx-4 mb-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 font-medium">
          <ListTodo className="size-3.5 shrink-0 text-warning" />
          <span className="truncate">Component tasks</span>
        </div>
        <span className="shrink-0 rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {includedIds.length}/{componentTasks.length} in context
        </span>
      </div>
      <div className="grid gap-1.5">
        {componentTasks.map((task) => (
          <label
            key={task.id}
            className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-md border border-warning/40 bg-background px-2 py-1.5 text-left"
            title={task.description ?? task.title}
          >
            <input
              type="checkbox"
              checked={includedSet.has(task.id)}
              onChange={(event) => {
                const next = event.currentTarget.checked
                  ? [...includedIds, task.id]
                  : includedIds.filter((id) => id !== task.id);
                applyIncludedIds(next);
              }}
              className="mt-0.5 size-3 rounded border-border"
            />
            <span className="min-w-0">
              <span className="block truncate font-medium">{task.title}</span>
              {task.description && (
                <span className="block truncate text-[11px] text-muted-foreground">
                  {task.description}
                </span>
              )}
            </span>
            <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-warning/15 px-1.5 text-[10px] uppercase leading-none tracking-wide text-warning">
              {task.source}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function ScreenCommentsContext() {
  const project = useProjectStore((s) => s.project);
  const activeScreenId = useEditorStore((s) => s.activeScreenId);
  const selectedCommentId = useEditorStore((s) => s.selectedCommentId);
  const setSelectedCommentId = useEditorStore((s) => s.setSelectedCommentId);
  const commentContextMode = useEditorStore((s) => s.commentContextMode);
  const commentContextIds = useEditorStore((s) => s.commentContextIds);
  const setCommentContextMode = useEditorStore((s) => s.setCommentContextMode);
  const setCommentContextIds = useEditorStore((s) => s.setCommentContextIds);

  const comments = project ? commentsForScreen(project, activeScreenId) : [];
  if (comments.length === 0) return null;

  const allIds = comments.map((comment) => comment.id);
  const includedIds =
    commentContextMode === 'all'
      ? allIds
      : commentContextMode === 'custom'
        ? commentContextIds.filter((id) => allIds.includes(id))
        : [];
  const includedSet = new Set(includedIds);

  const applyIncludedIds = (nextIds: string[]) => {
    const unique = Array.from(new Set(nextIds.filter((id) => allIds.includes(id))));
    if (unique.length === 0) {
      setCommentContextMode('none');
      setCommentContextIds([]);
      return;
    }
    if (unique.length === allIds.length) {
      setCommentContextMode('all');
      setCommentContextIds([]);
      return;
    }
    setCommentContextMode('custom');
    setCommentContextIds(unique);
  };

  return (
    <div className="mx-4 mb-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-xs">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 font-medium">
          <MessageCircle className="size-3.5 shrink-0 text-primary" />
          <span className="truncate">Comments on this screen</span>
        </div>
        <span className="shrink-0 rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {includedIds.length}/{comments.length} in context
        </span>
      </div>
      <div className="mb-2 flex gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={commentContextMode === 'all' ? 'secondary' : 'ghost'}
          className="h-6 px-2 text-[11px]"
          onClick={() => {
            setCommentContextMode('all');
            setCommentContextIds([]);
          }}
        >
          All
        </Button>
        <Button
          type="button"
          size="sm"
          variant={commentContextMode === 'none' ? 'secondary' : 'ghost'}
          className="h-6 px-2 text-[11px]"
          onClick={() => {
            setCommentContextMode('none');
            setCommentContextIds([]);
          }}
        >
          None
        </Button>
      </div>
      <div className="grid gap-1.5">
        {comments.map((comment, index) => {
          const included = includedSet.has(comment.id);
          const selected = selectedCommentId === comment.id;
          return (
            <button
              key={comment.id}
              type="button"
              onClick={() => {
                const next = included
                  ? includedIds.filter((id) => id !== comment.id)
                  : [...includedIds, comment.id];
                applyIncludedIds(next);
                setSelectedCommentId(comment.id);
              }}
              className={cn(
                'grid grid-cols-[16px_minmax(0,1fr)] gap-2 rounded-md border px-2 py-1.5 text-left transition-colors',
                included
                  ? 'border-primary/30 bg-background text-foreground'
                  : 'border-border/70 bg-background/40 text-muted-foreground',
                selected && 'ring-1 ring-primary/50',
              )}
              title={comment.messages[0]?.body}
            >
              <span
                className={cn(
                  'mt-0.5 flex size-4 items-center justify-center rounded border',
                  included
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/40',
                )}
              >
                {included && <Check className="size-3" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">Comment {index + 1}</span>
                <span className="block truncate text-[11px]">{comment.messages[0]?.body}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ScreenTasksContext() {
  const activeScreenId = useEditorStore((s) => s.activeScreenId);
  const tasks = useTasksStore((s) => s.tasks);
  const taskContextMode = useTasksStore((s) => s.taskContextMode);
  const taskContextIds = useTasksStore((s) => s.taskContextIds);
  const setTaskContextMode = useTasksStore((s) => s.setTaskContextMode);
  const setTaskContextIds = useTasksStore((s) => s.setTaskContextIds);
  const previousScreenRef = useRef<string | null>(activeScreenId);

  const screenTasks = tasksForScreen(tasks, activeScreenId);
  useEffect(() => {
    if (previousScreenRef.current === activeScreenId) return;
    previousScreenRef.current = activeScreenId;
    setTaskContextMode('all');
    setTaskContextIds([]);
  }, [activeScreenId, setTaskContextIds, setTaskContextMode]);

  if (screenTasks.length === 0) return null;

  const allIds = screenTasks.map((task) => task.id);
  const includedIds =
    taskContextMode === 'all'
      ? allIds
      : taskContextMode === 'custom'
        ? taskContextIds.filter((id) => allIds.includes(id))
        : [];
  const includedSet = new Set(includedIds);

  const applyIncludedIds = (nextIds: string[]) => {
    const unique = Array.from(new Set(nextIds.filter((id) => allIds.includes(id))));
    if (unique.length === 0) {
      setTaskContextMode('none');
      setTaskContextIds([]);
      return;
    }
    if (unique.length === allIds.length) {
      setTaskContextMode('all');
      setTaskContextIds([]);
      return;
    }
    setTaskContextMode('custom');
    setTaskContextIds(unique);
  };

  return (
    <div className="mx-4 mb-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 font-medium">
          <ListTodo className="size-3.5 shrink-0 text-warning" />
          <span className="truncate">Tasks for this screen</span>
        </div>
        <span className="shrink-0 rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {includedIds.length}/{screenTasks.length} in context
        </span>
      </div>
      <div className="mb-2 flex gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={taskContextMode === 'all' ? 'secondary' : 'ghost'}
          className="h-6 px-2 text-[11px]"
          onClick={() => {
            setTaskContextMode('all');
            setTaskContextIds([]);
          }}
        >
          All
        </Button>
        <Button
          type="button"
          size="sm"
          variant={taskContextMode === 'none' ? 'secondary' : 'ghost'}
          className="h-6 px-2 text-[11px]"
          onClick={() => {
            setTaskContextMode('none');
            setTaskContextIds([]);
          }}
        >
          None
        </Button>
      </div>
      <div className="grid gap-1.5">
        {screenTasks.map((task) => {
          const included = includedSet.has(task.id);
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => {
                const next = included
                  ? includedIds.filter((id) => id !== task.id)
                  : [...includedIds, task.id];
                applyIncludedIds(next);
              }}
              className={cn(
                'grid grid-cols-[16px_minmax(0,1fr)_auto] gap-2 rounded-md border px-2 py-1.5 text-left transition-colors',
                included
                  ? 'border-warning/40 bg-background text-foreground'
                  : 'border-border/70 bg-background/40 text-muted-foreground',
              )}
              title={task.description ?? task.title}
            >
              <span
                className={cn(
                  'mt-0.5 flex size-4 items-center justify-center rounded border',
                  included
                    ? 'border-warning bg-warning text-warning-foreground'
                    : 'border-muted-foreground/40',
                )}
              >
                {included && <Check className="size-3" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{task.title}</span>
                {task.description && (
                  <span className="block truncate text-[11px]">{task.description}</span>
                )}
              </span>
              <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-warning/15 px-1.5 text-[10px] uppercase leading-none tracking-wide text-warning">
                {task.source}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SelectedElementContext() {
  const selection = useEditorStore((s) => s.selected);
  const setSelected = useEditorStore((s) => s.setSelected);
  if (!selection) return null;

  return (
    <div className="mx-4 mb-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-xs">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 font-medium">
          <SquareMousePointer className="size-3.5 shrink-0 text-primary" />
          <span className="truncate">Selected element is in context</span>
        </div>
        <button
          type="button"
          onClick={() => setSelected(null)}
          title="Clear selection"
          className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="grid gap-1 text-[11px] text-muted-foreground">
        <div>
          <span className="text-foreground">{selection.tagName.toLowerCase()}</span>
          <span className="ml-1">is the target for the next request.</span>
        </div>
        <div className="truncate font-mono" title={selection.loc}>
          {selection.loc}
        </div>
      </div>
    </div>
  );
}
