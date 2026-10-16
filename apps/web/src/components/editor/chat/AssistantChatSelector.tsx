/** Assistant session selector with history menu. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Check, MessageCircle, PlusCircle, Trash2 } from 'lucide-react';
import type { ProjectAssistantSession } from '@sber-designer/shared-types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  DESIGN_SYSTEM_ASSISTANT_SCREEN_ID,
  GLOBAL_ASSISTANT_SCREEN_ID,
  STORYBOOK_ASSISTANT_SCREEN_ID,
  useChatStore,
} from '@/stores/chat-store';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';

export function AssistantChatSelector({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<ProjectAssistantSession | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const canvasView = useEditorStore((s) => s.canvasView);
  const activeScreenId = useEditorStore((s) => s.activeScreenId);
  const project = useProjectStore((s) => s.project);
  const assistantSessions = useChatStore((s) => s.assistant.sessions);
  const chatActiveScreenId = useChatStore((s) => s.activeScreenId);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const activeSession = useChatStore((s) => s.activeSession());
  const startNewTask = useChatStore((s) => s.startNewTask);
  const restoreTask = useChatStore((s) => s.restoreTask);
  const retargetTaskToScreen = useChatStore((s) => s.retargetTaskToScreen);
  const deleteTask = useChatStore((s) => s.deleteTask);
  const activeScreen = project?.screens.find((screen) => screen.id === activeScreenId) ?? null;
  const targetScreenId =
    canvasView === 'storybook'
      ? STORYBOOK_ASSISTANT_SCREEN_ID
      : canvasView === 'design-system'
        ? DESIGN_SYSTEM_ASSISTANT_SCREEN_ID
        : (activeScreenId ?? chatActiveScreenId ?? GLOBAL_ASSISTANT_SCREEN_ID);
  const scopeLabel =
    canvasView === 'screen'
      ? (activeScreen?.name ?? 'No screen')
      : canvasView === 'design-system'
        ? 'Design system chat'
        : 'Storybook chat';
  const chatLabel = activeSession?.title ?? 'New task';
  const sessions = useMemo(
    () =>
      assistantSessions
        .filter(
          (session) =>
            session.primaryScreenId === targetScreenId &&
            (session.messages.length > 0 || session.id === activeSessionId),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [activeSessionId, assistantSessions, targetScreenId],
  );
  const screenNameById = useMemo(
    () => new Map((project?.screens ?? []).map((screen) => [screen.id, screen.name])),
    [project?.screens],
  );
  const continuationSessions = useMemo(() => {
    if (
      canvasView !== 'screen' ||
      !targetScreenId ||
      targetScreenId === GLOBAL_ASSISTANT_SCREEN_ID
    ) {
      return [];
    }
    return assistantSessions
      .filter(
        (session) =>
          session.primaryScreenId !== targetScreenId &&
          (session.messages.length > 0 || Boolean(session.summary?.trim())),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 5);
  }, [assistantSessions, canvasView, targetScreenId]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleNewTask = () => {
    startNewTask(targetScreenId);
    setOpen(false);
  };

  return (
    <>
      <div ref={menuRef} className="relative border-b border-border bg-card/35 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen((value) => !value)}
            className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-left text-xs transition-colors enabled:hover:bg-accent enabled:hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60"
            title={`${scopeLabel} · ${chatLabel}`}
          >
            <MessageCircle className="size-3.5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{chatLabel}</span>
              <span className="block truncate text-[10px] text-muted-foreground">{scopeLabel}</span>
            </span>
            <ChevronDown
              className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-180')}
            />
          </button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={disabled}
            onClick={handleNewTask}
            title="New task"
            className="h-8 w-8 shrink-0"
          >
            <PlusCircle className="size-3.5" />
          </Button>
        </div>

        {open && (
          <div className="absolute left-4 right-4 top-[calc(100%-4px)] z-50 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
            <button
              type="button"
              disabled={disabled}
              onClick={handleNewTask}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors enabled:hover:bg-accent enabled:hover:text-accent-foreground disabled:opacity-60"
            >
              <PlusCircle className="size-3.5 text-primary" />
              <span className="font-medium">New task</span>
            </button>
            <div className="border-t border-border px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              History
            </div>
            <div className="max-h-72 overflow-y-auto p-1">
              {sessions.length === 0 ? (
                <div className="px-2 py-3 text-xs text-muted-foreground">No tasks yet</div>
              ) : (
                sessions.map((session) => {
                  const active = session.id === activeSessionId;
                  const last = [...session.messages]
                    .reverse()
                    .find((message) => message.content.trim());
                  return (
                    <div
                      key={session.id}
                      className={cn(
                        'group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-md',
                        active && 'bg-primary/10',
                      )}
                    >
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          restoreTask(session.id);
                          setOpen(false);
                        }}
                        className="flex min-w-0 items-start gap-2 px-2 py-2 text-left text-xs transition-colors enabled:hover:bg-accent enabled:hover:text-accent-foreground disabled:opacity-60"
                        title={session.title}
                      >
                        <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                          {active ? (
                            <Check className="size-3.5 text-primary" />
                          ) : (
                            <MessageCircle className="size-3.5 text-muted-foreground" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate font-medium">{session.title}</span>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {formatSessionTime(session.updatedAt)}
                            </span>
                          </span>
                          {last && (
                            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                              {last.content}
                            </span>
                          )}
                        </span>
                      </button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={disabled}
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteCandidate(session);
                          setOpen(false);
                        }}
                        title="Delete task"
                        className="mr-1 h-7 w-7 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
            {continuationSessions.length > 0 && (
              <>
                <div className="border-t border-border px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Continue here
                </div>
                <div className="max-h-52 overflow-y-auto p-1">
                  {continuationSessions.map((session) => {
                    const last = [...session.messages]
                      .reverse()
                      .find((message) => message.content.trim());
                    const sourceName =
                      screenNameById.get(session.primaryScreenId) ?? session.primaryScreenId;
                    return (
                      <button
                        key={session.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          retargetTaskToScreen(session.id, targetScreenId, {
                            targetScreenName: activeScreen?.name ?? targetScreenId,
                          });
                          setOpen(false);
                        }}
                        className="flex w-full min-w-0 items-start gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors enabled:hover:bg-accent enabled:hover:text-accent-foreground disabled:opacity-60"
                        title={`Continue "${session.title}" on ${scopeLabel}`}
                      >
                        <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate font-medium">{session.title}</span>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              from {sourceName}
                            </span>
                          </span>
                          {last && (
                            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                              {last.content}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <Dialog
        open={deleteCandidate !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteCandidate(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete chat?</DialogTitle>
            <DialogDescription>
              Delete "{deleteCandidate?.title ?? 'this chat'}" from {scopeLabel}. This removes its
              transcript from project history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteCandidate(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={disabled}
              onClick={() => {
                if (!deleteCandidate) return;
                deleteTask(deleteCandidate.id);
                setDeleteCandidate(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * One-line summary of what gets attached to the LLM call as system
 * context (ADR-0012). Reflects what the user can see in the editor —
 * makes it obvious that the agent is grounded in the actual project.
 */

function formatSessionTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
