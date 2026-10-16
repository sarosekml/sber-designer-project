import { definedJson } from '../../defined-json';
/**
 * Screen and flow tools: create/update/remove project screens and
 * add/remove flow edges in the .sdproj graph.
 */
import { z } from 'zod';
import type {
  ProjectFlowEdge,
  ProjectScreen,
  ProjectScreenHealth,
} from '@sber-designer/shared-types';
import { isHtmlDesignSystemPath } from '@sber-designer/shared-types';

import { getProject, saveProject } from '../../project-store';
import { recordToolReceiptSafely } from '../run-recorder';
import type { ServerTool, ToolContext } from '../types';
import { assertScreenCreateAllowed, assertScreenUpdateAllowed } from './shared';

const ScreenCreateInput = z
  .object({
    kind: z.enum(['story', 'page']).default('story').describe('Screen unit kind.'),
    surface: z
      .enum(['page', 'modal'])
      .optional()
      .describe(
        'Screen surface (0132). Omit or `page` for a normal full-viewport screen. `modal` marks an overlay dialog: build the file with a viewport-filling backdrop, a centered `data-sd-modal-window` dialog, a transparent page background, and header/body/footer regions. Independent of `kind`.',
      ),
    name: z.string().min(1).describe('Display name for the screen.'),
    storyId: z
      .string()
      .min(1)
      .optional()
      .describe('Storybook story id from list_components, e.g. "atoms-button--primary".'),
    filePath: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Workspace-relative Storybook wrapper or page entry path. Use a readable file base that matches the screen name; do not append random/hash suffixes.',
      ),
    implementationFilePath: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Primary workspace-relative editable implementation file for generated screens. Use the same readable file base as filePath; do not append random/hash suffixes.',
      ),
    folder: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Optional Screens panel folder name. For generated screens, use the selected/user-named folder, or Ungrouped by default. Do not invent date folders.',
      ),
    description: z.string().optional(),
    health: z
      .object({
        status: z.enum(['ok', 'broken', 'needs-review']),
        reason: z.string().min(1),
        source: z.enum(['sync', 'failed-run', 'validation', 'fallback']).optional(),
        updatedAt: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional()
      .describe('Optional screen health. Use broken only for confirmed render/runtime failure.'),
  })
  .strict();

export const screenCreate: ServerTool<
  z.infer<typeof ScreenCreateInput>,
  { ok: true; id: string; screens: { id: string; name: string }[] },
  z.input<typeof ScreenCreateInput>
> = {
  name: 'screen_create',
  description:
    'Register a new project screen. For Storybook projects, use kind=story with storyId and include filePath for the thin Storybook wrapper plus implementationFilePath for the primary editable source. For HTML/CSS or static-page projects, use kind=page with filePath/implementationFilePath pointing at the page file; storyId is not required. In HTML-first projects, index.html is the managed Screens Index/project home, so generated pages should normally live under pages/<slug>.html unless the user explicitly asked to edit Index. Use this only when the screen does not already exist. Generated screen files must use readable names that match the screen, with no random/hash suffixes; use New screen NN only for untitled screens. Persists via the project file.',
  inputSchema: ScreenCreateInput,
  handler: async (input, ctx) => {
    assertScreenCreateAllowed(ctx);
    const project = getProject();
    if (!project.workspacePath) {
      throw new Error('No workspace yet. Connect a project first.');
    }
    const kind = input.kind ?? 'story';
    if (kind === 'story' && !input.storyId) {
      throw new Error('screen_create storyId is required when kind is story.');
    }
    if (kind === 'page' && !input.filePath && !input.implementationFilePath) {
      throw new Error(
        'screen_create filePath or implementationFilePath is required for page screens.',
      );
    }
    const screenPath = input.implementationFilePath ?? input.filePath ?? input.storyId ?? 'screen';
    assertNotDesignSystemScreenPath(screenPath, 'screen_create');
    const id = `screen-${Date.now()}-${slugScreenId(screenPath)}`;
    const health = normalizeScreenHealth(input.health) ?? takeScreenHealthHint(ctx);
    const screen: ProjectScreen = {
      id,
      name: input.name,
      kind,
      ...(input.surface === 'modal' ? { surface: input.surface } : {}),
      ...(input.storyId ? { storyId: input.storyId } : {}),
      ...(input.filePath ? { filePath: input.filePath } : {}),
      ...(input.implementationFilePath
        ? { implementationFilePath: input.implementationFilePath }
        : {}),
      folder: input.folder ?? folderFromGeneratedScreenPath(input.filePath) ?? 'Ungrouped',
      ...(input.description ? { description: input.description } : {}),
      ...(health ? { health } : {}),
    };
    const next = await saveProject({ ...project, screens: [...project.screens, screen] });
    await recordToolReceiptSafely({
      workspacePath: ctx.workspacePath,
      runId: ctx.runId,
      tool: 'screen_create',
      status: 'ok',
      changedFiles: ['.sber-designer/project.sdproj'],
      summary: `Registered screen ${screen.name}.`,
      metadata: {
        screenId: id,
        name: screen.name,
        surface: screen.surface ?? 'page',
        filePath: screen.filePath,
        implementationFilePath: screen.implementationFilePath,
      },
    });
    return {
      ok: true,
      id,
      screens: next.screens.map((s) => ({ id: s.id, name: s.name })),
    };
  },
};

