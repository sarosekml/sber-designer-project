/**
 * Tool registry. Every tool is described by a zod schema for its input
 * and an async handler that returns a JSON-serialisable payload. The MCP
 * server transport layer (server.ts) wraps each one as an MCP tool.
 *
 * Naming: snake_case, no `mcp__` prefix — clients (Claude Code, Cursor)
 * add their own namespace.
 */
import { z } from 'zod';
import {
  getHtmlProjectStructureReport,
  loadDesignIndex,
  type IndexedComponentRecord,
} from '@sber-designer/design-indexer';
import { isExternalDesignSourceTargetPath } from '@sber-designer/shared-types';

import type { ProjMcpContext } from '../context';
import { readWorkspaceFile } from '../safe-fs';
import {
  GetComponentDescriptionSourceInput,
  ListUndescribedInput,
  WriteComponentDescriptionInput,
  getComponentDescriptionSourceForWorkspace,
  listUndescribedComponentsForWorkspace,
  writeComponentDescriptionSidecarForWorkspace,
} from './component-description-core';
import { astApplyPatch, astReadFile, astWriteFile } from './ast-tools';

/**
 * `RawInput` is the schema's *input* side, which differs from its output
 * whenever a field has a `.default()` — the caller may omit it, the handler
 * always receives it. Collapsing the two made any tool with a default
 * unassignable to its own definition.
 */
export interface ToolDefinition<I = unknown, O = unknown, RawInput = I> {
  name: string;
  description: string;
  inputSchema: z.ZodType<I, z.ZodTypeDef, RawInput>;
  handler: (input: I, ctx: ProjMcpContext) => Promise<O>;
}

// ---------- ping ----------------------------------------------------------

const PingInput = z.object({}).strict();
const ping: ToolDefinition<
  z.infer<typeof PingInput>,
  { ok: true; projectId: string; version: string }
> = {
  name: 'ping',
  description: 'Sanity check. Returns the project id and server version.',
  inputSchema: PingInput,
  handler: async (_input, ctx) => ({ ok: true, projectId: ctx.projectId, version: ctx.version }),
};

// ---------- project-index status -----------------------------------------

const GetProjectIndexStatusInput = z.object({}).strict();
const getProjectIndexStatus: ToolDefinition<z.infer<typeof GetProjectIndexStatusInput>, unknown> = {
  name: 'get_project_index_status',
  description:
    'Read the unified .sber-designer/design-index status, counts, diagnostics, and compact summary. Use this before deeper project-index lookups.',
  inputSchema: GetProjectIndexStatusInput,
  handler: async (_input, ctx) => {
    const context = await loadDesignIndex(ctx.workspaceRoot);
    return {
      status: context.status,
      stale: context.stale,
      projectName: context.manifest?.projectName ?? null,
      generatedAt: context.manifest?.generatedAt ?? null,
      counts: context.manifest?.counts ?? null,
      artifacts: context.artifacts,
      diagnostics: context.diagnostics,
      promptSummary: context.promptSummary,
      projectSystem: context.projectSystem ?? null,
    };
  },
};

// ---------- project structure report ------------------------------------

const GetProjectStructureReportInput = z.object({}).strict();
const getProjectStructureReport: ToolDefinition<
  z.infer<typeof GetProjectStructureReportInput>,
  Awaited<ReturnType<typeof getHtmlProjectStructureReport>>
> = {
  name: 'get_project_structure_report',
  description:
    'Inspect a static HTML workspace before restructuring it. Returns canonical/non-canonical/unsupported status, a bounded file inventory, proposed mappings, and broken local references. This tool is read-only.',
  inputSchema: GetProjectStructureReportInput,
  handler: async (_input, ctx) => getHtmlProjectStructureReport(ctx.workspaceRoot),
};

// ---------- tail_run_events ----------------------------------------------

