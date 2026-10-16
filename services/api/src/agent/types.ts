/**
 * Server-side tool descriptors. Each tool has a zod input schema and an
 * async handler. The agent loop maps these to OpenAI-style ToolSpec on
 * the way out and runs the handler when the model asks for them. ADR-0014.
 */
import type { ZodType, ZodTypeDef } from 'zod';
import type { ProjectScreenHealth, ScreenStructurePlan } from '@sber-designer/shared-types';
import type { ScreenReadinessProfileInput } from '@sber-designer/shared-types';
import type { AssistantSessionMode } from '@sber-designer/shared-types';
import type { EditorState } from '../state-store';
import type { TaskRelevantComponentPack } from '../component-intelligence/component-pack';
import type { ScreenCraftProfile } from '../generation-mode';
import type { ToolMutationSpec, ToolMutationTransaction } from './tool-mutation-transaction';

export type ServerToolSafety = 'read' | 'write' | 'external-effect' | 'disk-write';

export interface ToolContext {
  user: string;
  /** Human display name for password-session attribution; absent in legacy local mode. */
  userDisplayName?: string;
  /** Active project name from the editor, useful for diagnostics. */
  projectName?: string | null;
  /** Active screen from the editor, used as the default scope for targeted edits. */
  activeScreen?: EditorState['activeScreen'];
  /** Explicit assistant task scope resolved by the editor before the turn starts. */
  assistantTaskIntent?: EditorState['assistantTaskIntent'];
  /** Active workspace path from state-store (Phase 1+ — pushed by apps/web). */
  workspacePath: string | null;
  /** Active sandbox preview URL (Storybook) for catalog operations. */
  canvasUrl: string | null;
  /** Persistent assistant run id for timeline/receipt artifacts. */
  runId?: string | null;
  /** Ask / Plan / Design intent; independent from the canvas mode. */
  sessionMode?: AssistantSessionMode;
  /** Whether write tools should run the screen craft checker after successful changes. */
  agentCraftPostCheckEnabled?: boolean;
  /** Structured screen readiness profile used by post-generation checks. */
  screenReadiness?: ScreenReadinessProfileInput | null;
  /** Run-local craft rule profile, e.g. relaxed greybox wireframe checks. */
  screenCraftProfile?: ScreenCraftProfile;
  /** Run-local hints that should be carried into the next created screen. */
  screenHealthHints?: ProjectScreenHealth[];
  /** Run-scoped project component expectations used by craft post-checks. */
  componentPack?: TaskRelevantComponentPack | null;
  /** Run-owned information architecture prepared before the first screen write. */
  screenStructurePlan?: ScreenStructurePlan | null;
  /** Explicit run-scoped files that write tools may edit without extra permission prompts. */
  runAllowedWriteTargets?: string[];
  /** Run-local transaction boundary for the currently executing mutation tool. */
  beginToolMutation?: (spec: ToolMutationSpec) => ToolMutationTransaction;
}

/**
 * `RawInput` is the schema's *input* side. It differs from the output
 * whenever a field carries a `.default()` — the model may omit it, the
 * handler always receives it. Collapsing the two made every tool with a
 * default unassignable to its own type (0136 R10).
 */
export interface ServerTool<I = unknown, O = unknown, RawInput = I> {
  name: string;
  description: string;
  inputSchema: ZodType<I, ZodTypeDef, RawInput>;
  /** Optional raw JSON Schema parameters for external tools such as MCP. */
  parametersJsonSchema?: Record<string, unknown>;
  /** Coarse safety class for external/product-owned tools. */
  safety?: ServerToolSafety;
  handler: (input: I, ctx: ToolContext) => Promise<O>;
}