const ScreenUpdateInput = z
  .object({
    screenId: z.string().min(1),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    folder: z.string().min(1).optional(),
    surface: z
      .enum(['page', 'modal'])
      .optional()
      .describe(
        'Change the screen surface (0132). Use `modal` for "make this screen a modal" — then re-lay-out the file to the modal contract (backdrop + centered `data-sd-modal-window` dialog, transparent page, header/body/footer regions) in the same run. `page` converts a modal back to a full-viewport screen.',
      ),
    storyId: z
      .string()
      .min(1)
      .regex(
        /^[a-z0-9][a-z0-9-]*--[a-z0-9][a-z0-9-]*$/u,
        'Story id must be ASCII kebab-case, e.g. "screens-risk-segment--default".',
      )
      .optional(),
  })
  .strict();

export const screenUpdate: ServerTool<
  z.infer<typeof ScreenUpdateInput>,
  { ok: true; screen: ProjectScreen; screens: { id: string; name: string }[] }
> = {
  name: 'screen_update',
  description:
    "Update metadata for an existing project screen: description and folder, plus— only when the user explicitly asked— its name or storyId. Do NOT rename the screen (change `name`) on your own initiative. The display name is the user's; an unprompted rename drifts it from the component export, story `component`, `meta.title`, and `storyId`, and has caused fatal render breaks. When the user does ask to rename, load the `storybook-screen-rename` skill and keep the component export, story import/`component`/`meta.title`, `storyId`, and this registration consistent in one pass. Do not use screen_create for an existing active screen.",
  inputSchema: ScreenUpdateInput,
  handler: async (input, ctx) => {
    assertScreenUpdateAllowed(ctx, input.screenId);
    const project = getProject();
    const screen = project.screens.find((candidate) => candidate.id === input.screenId);
    if (!screen) throw new Error(`screen_update target not found: ${input.screenId}`);
    assertNotDesignSystemScreen(screen, 'screen_update');
    const nextScreen: ProjectScreen = {
      ...screen,
      ...(input.name ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.folder ? { folder: input.folder } : {}),
      ...(input.storyId ? { storyId: input.storyId } : {}),
    };
    if (input.surface === 'modal') nextScreen.surface = 'modal';
    else if (input.surface === 'page') delete nextScreen.surface;
    const next = await saveProject({
      ...project,
      screens: project.screens.map((candidate) =>
        candidate.id === input.screenId ? nextScreen : candidate,
      ),
    });
    await recordToolReceiptSafely({
      workspacePath: ctx.workspacePath,
      runId: ctx.runId,
      tool: 'screen_update',
      status: 'ok',
      changedFiles: ['.sber-designer/project.sdproj'],
      summary: `Updated screen metadata for ${nextScreen.name}.`,
      metadata: {
        screenId: input.screenId,
        name: nextScreen.name,
        surface: nextScreen.surface ?? 'page',
        storyId: nextScreen.storyId,
      },
    });
    return {
      ok: true,
      screen: nextScreen,
      screens: next.screens.map((candidate) => ({ id: candidate.id, name: candidate.name })),
    };
  },
};

