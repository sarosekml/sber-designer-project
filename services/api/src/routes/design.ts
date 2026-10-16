import { Hono } from 'hono';
import { z } from 'zod';
import type { DesignSelection, DesignTarget } from '@sber-designer/shared-types';

import { audit } from '../audit';
import { getUser } from '../auth';
import {
  applyDesignChanges,
  DesignApplyInputSchema,
  findDesignApplyRunConflict,
} from '../design-apply';
import { applyModalSize, readModalSizeBaseline } from '../modal-size-apply';
import { getAgentRunCoordinator } from '../agent/run-coordinator';
import {
  DesignCompatibilityInputSchema,
  validateDesignScreenCompatibility,
} from '../design-compatibility';
import { inspectDesignTarget } from '../design-inspector';
import { ScreenCraftInputSchema, validateScreenCraft } from '../screen-craft';
import { loadDesignTokens } from '../design-tokens';
import { getState } from '../state-store';

const RectSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  })
  .strict();

const SelectionSchema = z
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
    rect: RectSchema,
  })
  .strict();

const InspectInputSchema = z
  .object({
    workspacePath: z.string().optional(),
    selection: SelectionSchema,
    activeScreen: z
      .object({
        id: z.string(),
        storyId: z.string().optional(),
        filePath: z.string().optional(),
        implementationFilePath: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const ModalSizeApplyInputSchema = z
  .object({
    workspacePath: z.string().optional(),
    screenId: z.string().min(1).optional(),
    filePath: z.string().min(1),
    patch: z
      .object({
        width: z.string().optional(),
        height: z.string().optional(),
        longContent: z.enum(['scroll', 'grow']).optional(),
      })
      .strict(),
    baseline: z
      .object({ hash: z.string().min(1) })
      .strict()
      .optional(),
  })
  .strict();

const ModalSizeReadInputSchema = z
  .object({
    workspacePath: z.string().optional(),
    filePath: z.string().min(1),
  })
  .strict();

export const designRouter = new Hono()
  .post('/inspect', async (c) => {
    const startedAt = Date.now();
    const user = getUser(c);
    const raw = await c.req.json().catch(() => null);
    const parse = InspectInputSchema.safeParse(raw);
    if (!parse.success) {
      return c.json({ error: 'invalid_input', detail: parse.error.message }, 400);
    }
    const workspaceRoot = parse.data.workspacePath ?? getState().workspacePath;
    if (!workspaceRoot) {
      return c.json(
        {
          error: 'no_workspace',
          detail:
            'No workspacePath provided and no active workspace known to the api. Connect a project first.',
        },
        400,
      );
    }

    try {
      const activeScreen = normalizeActiveScreen(parse.data.activeScreen);
      const result = await inspectDesignTarget({
        workspaceRoot,
        selection: parse.data.selection as DesignSelection,
        ...(activeScreen ? { activeScreen } : {}),
      });
      audit({
        kind: 'config',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `design.inspect target=${result.target.filePath ?? result.target.loc} editable=${result.editable}`,
      });
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({
        kind: 'error',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `design.inspect: ${message}`,
      });
      return c.json({ error: 'inspect_failed', detail: message }, 422);
    }
  })
  .post('/compatibility', async (c) => {
    const startedAt = Date.now();
    const user = getUser(c);
    const raw = await c.req.json().catch(() => null);
    const parse = DesignCompatibilityInputSchema.safeParse(raw);
    if (!parse.success) {
      return c.json({ error: 'invalid_input', detail: parse.error.message }, 400);
    }
    const workspaceRoot = parse.data.workspacePath ?? getState().workspacePath;
    if (!workspaceRoot) {
      return c.json(
        {
          error: 'no_workspace',
          detail:
            'No workspacePath provided and no active workspace known to the api. Connect a project first.',
        },
        400,
      );
    }

    try {
      const result = await validateDesignScreenCompatibility({
        workspaceRoot,
        screen: parse.data.screen,
      });
      audit({
        kind: 'config',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `design.compatibility status=${result.status} target=${result.target.filePath ?? 'unresolved'}`,
      });
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({
        kind: 'error',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `design.compatibility: ${message}`,
      });
      return c.json({ error: 'compatibility_failed', detail: message }, 422);
    }
  })
  .post('/craft', async (c) => {
    const startedAt = Date.now();
    const user = getUser(c);
    const raw = await c.req.json().catch(() => null);
    const parse = ScreenCraftInputSchema.safeParse(raw);
    if (!parse.success) {
      return c.json({ error: 'invalid_input', detail: parse.error.message }, 400);
    }
    const workspaceRoot = parse.data.workspacePath ?? getState().workspacePath;
    if (!workspaceRoot) {
      return c.json(
        {
          error: 'no_workspace',
          detail:
            'No workspacePath provided and no active workspace known to the api. Connect a project first.',
        },
        400,
      );
    }

    try {
      const result = await validateScreenCraft({
        workspaceRoot,
        screen: parse.data.screen,
        profile: parse.data.profile,
        ...(parse.data.surface ? { surface: parse.data.surface } : {}),
      });
      audit({
        kind: 'config',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `screen.craft status=${result.status} target=${result.target.filePath ?? 'unresolved'} findings=${result.findings.length}`,
      });
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({
        kind: 'error',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `screen.craft: ${message}`,
      });
      return c.json({ error: 'craft_failed', detail: message }, 422);
    }
  })
  .post('/apply', async (c) => {
    const startedAt = Date.now();
    const user = getUser(c);
    const raw = await c.req.json().catch(() => null);
    const parse = DesignApplyInputSchema.safeParse(raw);
    if (!parse.success) {
      return c.json({ error: 'invalid_input', detail: parse.error.message }, 400);
    }
    const workspaceRoot = parse.data.workspacePath ?? getState().workspacePath;
    if (!workspaceRoot) {
      return c.json(
        {
          error: 'no_workspace',
          detail:
            'No workspacePath provided and no active workspace known to the api. Connect a project first.',
        },
        400,
      );
    }

    try {
      const blockingRun = findDesignApplyRunConflict({
        activeRuns: getAgentRunCoordinator().activeRuns(),
        ...(parse.data.screenId ? { screenId: parse.data.screenId } : {}),
        changedFiles: parse.data.changes.map((change) => change.filePath),
      });
      if (blockingRun) {
        const conflict = new Error(
          `Assistant run "${blockingRun.title ?? blockingRun.clientRunId}" is still changing this screen. Wait for it to finish before applying visual edits.`,
        );
        Object.assign(conflict, { status: 409, code: 'design_run_conflict' });
        throw conflict;
      }
      const result = await applyDesignChanges({
        workspaceRoot,
        target: parse.data.target as DesignTarget,
        changes: parse.data.changes,
        ...(parse.data.baseline ? { baseline: parse.data.baseline } : {}),
      });
      audit({
        kind: 'config',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `design.apply ops=${result.ops.length} files=${result.changedFiles.length}`,
      });
      return c.json(result);
    } catch (err) {
      const status = ((err as Error & { status?: number }).status === 409 ? 409 : 422) as 409 | 422;
      const errorCode = (err as Error & { code?: string }).code;
      const message = err instanceof Error ? err.message : String(err);
      audit({
        kind: 'error',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `design.apply: ${message}`,
      });
      return c.json(
        {
          error: errorCode ?? (status === 409 ? 'visual_conflict' : 'visual_apply_failed'),
          detail: message,
        },
        status,
      );
    }
  })
  .post('/modal-size/read', async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parse = ModalSizeReadInputSchema.safeParse(raw);
    if (!parse.success) {
      return c.json({ error: 'invalid_input', detail: parse.error.message }, 400);
    }
    const workspaceRoot = parse.data.workspacePath ?? getState().workspacePath;
    if (!workspaceRoot) {
      return c.json({ error: 'no_workspace', detail: 'Connect a project first.' }, 400);
    }
    try {
      return c.json(
        await readModalSizeBaseline({
          workspaceRoot,
          filePath: parse.data.filePath,
        }),
      );
    } catch (err) {
      return c.json(
        {
          error: 'modal_size_read_failed',
          detail: err instanceof Error ? err.message : String(err),
        },
        422,
      );
    }
  })
  .post('/modal-size', async (c) => {
    const startedAt = Date.now();
    const user = getUser(c);
    const raw = await c.req.json().catch(() => null);
    const parse = ModalSizeApplyInputSchema.safeParse(raw);
    if (!parse.success) {
      return c.json({ error: 'invalid_input', detail: parse.error.message }, 400);
    }
    const workspaceRoot = parse.data.workspacePath ?? getState().workspacePath;
    if (!workspaceRoot) {
      return c.json({ error: 'no_workspace', detail: 'Connect a project first.' }, 400);
    }
    try {
      const blockingRun = findDesignApplyRunConflict({
        activeRuns: getAgentRunCoordinator().activeRuns(),
        ...(parse.data.screenId ? { screenId: parse.data.screenId } : {}),
        changedFiles: [parse.data.filePath],
      });
      if (blockingRun) {
        throw Object.assign(
          new Error(
            `Assistant run "${blockingRun.title ?? blockingRun.clientRunId}" is still changing this screen. Wait for it to finish before editing the modal size.`,
          ),
          { status: 409, code: 'design_run_conflict' },
        );
      }
      const result = await applyModalSize({
        workspaceRoot,
        filePath: parse.data.filePath,
        patch: {
          ...(parse.data.patch.width !== undefined ? { width: parse.data.patch.width } : {}),
          ...(parse.data.patch.height !== undefined ? { height: parse.data.patch.height } : {}),
          ...(parse.data.patch.longContent !== undefined
            ? { longContent: parse.data.patch.longContent }
            : {}),
        },
        ...(parse.data.baseline ? { baseline: parse.data.baseline } : {}),
      });
      audit({
        kind: 'config',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `design.modalSize file=${parse.data.filePath}`,
      });
      return c.json(result);
    } catch (err) {
      const status = ((err as Error & { status?: number }).status === 409 ? 409 : 422) as 409 | 422;
      const code = (err as Error & { code?: string }).code;
      const message = err instanceof Error ? err.message : String(err);
      audit({
        kind: 'error',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `design.modalSize: ${message}`,
      });
      return c.json({ error: code ?? 'modal_size_failed', detail: message }, status);
    }
  })
  .get('/tokens', async (c) => {
    const workspaceRoot = c.req.query('workspacePath') ?? getState().workspacePath;
    if (!workspaceRoot) {
      return c.json(
        {
          error: 'no_workspace',
          detail:
            'No workspacePath provided and no active workspace known to the api. Connect a project first.',
        },
        400,
      );
    }
    try {
      return c.json(await loadDesignTokens(workspaceRoot));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'tokens_failed', detail: message }, 422);
    }
  });

type InspectActiveScreen = NonNullable<Parameters<typeof inspectDesignTarget>[0]['activeScreen']>;

function normalizeActiveScreen(
  input: z.infer<typeof InspectInputSchema>['activeScreen'],
): InspectActiveScreen | undefined {
  if (!input) return undefined;
  return {
    id: input.id,
    ...(input.storyId ? { storyId: input.storyId } : {}),
    ...(input.filePath ? { filePath: input.filePath } : {}),
    ...(input.implementationFilePath
      ? { implementationFilePath: input.implementationFilePath }
      : {}),
  };
}
