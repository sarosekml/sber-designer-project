/** Stream-chat request schemas and editor-context resolution. */
import { z } from 'zod';
import { AgentKitSkillNameSchema } from '../../agent-kit/schema';
import { GenerationOptionsSchema } from '../../generation-mode';
import { PromptAttachmentUploadSchema } from '../../prompt-attachments';
import { EditorStateSchema, type EditorState } from '../../state-store';

const ContentPartSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }).strict(),
  z
    .object({
      type: z.literal('image_url'),
      image_url: z
        .object({
          url: z.string().min(1),
          detail: z.enum(['auto', 'low', 'high']).optional(),
        })
        .strict(),
    })
    .strict(),
]);

const ChatEditorContextSchema = EditorStateSchema.pick({
  mode: true,
  canvasView: true,
  selection: true,
  projectName: true,
  projectInstructions: true,
  activeScreen: true,
  activeComponent: true,
  selectedComment: true,
  commentContext: true,
  taskContext: true,
  assistantTaskIntent: true,
  visualDesign: true,
  agentCraftPostCheckEnabled: true,
  screenReadiness: true,
  canvasUrl: true,
  workspacePath: true,
});

const CHAT_EDITOR_CONTEXT_FIELDS = [
  'mode',
  'canvasView',
  'selection',
  'projectName',
  'projectInstructions',
  'activeScreen',
  'activeComponent',
  'selectedComment',
  'commentContext',
  'taskContext',
  'assistantTaskIntent',
  'visualDesign',
  'agentCraftPostCheckEnabled',
  'screenReadiness',
  'canvasUrl',
  'workspacePath',
] as const satisfies readonly (keyof EditorState)[];

/**
 * POST /api/chat/stream — agent loop with Server-Sent Events.
 *
 * Same input shape as /api/chat. Response is SSE: each `data:` frame
 * carries one AgentStreamEvent JSON. The browser reads these and
 * progressively renders the transcript without waiting for the agent
 * loop to finish (Phase 2.5).
 *
 * Errors that prevent starting the stream return JSON 4xx as usual.
 * Errors that happen mid-stream are emitted as `{ type: 'error' }`
 * events and the connection closes.
 */

export const StreamChatRequestSchema = z
  .object({
    messages: z
      .array(
        z
          .object({
            role: z.enum(['system', 'user', 'assistant', 'tool']),
            content: z.union([z.string(), z.array(ContentPartSchema).min(1)]),
            toolCallId: z.string().optional(),
            toolCalls: z
              .array(
                z
                  .object({
                    id: z.string(),
                    name: z.string(),
                    arguments: z.string(),
                  })
                  .strict(),
              )
              .optional(),
          })
          .strict(),
      )
      .min(1),
    provider: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    primaryAgent: AgentKitSkillNameSchema.optional(),
    agent: AgentKitSkillNameSchema.optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
    maxIterations: z.number().int().min(1).max(20).optional(),
    attachments: z.array(PromptAttachmentUploadSchema).max(4).default([]),
    attachContext: z.boolean().default(true),
    enableTools: z.boolean().default(true),
    clientRunId: z.string().min(1).optional(),
    sessionId: z.string().min(1).optional(),
    screenId: z.string().min(1).optional(),
    generation: GenerationOptionsSchema.optional(),
    sessionMode: z.enum(['ask', 'plan', 'design']).default('design'),
    editorContext: ChatEditorContextSchema.optional(),
  })
  .strict();

export const ResolvePermissionSchema = z
  .object({
    decision: z.enum(['allow', 'deny']),
    remember: z.boolean().optional(),
  })
  .strict();

export type ChatEditorContext = z.infer<typeof ChatEditorContextSchema>;

export function resolveInitialEditorStateForChat(
  serverState: EditorState,
  editorContext: ChatEditorContext | undefined,
): EditorState {
  if (!editorContext) return serverState;
  return {
    ...serverState,
    ...definedEditorContextFields(editorContext),
  };
}

export function selectRunCanvasUrl(requestCanvasUrl: string | null | undefined): string | null {
  return requestCanvasUrl ?? null;
}

function definedEditorContextFields(editorContext: ChatEditorContext): Partial<EditorState> {
  const patch: Partial<EditorState> = {};
  for (const key of CHAT_EDITOR_CONTEXT_FIELDS) {
    const value = editorContext[key];
    if (value !== undefined) {
      (patch as Record<string, unknown>)[key] = value;
    }
  }
  return patch;
}