const RUN_ID_PATTERN = /^[a-zA-Z0-9._:-]+$/u;
const TailRunEventsInput = z
  .object({
    runId: z
      .string()
      .min(1)
      .regex(
        RUN_ID_PATTERN,
        'runId may contain only letters, numbers, dots, underscores, dashes, and colons.',
      )
      .describe('Agent run id, e.g. run-2026-07-02T19-28-06-574-a8f8ce41.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .describe('Number of latest JSONL events to return.'),
  })
  .strict();

const tailRunEvents: ToolDefinition<
  z.infer<typeof TailRunEventsInput>,
  {
    runId: string;
    path: string;
    totalEvents: number;
    truncated: boolean;
    events: unknown[];
    note?: string;
  }
> = {
  name: 'tail_run_events',
  description:
    'Read the latest external-runtime events for an agent run from .sber-designer/runs/<runId>/external-runtime/events.jsonl. Use this when diagnosing live-smoke failures without manually opening run logs.',
  inputSchema: TailRunEventsInput,
  handler: async (input, ctx) => {
    const path = `.sber-designer/runs/${input.runId}/external-runtime/events.jsonl`;
    let contents = '';
    try {
      contents = await readWorkspaceFile(ctx.workspaceRoot, path);
    } catch (err) {
      if (isNotFoundError(err)) {
        return {
          runId: input.runId,
          path,
          totalEvents: 0,
          truncated: false,
          events: [],
          note: 'No external-runtime event log exists for this run yet.',
        };
      }
      throw err;
    }

    const lines = contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const limit = input.limit ?? 50;
    const selectedLines = lines.slice(-limit);
    const startLineNumber = lines.length - selectedLines.length + 1;
    return {
      runId: input.runId,
      path,
      totalEvents: lines.length,
      truncated: selectedLines.length < lines.length,
      events: selectedLines.map((line, index) => parseJsonlEvent(line, startLineNumber + index)),
    };
  },
};

// ---------- catalog_list_components --------------------------------------

const CatalogListInput = z.object({}).strict();
const catalogListComponents: ToolDefinition<
  z.infer<typeof CatalogListInput>,
  {
    source: 'storybook' | 'static' | 'placeholder';
    components: {
      id: string;
      title: string;
      shortName: string;
      filePath: string;
      storyCount: number;
      description?: string;
      descriptionLayer?: import('@sber-designer/shared-types').ComponentDescriptionLayer;
    }[];
    note?: string;
  }
> = {
  name: 'catalog_list_components',
  description:
    'List components available in the connected repo. Reads the live catalog from services/api (ADR-0011). When no editor bridge is configured, returns an empty list with a note.',
  inputSchema: CatalogListInput,
  handler: async (_input, ctx) => {
    if (!ctx.bridge) {
      return {
        source: 'placeholder',
        components: [],
        note: 'No --api-url configured for proj-mcp; cannot reach the catalog endpoint.',
      };
    }
    await ctx.bridge.announceToolCall('catalog_list_components', '');
    const catalog = await ctx.bridge.getCatalog();
    return { source: catalog.source, components: catalog.components };
  },
};

// ---------- editor_post_message ------------------------------------------

const EditorPostMessageInput = z
  .object({
    text: z
      .string()
      .min(1)
      .describe('Markdown-flavored text to push into the editor chat transcript.'),
  })
  .strict();
const editorPostMessage: ToolDefinition<
  z.infer<typeof EditorPostMessageInput>,
  { ok: true; bridged: boolean }
> = {
  name: 'editor_post_message',
  description:
    "Push a chat message into the editor's chat panel. Used by Claude Code to keep the user informed of what it's doing inside sber-designer.",
  inputSchema: EditorPostMessageInput,
  handler: async (input, ctx) => {
    if (ctx.bridge) {
      await ctx.bridge.postMessage(input.text);
      return { ok: true, bridged: true };
    }
    // No api configured — log to stderr so the developer running the MCP
    // server in a terminal can still see what's happening.
    process.stderr.write(`[proj-mcp] editor_post_message (no bridge): ${input.text}\n`);
    return { ok: true, bridged: false };
  },
};

// ---------- editor_get_selection ----------------------------------------

const EditorGetSelectionInput = z.object({}).strict();
const editorGetSelection: ToolDefinition<
  z.infer<typeof EditorGetSelectionInput>,
  {
    selection: {
      loc: string;
      tagName: string;
      text?: string;
      selector?: string;
      componentName?: string;
      componentLoc?: string;
      attributes?: Record<string, string>;
      rect: { x: number; y: number; width: number; height: number };
      scope: 'default_target';
    } | null;
    bridged: boolean;
  }
> = {
  name: 'editor_get_selection',
  description:
    "Return the element currently selected in the editor's Design mode, or null if nothing is selected. When non-null, this is the default target for the user's next edit request until cleared. Use it for 'this', 'the selected one', and short targeted requests like changing a button label.",
  inputSchema: EditorGetSelectionInput,
  handler: async (_input, ctx) => {
    if (!ctx.bridge) {
      return { selection: null, bridged: false };
    }
    await ctx.bridge.announceToolCall('editor_get_selection', '');
    const sel = await ctx.bridge.getSelection();
    return {
      selection: sel
        ? {
            loc: sel.loc,
            tagName: sel.tagName,
            ...(sel.text ? { text: sel.text } : {}),
            ...(sel.selector ? { selector: sel.selector } : {}),
            ...(sel.componentName ? { componentName: sel.componentName } : {}),
            ...(sel.componentLoc ? { componentLoc: sel.componentLoc } : {}),
            ...(sel.attributes ? { attributes: sel.attributes } : {}),
            rect: sel.rect,
            scope: 'default_target',
          }
        : null,
      bridged: true,
    };
  },
};

// ---------- create_screen ------------------------------------------------

const CreateScreenInput = z
  .object({
    name: z.string().min(1).describe('Display name for the generated screen.'),
    storyId: z
      .string()
      .min(1)
      .describe(
        'Storybook story id for the generated screen, e.g. screens-ungrouped-payment--default or screens-payments-payment--default.',
      ),
    filePath: z
      .string()
      .min(1)
      .describe(
        'Workspace-relative Storybook wrapper path under src/stories/screens/. Use a readable file base that matches the screen name; do not append random/hash suffixes.',
      ),
    implementationFilePath: z
      .string()
      .min(1)
      .describe(
        'Workspace-relative implementation path under src/screens/. Use the same readable file base as filePath; do not append random/hash suffixes.',
      ),
    folder: z
      .string()
      .min(1)
      .optional()
      .describe('Screens panel folder. Use Ungrouped by default; do not invent date folders.'),
    description: z.string().optional(),
  })
  .strict();

const createScreen: ToolDefinition<
  z.infer<typeof CreateScreenInput>,
  { ok: true; id: string; screens: { id: string; name: string }[] }
> = {
  name: 'create_screen',
  description:
    'Register a generated design-source screen in the project. Requires --api-url so the mutation goes through services/api. Paths must stay under src/stories/screens/ and src/screens/. Generated screen files must use readable names that match the screen, with no random/hash suffixes; use New screen NN only for untitled screens.',
  inputSchema: CreateScreenInput,
  handler: async (input, ctx) => {
    if (!ctx.bridge) {
      throw new Error(
        'create_screen requires --api-url (or SBER_DESIGNER_API_URL) so proj-mcp can reach services/api.',
      );
    }
    validateCreateScreenInput(input);
    await ctx.bridge.announceToolCall('create_screen', `${input.name} -> ${input.filePath}`);
    return ctx.bridge.createScreen(input);
  },
};

// ---------- git_create_pr -----------------------------------------------

const GitCreatePrInput = z
  .object({
    title: z.string().min(1).describe('PR title.'),
    body: z.string().default('').describe('PR description (markdown).'),
    branch: z.string().min(1).optional().describe('Branch name. Defaults to sd/<timestamp>.'),
    baseBranch: z.string().min(1).optional(),
    pushOnly: z.boolean().default(false).describe('Skip opening a PR — push only.'),
  })
  .strict();

const gitCreatePr: ToolDefinition<
  z.output<typeof GitCreatePrInput>,
  { ok: true; branch: string; committed: boolean; prUrl: string | null; note?: string },
  z.input<typeof GitCreatePrInput>
> = {
  name: 'git_create_pr',
  description:
    "Branch + commit + push + open a PR via `gh`. Uses the host's git/gh credentials. Falls back to push-only when gh is missing.",
  inputSchema: GitCreatePrInput,
  handler: async (input, ctx) => {
    if (!ctx.bridge) {
      throw new Error('git_create_pr requires --api-url so proj-mcp can reach services/api.');
    }
    await ctx.bridge.announceToolCall('git_create_pr', input.title);
    return ctx.bridge.sendPr(input);
  },
};

// ---------- project-index usage cards & patterns (0080) -------------------

const DESIGN_INDEX_DIR = '.sber-designer/design-index';
const USAGE_CARDS_PATH = `${DESIGN_INDEX_DIR}/usage-cards.jsonl`;
const PATTERNS_PATH = `${DESIGN_INDEX_DIR}/patterns.jsonl`;

async function readDesignIndexJsonl<T>(ctx: ProjMcpContext, filePath: string): Promise<T[]> {
  let contents = '';
  try {
    contents = await readWorkspaceFile(ctx.workspaceRoot, filePath);
  } catch {
    return [];
  }
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as T];
      } catch {
        return [];
      }
    });
}

