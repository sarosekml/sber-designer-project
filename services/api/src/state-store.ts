/**
 * Latest-wins KV for "editor state" — selection, mode, canvasUrl, etc.
 *
 * Shape mirrors the editor-store on the frontend, but only the slices
 * proj-mcp tools actually need. Anything not in this allow-list is not
 * exposed (privacy by default).
 *
 * In-memory single-process for PoC. Phase 4 — Postgres + per-project shard.
 */
import { z } from 'zod';
import { resolve } from 'node:path';

import { requestWorkspacePath } from './workspace-context';

export const SelectedNodeSchema = z
  .object({
    loc: z.string(),
    sourceKind: z.enum(['react-source', 'sd-loc', 'dom-fallback']).optional(),
    domPath: z.string().optional(),
    componentPath: z.array(z.string()).optional(),
    tagName: z.string(),
    text: z.string().optional(),
    selector: z.string().optional(),
    componentName: z.string().optional(),
    componentLoc: z.string().optional(),
    attributes: z.record(z.string()).optional(),
    selectionNotice: z.string().optional(),
    inspectId: z.string().optional(),
    computedStyles: z.record(z.string()).optional(),
    rect: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    }),
  })
  .strict();

export const ActiveScreenSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(['story', 'page']),
    surface: z.enum(['page', 'modal']).optional(),
    storyId: z.string().optional(),
    filePath: z.string().optional(),
    implementationFilePath: z.string().optional(),
    folder: z.string().optional(),
    description: z.string().optional(),
  })
  .strict();

export const StoryEntrySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    previewUrl: z.string(),
    description: z.string().optional(),
  })
  .passthrough();

export const ActiveComponentSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    shortName: z.string(),
    filePath: z.string(),
    description: z.string().optional(),
    stories: z.array(StoryEntrySchema),
  })
  .passthrough();

export const SelectedCommentSchema = z
  .object({
    id: z.string(),
    screenId: z.string(),
    body: z.string(),
    anchor: z.object({
      x: z.number(),
      y: z.number(),
    }),
    status: z.enum(['open', 'resolved']),
    selector: z.string().optional(),
    elementText: z.string().optional(),
  })
  .strict();

export const ProjectTaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    url: z.string().optional(),
    source: z.enum(['linear', 'jira', 'comment']),
    screenIds: z.array(z.string()),
    commentId: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
  })
  .strict();

export const AssistantTaskIntentSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('edit-current-screen'),
      targetScreenId: z.string(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('create-screen-from-story'),
      targetScreenId: z.string(),
      sourceStoryId: z.string(),
      sourceStoryFilePath: z.string().optional(),
      targetName: z.string(),
      targetFolder: z.string(),
      targetStoryFilePath: z.string(),
      targetImplementationFilePath: z.string().optional(),
      targetStoryId: z.string(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('fill-generated-screen'),
      targetScreenId: z.string(),
      targetName: z.string(),
      targetFolder: z.string(),
      targetStoryFilePath: z.string(),
      targetImplementationFilePath: z.string().optional(),
      targetStoryId: z.string(),
    })
    .strict(),
]);

export const VisualDesignContextSchema = z
  .object({
    draftChanges: z
      .array(
        z
          .object({
            kind: z.string(),
            label: z.string(),
            filePath: z.string().optional(),
            loc: z
              .object({
                line: z.number(),
                column: z.number(),
              })
              .optional(),
          })
          .passthrough(),
      )
      .max(64),
  })
  .strict();

const ScreenReadinessCategorySelectionSchema = z
  .object({
    sourceIntegrity: z.boolean().optional(),
    renderHealth: z.boolean().optional(),
    designSystemFit: z.boolean().optional(),
    dataHonesty: z.boolean().optional(),
    operationalUxStates: z.boolean().optional(),
    accessibilityBasics: z.boolean().optional(),
    responsiveVisualSanity: z.boolean().optional(),
    designModeCompatibility: z.boolean().optional(),
  })
  .strict();

export const ScreenReadinessProfileSchema = z
  .object({
    enabled: z.boolean().optional(),
    profile: z.enum(['standard', 'strict', 'custom']).optional(),
    categories: ScreenReadinessCategorySelectionSchema.optional(),
  })
  .strict();

