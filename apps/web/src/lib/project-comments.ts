import type { ProjectCommentThread, SberDesignerProject } from '@sber-designer/shared-types';

interface ClockAndIds {
  now?: () => number;
  id?: () => string;
}

interface AddProjectCommentInput {
  screenId: string;
  anchor: { x: number; y: number };
  body: string;
  selector?: string;
  elementText?: string;
  authorName?: string;
}

interface CommentsForScreenOptions {
  includeResolved?: boolean;
}

export type CommentContextMode = 'all' | 'custom' | 'none';

interface ClientRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function addProjectComment(
  project: SberDesignerProject,
  input: AddProjectCommentInput,
  deps: ClockAndIds = {},
): SberDesignerProject {
  const body = input.body.trim();
  if (!body) return project;

  const now = deps.now?.() ?? Date.now();
  const id = deps.id?.() ?? randomCommentId();
  const thread: ProjectCommentThread = {
    id,
    screenId: input.screenId,
    anchor: clampAnchor(input.anchor),
    ...(input.selector ? { selector: input.selector } : {}),
    ...(input.elementText ? { elementText: compactWhitespace(input.elementText, 220) } : {}),
    status: 'open',
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: `${id}-message`,
        authorName: input.authorName?.trim() || 'You',
        body,
        createdAt: now,
      },
    ],
  };

  return {
    ...project,
    comments: [...(project.comments ?? []), thread],
  };
}

export function updateProjectCommentBody(
  project: SberDesignerProject,
  commentId: string,
  body: string,
  deps: Pick<ClockAndIds, 'now'> = {},
): SberDesignerProject {
  const nextBody = body.trim();
  if (!nextBody) return project;
  const now = deps.now?.() ?? Date.now();
  return {
    ...project,
    comments: (project.comments ?? []).map((thread) => {
      if (thread.id !== commentId) return thread;
      const [first, ...rest] = thread.messages;
      if (!first) return thread;
      return {
        ...thread,
        updatedAt: now,
        messages: [{ ...first, body: nextBody, updatedAt: now }, ...rest],
      };
    }),
  };
}

export function deleteProjectComment(
  project: SberDesignerProject,
  commentId: string,
): SberDesignerProject {
  return {
    ...project,
    comments: (project.comments ?? []).filter((thread) => thread.id !== commentId),
  };
}

export function setProjectCommentStatus(
  project: SberDesignerProject,
  commentId: string,
  status: ProjectCommentThread['status'],
  deps: Pick<ClockAndIds, 'now'> = {},
): SberDesignerProject {
  const now = deps.now?.() ?? Date.now();
  return {
    ...project,
    comments: (project.comments ?? []).map((thread) =>
      thread.id === commentId ? { ...thread, status, updatedAt: now } : thread,
    ),
  };
}

export function commentsForScreen(
  project: Pick<SberDesignerProject, 'comments'>,
  screenId: string | null | undefined,
  options: CommentsForScreenOptions = {},
): ProjectCommentThread[] {
  if (!screenId) return [];
  return (project.comments ?? []).filter((thread) => {
    if (thread.screenId !== screenId) return false;
    if (!options.includeResolved && thread.status === 'resolved') return false;
    return true;
  });
}

export function resolveCommentContext(
  project: Pick<SberDesignerProject, 'comments'>,
  screenId: string | null | undefined,
  mode: CommentContextMode,
  ids: readonly string[],
): ProjectCommentThread[] {
  const comments = commentsForScreen(project, screenId);
  if (mode === 'none') return [];
  if (mode === 'all') return comments;
  const idSet = new Set(ids);
  return comments.filter((thread) => idSet.has(thread.id));
}

export function normalizedAnchorFromClientPoint(
  rect: ClientRectLike,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  return clampAnchor({
    x: rect.width > 0 ? (clientX - rect.left) / rect.width : 0,
    y: rect.height > 0 ? (clientY - rect.top) / rect.height : 0,
  });
}

export function anchorToPercent(anchor: { x: number; y: number }): { left: string; top: string } {
  const clamped = clampAnchor(anchor);
  return {
    left: `${(clamped.x * 100).toFixed(4)}%`,
    top: `${(clamped.y * 100).toFixed(4)}%`,
  };
}

function clampAnchor(anchor: { x: number; y: number }): { x: number; y: number } {
  return {
    x: clamp01(anchor.x),
    y: clamp01(anchor.y),
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function randomCommentId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `comment-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function compactWhitespace(value: string, max: number): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1).trim()}…`;
}