function folderFromGeneratedScreenPath(path: string | undefined): string | null {
  const normalized = path?.replace(/\\/g, '/').replace(/^\.?\//u, '');
  if (!normalized) return null;
  const match =
    normalized.match(/^src\/stories\/screens\/([^/]+)\/[^/]+\.stories\.[jt]sx?$/iu) ??
    normalized.match(/^src\/screens\/([^/]+)\/[^/]+\.[jt]sx?$/iu);
  return match?.[1] ?? null;
}

function slugScreenId(value: string): string {
  return value
    .replace(/[^A-Za-z0-9_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .toLowerCase();
}

function takeScreenHealthHint(ctx: ToolContext): ProjectScreenHealth | undefined {
  const hints = ctx.screenHealthHints ?? [];
  ctx.screenHealthHints = [];
  const broken = hints.find((hint) => hint.status === 'broken');
  if (broken) return broken;
  return undefined;
}

function normalizeScreenHealth(
  health: z.infer<typeof ScreenCreateInput>['health'],
): ProjectScreenHealth | undefined {
  if (!health) return undefined;
  return {
    status: health.status,
    reason: health.reason,
    ...(health.source ? { source: health.source } : {}),
    ...(health.updatedAt !== undefined ? { updatedAt: health.updatedAt } : {}),
  };
}

const ScreenRemoveInput = z.object({ id: z.string().min(1) }).strict();

export const screenRemove: ServerTool<
  z.infer<typeof ScreenRemoveInput>,
  { ok: true; remaining: number }
> = {
  name: 'screen_remove',
  description: 'Drop a screen from the project (and any flow edges referencing it).',
  inputSchema: ScreenRemoveInput,
  handler: async (input) => {
    const project = getProject();
    const screen = project.screens.find((candidate) => candidate.id === input.id);
    if (screen) assertNotDesignSystemScreen(screen, 'screen_remove');
    const next = await saveProject({
      ...project,
      screens: project.screens.filter((s) => s.id !== input.id),
      flow: project.flow.filter((e) => e.fromScreenId !== input.id && e.toScreenId !== input.id),
    });
    return { ok: true, remaining: next.screens.length };
  },
};

// ---------- flow_add_edge / flow_remove_edge ---------------------------

const FlowTriggerSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('click'),
      selector: z.string().optional(),
      label: z.string().optional(),
    })
    .strict(),
  z.object({ kind: z.literal('link'), href: z.string() }).strict(),
  z.object({ kind: z.literal('on-mount') }).strict(),
  z.object({ kind: z.literal('manual'), label: z.string().optional() }).strict(),
]);

const FlowAddEdgeInput = z
  .object({
    fromScreenId: z.string().min(1),
    toScreenId: z.string().min(1),
    trigger: FlowTriggerSchema.default({ kind: 'manual' }),
    presentation: z.enum(['navigate', 'overlay']).optional(),
    label: z.string().optional(),
  })
  .strict();

export const flowAddEdge: ServerTool<
  z.infer<typeof FlowAddEdgeInput>,
  { ok: true; id: string; edgeCount: number },
  z.input<typeof FlowAddEdgeInput>
> = {
  name: 'flow_add_edge',
  description:
    'Add a transition between two screens. Trigger kinds: click (a button), link (anchor href), on-mount, manual. Use after screen_create to wire up the prototype. Leave `presentation` unset to use the target-aware default (edges into a `modal` screen open as an overlay; others navigate). Set it only to override — e.g. `navigate` to force a full navigation into a modal, or `overlay` to float a normal screen.',
  inputSchema: FlowAddEdgeInput,
  handler: async (input) => {
    const project = getProject();
    const fromScreen = project.screens.find((s) => s.id === input.fromScreenId);
    if (!fromScreen) {
      throw new Error(`fromScreenId not found: ${input.fromScreenId}`);
    }
    const toScreen = project.screens.find((s) => s.id === input.toScreenId);
    if (!toScreen) {
      throw new Error(`toScreenId not found: ${input.toScreenId}`);
    }
    assertNotDesignSystemScreen(fromScreen, 'flow_add_edge');
    assertNotDesignSystemScreen(toScreen, 'flow_add_edge');
    const id = `flow-${Date.now()}-${input.fromScreenId}-${input.toScreenId}`;
    const edge: ProjectFlowEdge = {
      id,
      fromScreenId: input.fromScreenId,
      toScreenId: input.toScreenId,
      trigger: definedJson(input.trigger),
      // Persist any explicit presentation as an override (Р-5): an unset value
      // stays unset so it can follow the target surface, while an explicit
      // `navigate` must survive so it is not re-derived to `overlay`.
      ...(input.presentation ? { presentation: input.presentation } : {}),
      ...(input.label ? { label: input.label } : {}),
    };
    const next = await saveProject({ ...project, flow: [...project.flow, edge] });
    return { ok: true, id, edgeCount: next.flow.length };
  },
};

const FlowRemoveEdgeInput = z.object({ id: z.string().min(1) }).strict();

export const flowRemoveEdge: ServerTool<
  z.infer<typeof FlowRemoveEdgeInput>,
  { ok: true; edgeCount: number }
> = {
  name: 'flow_remove_edge',
  description: 'Remove a flow edge by id.',
  inputSchema: FlowRemoveEdgeInput,
  handler: async (input) => {
    const project = getProject();
    const next = await saveProject({
      ...project,
      flow: project.flow.filter((e) => e.id !== input.id),
    });
    return { ok: true, edgeCount: next.flow.length };
  },
};

function assertNotDesignSystemScreen(screen: ProjectScreen, toolName: string): void {
  const path = screen.implementationFilePath ?? screen.filePath;
  if (path) assertNotDesignSystemScreenPath(path, toolName);
}

function assertNotDesignSystemScreenPath(path: string, toolName: string): void {
  if (!isHtmlDesignSystemPath(path)) return;
  throw new Error(
    `${toolName} cannot target ${path}. Switch to Design system view and edit the package source instead.`,
  );
}

// -----------------------------------------------------------------------