interface UsageCardRecord {
  componentId: string;
  publicImport?: { name?: string };
}

const SearchProjectIndexInput = z
  .object({
    query: z.string().min(1),
    types: z.array(z.literal('component')).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();

const searchProjectIndex: ToolDefinition<z.infer<typeof SearchProjectIndexInput>, unknown> = {
  name: 'search_project_index',
  description:
    'Search indexed project components by id, public name, title, description, tags, and authored AI guidance. The CLI surface intentionally scopes this tool to component retrieval; use get_usage_card before late selection.',
  inputSchema: SearchProjectIndexInput,
  handler: async (input, ctx) => {
    const query = input.query.trim().toLowerCase();
    const tokens = query.split(/\s+/u).filter(Boolean);
    const components = await readDesignIndexJsonl<IndexedComponentRecord>(
      ctx,
      `${DESIGN_INDEX_DIR}/components.jsonl`,
    );
    const results = components
      .map((component) => scoreIndexedComponent(component, query, tokens))
      .filter((result) => result.score > 0)
      .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
      .slice(0, input.limit ?? 12);
    return { query: input.query, results };
  },
};

const GetUsageCardInput = z
  .object({
    componentId: z
      .string()
      .min(1)
      .describe('Indexed component id or shortName whose usage card to read.'),
  })
  .strict();
const getUsageCard: ToolDefinition<z.infer<typeof GetUsageCardInput>, { card: unknown }> = {
  name: 'get_usage_card',
  description:
    'Read the compiled usage card for one component from the project design index: variant semantics, real mined JSX snippets, when-to-use/when-not-to-use, and facts. Prefer this over re-reading component sources.',
  inputSchema: GetUsageCardInput,
  handler: async (input, ctx) => {
    const needle = input.componentId.trim().toLowerCase();
    const cards = await readDesignIndexJsonl<UsageCardRecord>(ctx, USAGE_CARDS_PATH);
    const card = cards.find(
      (item) =>
        item.componentId.toLowerCase() === needle ||
        (item.publicImport?.name ?? '').toLowerCase() === needle,
    );
    if (!card) {
      throw new Error(
        `No usage card for "${input.componentId}". Re-index the project in sber-designer, or check the id via catalog_list_components.`,
      );
    }
    return { card };
  },
};

const UpdateComponentSelectionInput = z
  .object({
    action: z.enum(['add', 'replace']),
    role: z.string().min(1).describe('Exact role from the active run selection plan.'),
    componentId: z
      .string()
      .min(1)
      .describe(
        'Exact indexed id or shortName selected after catalog/search and usage-card review.',
      ),
    replaceComponentId: z.string().min(1).optional(),
    reason: z.string().min(1).max(500),
  })
  .strict();

const updateComponentSelection: ToolDefinition<
  z.infer<typeof UpdateComponentSelectionInput>,
  unknown
> = {
  name: 'update_component_selection',
  description:
    'Add a component for an uncovered planned role or replace that role selection, then continue the same CLI run. Review catalog/search and get_usage_card first. The API enforces the plan-bound late-selection budget and records updated hydration evidence.',
  inputSchema: UpdateComponentSelectionInput,
  handler: async (input, ctx) => {
    if (!ctx.runId) {
      throw new Error(
        'update_component_selection requires the run-scoped MCP injected by sber-designer.',
      );
    }
    if (!ctx.bridge?.updateComponentSelection) {
      throw new Error(
        'update_component_selection requires --api-url so the run-owned pack can be updated.',
      );
    }
    await ctx.bridge.announceToolCall(
      'update_component_selection',
      `${input.action} ${input.role} -> ${input.componentId}`,
    );
    return ctx.bridge.updateComponentSelection(ctx.runId, {
      action: input.action,
      role: input.role,
      componentId: input.componentId,
      ...(input.replaceComponentId ? { replaceComponentId: input.replaceComponentId } : {}),
      reason: input.reason,
    });
  },
};

interface PatternRecord {
  id: string;
  kind: string;
  name: string;
  description: string;
  status: string;
  slots: { role: string }[];
}

const ListPatternsInput = z.object({}).strict();
const listPatterns: ToolDefinition<z.infer<typeof ListPatternsInput>, { patterns: unknown[] }> = {
  name: 'list_patterns',
  description:
    'List compiled composition patterns (project screen grammar derived from screen templates). Use before composing a full screen.',
  inputSchema: ListPatternsInput,
  handler: async (_input, ctx) => {
    const patterns = await readDesignIndexJsonl<PatternRecord>(ctx, PATTERNS_PATH);
    return {
      patterns: patterns.map((pattern) => ({
        id: pattern.id,
        kind: pattern.kind,
        name: pattern.name,
        description: pattern.description,
        status: pattern.status,
        slotRoles: (pattern.slots ?? []).map((slot) => slot.role),
      })),
    };
  },
};

const GetPatternInput = z
  .object({
    id: z.string().min(1).describe('Pattern id from list_patterns.'),
  })
  .strict();
const getPattern: ToolDefinition<z.infer<typeof GetPatternInput>, { pattern: unknown }> = {
  name: 'get_pattern',
  description:
    'Read one composition pattern with full slots (role, bound component ids, presets) and evidence.',
  inputSchema: GetPatternInput,
  handler: async (input, ctx) => {
    const needle = input.id.trim().toLowerCase();
    const patterns = await readDesignIndexJsonl<PatternRecord>(ctx, PATTERNS_PATH);
    const pattern = patterns.find((item) => item.id.toLowerCase() === needle);
    if (!pattern) throw new Error(`Pattern not found: ${input.id}`);
    return { pattern };
  },
};

// ---------- component description tools (0112 proj-mcp parity) ------------

const listUndescribedComponents: ToolDefinition<z.infer<typeof ListUndescribedInput>, unknown> = {
  name: 'list_undescribed_components',
  description:
    'Ranked queue for the Description for AI interview. Returns components without authored description layers, with usage counts and progress. Use get_usage_card for mined draft details.',
  inputSchema: ListUndescribedInput,
  handler: async (input, ctx) => listUndescribedComponentsForWorkspace(input, ctx.workspaceRoot),
};

const writeComponentDescription: ToolDefinition<
  z.infer<typeof WriteComponentDescriptionInput>,
  unknown
> = {
  name: 'write_component_description',
  description:
    'Persist a confirmed Description for AI layer for one component. In proj-mcp this writes the canonical sidecar under .sber-designer/components; use request_project_reindex after a pass.',
  inputSchema: WriteComponentDescriptionInput,
  handler: async (input, ctx) => {
    const result = await writeComponentDescriptionSidecarForWorkspace(input, ctx.workspaceRoot);
    return result.publicResult;
  },
};

const getComponentDescriptionSource: ToolDefinition<
  z.infer<typeof GetComponentDescriptionSourceInput>,
  unknown
> = {
  name: 'get_component_description_source',
  description:
    'Read back the authored Description for AI source for one component: canonical sidecar layer plus readable markdown, falling back to the indexed layer.',
  inputSchema: GetComponentDescriptionSourceInput,
  handler: async (input, ctx) =>
    getComponentDescriptionSourceForWorkspace(input, ctx.workspaceRoot),
};

const RequestProjectReindexInput = z
  .object({
    reason: z.string().min(1).optional(),
  })
  .strict();

const requestProjectReindex: ToolDefinition<z.infer<typeof RequestProjectReindexInput>, unknown> = {
  name: 'request_project_reindex',
  description:
    'Start a background project re-index job through services/api and return the job id/status endpoint. Requires proj-mcp --api-url.',
  inputSchema: RequestProjectReindexInput,
  handler: async (input, ctx) => {
    if (!ctx.bridge) {
      throw new Error(
        'request_project_reindex requires --api-url (or SBER_DESIGNER_API_URL) so proj-mcp can reach services/api.',
      );
    }
    return ctx.bridge.requestProjectReindex({
      workspacePath: ctx.workspaceRoot,
      ...(input.reason ? { reason: input.reason } : {}),
    });
  },
};

// -------------------------------------------------------------------------

export const ALL_TOOLS: ToolDefinition[] = [
  ping,
  getProjectIndexStatus,
  getProjectStructureReport,
  tailRunEvents,
  astReadFile,
  astWriteFile,
  astApplyPatch,
  catalogListComponents,
  listUndescribedComponents,
  writeComponentDescription,
  getComponentDescriptionSource,
  requestProjectReindex,
  searchProjectIndex,
  getUsageCard,
  updateComponentSelection,
  listPatterns,
  getPattern,
  editorPostMessage,
  editorGetSelection,
  createScreen,
  gitCreatePr,
] as ToolDefinition[];

function scoreIndexedComponent(component: IndexedComponentRecord, query: string, tokens: string[]) {
  const fields = [
    ['id', component.id],
    ['shortName', component.shortName],
    ['title', component.title],
    ['description', component.description ?? ''],
    ['tags', component.tags.join(' ')],
    ['descriptionLayer.purpose', component.descriptionLayer?.purpose ?? ''],
    [
      'descriptionLayer.guidance',
      [
        ...(component.descriptionLayer?.agentGuidance ?? []),
        ...(component.descriptionLayer?.whenToUse ?? []),
        ...(component.descriptionLayer?.keywords ?? []),
      ].join(' '),
    ],
  ] as const;
  let score = 0;
  const matchedFields: string[] = [];
  for (const [name, rawValue] of fields) {
    const value = rawValue.toLowerCase();
    const exact = value === query;
    const matches = exact || value.includes(query) || tokens.some((token) => value.includes(token));
    if (!matches) continue;
    matchedFields.push(name);
    score += exact
      ? 100
      : value.includes(query)
        ? 40
        : tokens.filter((token) => value.includes(token)).length * 8;
  }
  return {
    type: 'component' as const,
    id: component.id,
    title: component.title,
    filePath: component.filePath,
    summary: component.description ?? component.shortName,
    score,
    confidence:
      score >= 80 ? ('high' as const) : score >= 24 ? ('medium' as const) : ('low' as const),
    matchedFields,
    matchReason:
      matchedFields.length > 0
        ? `Matched query in ${matchedFields.join(', ')}.`
        : 'No indexed component field matched.',
    recordConfidence: component.confidence,
    recommendedStoryId: component.stories[0]?.id,
  };
}

function isNotFoundError(err: unknown): boolean {
  return err instanceof Error && 'code' in err && err.code === 'ENOENT';
}

function parseJsonlEvent(line: string, lineNumber: number): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return { lineNumber, parseError: 'invalid_json', raw: line };
  }
}

function validateCreateScreenInput(input: z.infer<typeof CreateScreenInput>): void {
  if (
    !isExternalDesignSourceTargetPath(input.filePath) ||
    !/\.stories\.[jt]sx?$/iu.test(input.filePath)
  ) {
    throw new Error(
      'create_screen filePath must be a Storybook file under src/stories/screens/<folder>/*.stories.tsx.',
    );
  }
  if (
    !isExternalDesignSourceTargetPath(input.implementationFilePath) ||
    !/^src\/screens\//iu.test(input.implementationFilePath) ||
    !/\.[jt]sx?$/iu.test(input.implementationFilePath)
  ) {
    throw new Error(
      'create_screen implementationFilePath must be under src/screens/<folder>/*.tsx.',
    );
  }
}