/**
 * Canvas iframe src values are browser URLs. Project previews are usually
 * absolute localhost URLs, while the bundled demo fallback is root-relative.
 */
export const CanvasUrlSchema = z.preprocess(
  (value) => (value === '' ? null : value),
  z.string().min(1).nullable(),
);

export const EditorStateSchema = z
  .object({
    mode: z.enum(['interact', 'design', 'code']).optional(),
    canvasView: z.enum(['screen', 'storybook', 'design-system']).optional(),
    selection: SelectedNodeSchema.nullable().optional(),
    projectName: z.string().nullable().optional(),
    projectInstructions: z.string().nullable().optional(),
    activeScreen: ActiveScreenSchema.nullable().optional(),
    activeComponent: ActiveComponentSchema.nullable().optional(),
    selectedComment: SelectedCommentSchema.nullable().optional(),
    commentContext: z.array(SelectedCommentSchema).optional(),
    taskContext: z.array(ProjectTaskSchema).optional(),
    assistantTaskIntent: AssistantTaskIntentSchema.nullable().optional(),
    visualDesign: VisualDesignContextSchema.optional(),
    agentCraftPostCheckEnabled: z.boolean().optional(),
    screenReadiness: ScreenReadinessProfileSchema.optional(),
    storybookReloadPending: z.boolean().optional(),
    canvasUrl: CanvasUrlSchema.optional(),
    workspacePath: z.string().nullable().optional(),
  })
  .strict();

export type EditorState = z.infer<typeof EditorStateSchema>;

type Listener = (next: EditorState, prev: EditorState) => void;

interface ScopedListener {
  fn: Listener;
  workspaceKey: string | null;
}

const DEFAULT_WORKSPACE_KEY = '__default__';
const states = new Map<string, EditorState>();
const listeners = new Set<ScopedListener>();
let activeWorkspaceKey = DEFAULT_WORKSPACE_KEY;

export function getState(workspacePath?: string | null): EditorState {
  return states.get(workspaceKey(workspacePath)) ?? {};
}

export function listStateWorkspacePaths(): string[] {
  return Array.from(states.keys()).filter((key) => key !== DEFAULT_WORKSPACE_KEY);
}

export function patchState(patch: EditorState, workspacePath?: string | null): EditorState {
  const key = workspaceKey(workspacePath ?? patch.workspacePath);
  const prev = states.get(key) ?? {};
  const next = { ...prev, ...patch };
  states.set(key, next);
  if (key !== DEFAULT_WORKSPACE_KEY) activeWorkspaceKey = key;
  notifyListeners(key, next, prev);
  return next;
}

export function resetState(workspacePath?: string | null): void {
  if (workspacePath !== undefined) {
    const key = workspaceKey(workspacePath);
    const prev = states.get(key) ?? {};
    states.delete(key);
    if (activeWorkspaceKey === key) activeWorkspaceKey = DEFAULT_WORKSPACE_KEY;
    notifyListeners(key, {}, prev);
    return;
  }
  const prev = states.get(activeWorkspaceKey) ?? {};
  states.clear();
  activeWorkspaceKey = DEFAULT_WORKSPACE_KEY;
  notifyListeners(DEFAULT_WORKSPACE_KEY, {}, prev);
}

/** Subscribe to state-store changes. Omit workspacePath for every workspace. */
export function subscribeState(fn: Listener, workspacePath?: string | null): () => void {
  const listener: ScopedListener = {
    fn,
    workspaceKey: workspacePath === undefined ? null : workspaceKey(workspacePath),
  };
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(key: string, next: EditorState, prev: EditorState): void {
  for (const listener of listeners) {
    if (listener.workspaceKey && listener.workspaceKey !== key) continue;
    try {
      listener.fn(next, prev);
    } catch {
      // listeners must not break each other
    }
  }
}

function workspaceKey(workspacePath: string | null | undefined): string {
  if (workspacePath?.trim()) return resolve(workspacePath);
  const contextual = requestWorkspacePath();
  if (contextual !== undefined) {
    return contextual?.trim() ? resolve(contextual) : DEFAULT_WORKSPACE_KEY;
  }
  return activeWorkspaceKey;
}
