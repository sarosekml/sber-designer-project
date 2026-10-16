import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Check, MessageCircle, Pencil, Trash2, X } from 'lucide-react';
import type { ProjectCommentThread } from '@sber-designer/shared-types';

import { Button } from '@/components/ui/button';
import {
  addProjectComment,
  anchorToPercent,
  commentsForScreen,
  deleteProjectComment,
  normalizedAnchorFromClientPoint,
  updateProjectCommentBody,
} from '@/lib/project-comments';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';

interface DemoCommentsLayerProps {
  screenId: string | null;
  visible: boolean;
  addMode: boolean;
  onAddModeChange: (next: boolean) => void;
}

interface DraftComment {
  anchor: { x: number; y: number };
  body: string;
}

export function DemoCommentsLayer({
  screenId,
  visible,
  addMode,
  onAddModeChange,
}: DemoCommentsLayerProps) {
  const project = useProjectStore((s) => s.project);
  const setProject = useProjectStore((s) => s.setProject);
  const selectedCommentId = useEditorStore((s) => s.selectedCommentId);
  const setSelectedCommentId = useEditorStore((s) => s.setSelectedCommentId);

  const comments = useMemo(
    () => (project ? commentsForScreen(project, screenId) : []),
    [project, screenId],
  );
  const openThread = comments.find((comment) => comment.id === selectedCommentId) ?? null;

  const [draft, setDraft] = useState<DraftComment | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');

  useEffect(() => {
    if (!screenId) {
      setDraft(null);
      setEditingId(null);
      setSelectedCommentId(null);
    }
  }, [screenId, setSelectedCommentId]);

  useEffect(() => {
    if (!selectedCommentId) return;
    const stillExists = comments.some((comment) => comment.id === selectedCommentId);
    if (!stillExists) setSelectedCommentId(null);
  }, [comments, selectedCommentId, setSelectedCommentId]);

  const placeDraft = (event: MouseEvent<HTMLButtonElement>) => {
    if (!screenId) return;
    const anchor = normalizedAnchorFromClientPoint(
      event.currentTarget.getBoundingClientRect(),
      event.clientX,
      event.clientY,
    );
    setDraft({ anchor, body: '' });
    setSelectedCommentId(null);
    setEditingId(null);
    onAddModeChange(false);
  };

  const saveDraft = () => {
    if (!project || !screenId || !draft?.body.trim()) return;
    const next = addProjectComment(project, {
      screenId,
      anchor: draft.anchor,
      body: draft.body,
    });
    const newThread = next.comments?.[next.comments.length - 1] ?? null;
    setProject(next);
    setDraft(null);
    if (newThread) setSelectedCommentId(newThread.id);
  };

  const saveEdit = (thread: ProjectCommentThread) => {
    if (!project || !editBody.trim()) return;
    setProject(updateProjectCommentBody(project, thread.id, editBody));
    setEditingId(null);
  };

  const deleteThread = (thread: ProjectCommentThread) => {
    if (!project) return;
    const confirmed = window.confirm('Delete this comment?');
    if (!confirmed) return;
    setProject(deleteProjectComment(project, thread.id));
    setSelectedCommentId(null);
    setEditingId(null);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {visible &&
        comments.map((thread) => (
          <CommentPin
            key={thread.id}
            thread={thread}
            active={thread.id === selectedCommentId}
            onOpen={() => {
              setDraft(null);
              setEditingId(null);
              setSelectedCommentId(thread.id);
            }}
          />
        ))}

      {visible && openThread && (
        <CommentPopover thread={openThread}>
          {editingId === openThread.id ? (
            <div className="grid gap-2">
              <textarea
                value={editBody}
                onChange={(event) => setEditBody(event.target.value)}
                rows={4}
                className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => saveEdit(openThread)}
                  disabled={!editBody.trim()}
                >
                  <Check className="size-3.5" />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Comment
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedCommentId(null)}
                    className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Close comment"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {openThread.messages[0]?.body}
                </p>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {formatCommentTime(openThread.updatedAt)}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(openThread.id);
                    setEditBody(openThread.messages[0]?.body ?? '');
                  }}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteThread(openThread)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </CommentPopover>
      )}

      {draft && (
        <CommentPopover thread={{ anchor: draft.anchor }}>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                New comment
              </span>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Cancel comment"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <textarea
              value={draft.body}
              onChange={(event) => setDraft({ ...draft, body: event.target.value })}
              rows={4}
              placeholder="Write a comment..."
              className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={saveDraft} disabled={!draft.body.trim()}>
                <MessageCircle className="size-3.5" />
                Save comment
              </Button>
            </div>
          </div>
        </CommentPopover>
      )}

      {addMode && screenId && (
        <button
          type="button"
          aria-label="Place comment"
          className="pointer-events-auto absolute inset-0 z-10 cursor-crosshair bg-primary/5"
          onClick={placeDraft}
        />
      )}
    </div>
  );
}

function CommentPin({
  thread,
  active,
  onOpen,
}: {
  thread: ProjectCommentThread;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'pointer-events-auto absolute z-20 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border shadow-lg transition-transform hover:scale-105',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-white/80 bg-primary text-primary-foreground',
      )}
      style={anchorToPercent(thread.anchor)}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      title={thread.messages[0]?.body ?? 'Comment'}
    >
      <MessageCircle className="size-3.5" />
    </button>
  );
}

function CommentPopover({
  thread,
  children,
}: {
  thread: Pick<ProjectCommentThread, 'anchor'>;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'pointer-events-auto absolute z-30 w-[min(320px,calc(100vw-32px))] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-2xl',
        thread.anchor.x > 0.65 ? '-translate-x-[calc(100%+12px)]' : 'translate-x-3',
        thread.anchor.y > 0.7 ? '-translate-y-[calc(100%-12px)]' : '-translate-y-3',
      )}
      style={popoverAnchorStyle(thread.anchor)}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}

function popoverAnchorStyle(anchor: { x: number; y: number }): CSSProperties {
  return {
    left: `${anchor.x * 100}%`,
    top: `${anchor.y * 100}%`,
  };
}

function formatCommentTime(value: number): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
