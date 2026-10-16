import { createGateway, type ChatMessage, type LlmGateway } from '@sber-designer/llm-gateway';
import {
  CANONICAL_DESIGN_INDEX_PATHS,
  DESIGN_INDEX_PATHS,
  type DesignIndexDiagnostic,
  type IndexedComponentRecord,
  type ProjectAgentNote,
} from '@sber-designer/design-indexer';
import { z } from 'zod';

import { loadConfig } from '../config-store';
import { readWorkspaceFile, writeWorkspaceFile } from '../safe-fs';

const MAX_FACT_CHARS = 16_000;

const AgentNoteSchema = z
  .object({
    targetType: z.enum(['project', 'component', 'screen', 'token', 'icon', 'asset']),
    targetId: z.string().min(1).optional(),
    note: z.string().min(1),
    intent: z.enum(['prefer', 'avoid', 'requirement', 'deprecated', 'usage', 'other']),
  })
  .strict();

const DiagnosticSchema = z
  .object({
    level: z.enum(['info', 'warning', 'error']),
    filePath: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

const EnrichmentResponseSchema = z
  .object({
    agentNotes: z.array(AgentNoteSchema).default([]),
    diagnostics: z.array(DiagnosticSchema).default([]),
    promptSummaryAppendix: z.string().min(1).optional(),
  })
  .strict();

export interface ProjectIndexEnrichmentOptions {
  projectName: string;
  gateway?: Pick<LlmGateway, 'active' | 'chat'> | null;
}

export interface ProjectIndexEnrichmentResult {
  status: 'applied' | 'skipped';
  changedFiles: string[];
  diagnostics: DesignIndexDiagnostic[];
}

export async function enrichProjectIndex(
  workspaceRoot: string,
  options: ProjectIndexEnrichmentOptions,
): Promise<ProjectIndexEnrichmentResult> {
  const gateway = 'gateway' in options ? (options.gateway ?? null) : await createOptionalGateway();
  const changedFiles: string[] = [];
  const now = Date.now();

  if (!gateway) {
    const seeded = await seedMinimalComponentGuidance(workspaceRoot, now);
    if (seeded.changed) changedFiles.push(CANONICAL_DESIGN_INDEX_PATHS.agentNotes);
    return {
      status: changedFiles.length > 0 ? 'applied' : 'skipped',
      changedFiles,
      diagnostics: [
        {
          level: 'info',
          filePath: CANONICAL_DESIGN_INDEX_PATHS.diagnostics,
          message: 'Project index enrichment skipped because no LLM provider is configured.',
        },
      ],
    };
  }

  const response = await gateway.chat({
    messages: await buildEnrichmentMessages(workspaceRoot, options.projectName),
    model: gateway.active.model,
  });
  const parsed = parseEnrichmentResponse(response.text);
  if (!parsed.success) {
    return {
      status: 'skipped',
      changedFiles: [],
      diagnostics: [
        {
          level: 'warning',
          filePath: CANONICAL_DESIGN_INDEX_PATHS.diagnostics,
          message: `Project index enrichment skipped: ${parsed.message}`,
        },
      ],
    };
  }

  const seeded = await seedMinimalComponentGuidance(workspaceRoot, now);
  if (seeded.changed) changedFiles.push(CANONICAL_DESIGN_INDEX_PATHS.agentNotes);

  if (parsed.data.agentNotes.length > 0) {
    const existingNotes = await readJsonl<ProjectAgentNote>(
      workspaceRoot,
      CANONICAL_DESIGN_INDEX_PATHS.agentNotes,
    );
    const enrichedNotes: ProjectAgentNote[] = parsed.data.agentNotes.map((note, index) => ({
      id: `agent-enrichment-${now}-${index + 1}`,
      targetType: note.targetType,
      ...(note.targetId ? { targetId: note.targetId } : {}),
      note: note.note,
      intent: note.intent,
      source: 'agent',
      createdAt: now,
      updatedAt: now,
    }));
    await writeJsonl(workspaceRoot, CANONICAL_DESIGN_INDEX_PATHS.agentNotes, [
      ...existingNotes,
      ...enrichedNotes,
    ]);
    if (!changedFiles.includes(CANONICAL_DESIGN_INDEX_PATHS.agentNotes)) {
      changedFiles.push(CANONICAL_DESIGN_INDEX_PATHS.agentNotes);
    }
  }

  if (parsed.data.diagnostics.length > 0) {
    const current = await readJson<{ diagnostics?: DesignIndexDiagnostic[] }>(
      workspaceRoot,
      CANONICAL_DESIGN_INDEX_PATHS.diagnostics,
    );
    await writeJson(workspaceRoot, CANONICAL_DESIGN_INDEX_PATHS.diagnostics, {
      diagnostics: [...(current?.diagnostics ?? []), ...parsed.data.diagnostics],
    });
    changedFiles.push(CANONICAL_DESIGN_INDEX_PATHS.diagnostics);
  }

  if (parsed.data.promptSummaryAppendix) {
    const current = await readOptionalWorkspaceFile(
      workspaceRoot,
      CANONICAL_DESIGN_INDEX_PATHS.promptSummary,
    );
    const appendix = ['## Agent enrichment', '', parsed.data.promptSummaryAppendix.trim(), ''].join(
      '\n',
    );
    await writeWorkspaceFile(
      workspaceRoot,
      CANONICAL_DESIGN_INDEX_PATHS.promptSummary,
      `${(current ?? '').trimEnd()}\n\n${appendix}`,
    );
    changedFiles.push(CANONICAL_DESIGN_INDEX_PATHS.promptSummary);
  }

  return {
    status: changedFiles.length > 0 ? 'applied' : 'skipped',
    changedFiles,
    diagnostics: parsed.data.diagnostics,
  };
}

async function seedMinimalComponentGuidance(
  workspaceRoot: string,
  timestamp: number,
): Promise<{ changed: boolean }> {
  const [components, existingNotes] = await Promise.all([
    readJsonl<IndexedComponentRecord>(workspaceRoot, CANONICAL_DESIGN_INDEX_PATHS.components),
    readJsonl<ProjectAgentNote>(workspaceRoot, CANONICAL_DESIGN_INDEX_PATHS.agentNotes),
  ]);
  const seedNotes = buildMinimalComponentSeedNotes(components, existingNotes, timestamp);
  if (seedNotes.length === 0) return { changed: false };
  await writeJsonl(workspaceRoot, CANONICAL_DESIGN_INDEX_PATHS.agentNotes, [
    ...existingNotes,
    ...seedNotes,
  ]);
  return { changed: true };
}

interface ComponentSeedRule {
  role: string;
  intent: ProjectAgentNote['intent'];
  match: RegExp;
  exclude?: RegExp;
  note: (component: IndexedComponentRecord) => string;
}

const COMPONENT_SEED_RULES: ComponentSeedRule[] = [
  {
    role: 'breadcrumb',
    intent: 'usage',
    match: /breadcrumb|bread-crumb|breadcrumbs/iu,
    note: (component) =>
      `Use ${component.shortName} for breadcrumb/navigation trails before creating raw breadcrumb text.`,
  },
  {
    role: 'page-header',
    intent: 'usage',
    match: /pagebar|page-bar|page\s*header|header.*page/iu,
    note: (component) =>
      `Use ${component.shortName} for page title, subtitle, and page action regions before custom header markup.`,
  },
  {
    role: 'section-header',
    intent: 'usage',
    match: /dashboardgroupheader|groupheader|group-header|section\s*header/iu,
    note: (component) =>
      `Use ${component.shortName} for dashboard group and section labels before custom heading/divider markup.`,
  },
  {
    role: 'content-panel',
    intent: 'prefer',
    match: /(^|[-/\s])tile($|[-/\s])|card|panel/iu,
    exclude: /paper|sxbox|box/iu,
    note: (component) =>
      `Use ${component.shortName} for white content panel surfaces before creating raw Paper, SxBox, Box, or div panels.`,
  },
  {
    role: 'navigation',
    intent: 'usage',
    match: /navigation|sidebar|side-bar|menu/iu,
    note: (component) =>
      `Use ${component.shortName} for project navigation/menu regions before custom navigation markup.`,
  },
  {
    role: 'tabs',
    intent: 'usage',
    match: /pagetabs|page-tabs|tabs/iu,
    note: (component) =>
      `Use ${component.shortName} for tabbed page navigation before custom segmented controls.`,
  },
  {
    role: 'actions',
    intent: 'usage',
    match: /iconbutton|icon-button|button|link/iu,
    note: (component) =>
      `Use ${component.shortName} for action controls before creating custom clickable text or icon buttons.`,
  },
  {
    role: 'data-table',
    intent: 'usage',
    match: /datatable|data-table|table|grid|list/iu,
    note: (component) =>
      `Use ${component.shortName} for dense data regions before building custom row/table markup.`,
  },
  {
    role: 'filters',
    intent: 'usage',
    match: /filter|search/iu,
    note: (component) =>
      `Use ${component.shortName} for filter/search controls before custom filter markup.`,
  },
  {
    role: 'form-field',
    intent: 'usage',
    match: /input|select|checkbox|field|textarea/iu,
    note: (component) => `Use ${component.shortName} for form fields before custom input markup.`,
  },
];

function buildMinimalComponentSeedNotes(
  components: IndexedComponentRecord[],
  existingNotes: ProjectAgentNote[],
  timestamp: number,
): ProjectAgentNote[] {
  const existingIds = new Set(existingNotes.map((note) => note.id));
  const seeded: ProjectAgentNote[] = [];
  for (const rule of COMPONENT_SEED_RULES) {
    const component = components.find((candidate) => {
      const haystack = [
        candidate.id,
        candidate.title,
        candidate.shortName,
        candidate.filePath,
        candidate.tags.join(' '),
      ].join(' ');
      return rule.match.test(haystack) && !(rule.exclude?.test(haystack) ?? false);
    });
    if (!component) continue;
    const id = `agent-seed-${rule.role}-${component.id}`;
    if (existingIds.has(id)) continue;
    seeded.push({
      id,
      targetType: 'component',
      targetId: component.id,
      note: rule.note(component),
      intent: rule.intent,
      source: 'agent',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
  return seeded;
}

async function createOptionalGateway(): Promise<Pick<LlmGateway, 'active' | 'chat'> | null> {
  try {
    return createGateway(await loadConfig());
  } catch {
    return null;
  }
}

async function buildEnrichmentMessages(
  workspaceRoot: string,
  projectName: string,
): Promise<ChatMessage[]> {
  return [
    {
      role: 'system',
      content:
        'You are ai-project-indexer. Analyze bounded sber-designer project-index facts and return strict JSON only. Do not edit production source files.',
    },
    {
      role: 'user',
      content: [
        `Project: ${projectName}`,
        '',
        'Return JSON with this exact shape:',
        '{"agentNotes":[{"targetType":"component","targetId":"...","intent":"usage","note":"..."}],"diagnostics":[{"level":"info","filePath":".sber-designer/design-index/agent-notes.jsonl","message":"..."}],"promptSummaryAppendix":"..."}',
        '',
        'Bounded project-index facts:',
        '',
        await readBoundedFacts(workspaceRoot),
      ].join('\n'),
    },
  ];
}

async function readBoundedFacts(workspaceRoot: string): Promise<string> {
  const sections = [
    DESIGN_INDEX_PATHS.manifest,
    DESIGN_INDEX_PATHS.projectProfile,
    DESIGN_INDEX_PATHS.promptSummary,
    DESIGN_INDEX_PATHS.components,
    DESIGN_INDEX_PATHS.componentGroups,
    DESIGN_INDEX_PATHS.routes,
    DESIGN_INDEX_PATHS.screens,
    DESIGN_INDEX_PATHS.tokens,
    DESIGN_INDEX_PATHS.icons,
    DESIGN_INDEX_PATHS.diagnostics,
  ];
  const chunks: string[] = [];
  for (const filePath of sections) {
    const contents = await readOptionalWorkspaceFile(workspaceRoot, filePath);
    if (!contents) continue;
    chunks.push(`### ${filePath}\n${contents.slice(0, 3_000)}`);
  }
  return chunks.join('\n\n').slice(0, MAX_FACT_CHARS);
}

function parseEnrichmentResponse(
  text: string,
):
  | { success: true; data: z.infer<typeof EnrichmentResponseSchema> }
  | { success: false; message: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { success: false, message: 'model response was not valid JSON schema output.' };
  }
  const parsed = EnrichmentResponseSchema.safeParse(json);
  if (!parsed.success) {
    return {
      success: false,
      message: `model response failed schema validation: ${parsed.error.message}`,
    };
  }
  return { success: true, data: parsed.data };
}

async function readOptionalWorkspaceFile(
  workspaceRoot: string,
  filePath: string,
): Promise<string | null> {
  try {
    return await readWorkspaceFile(workspaceRoot, filePath);
  } catch {
    return null;
  }
}

async function readJson<T>(workspaceRoot: string, filePath: string): Promise<T | null> {
  const contents = await readOptionalWorkspaceFile(workspaceRoot, filePath);
  if (!contents) return null;
  try {
    return JSON.parse(contents) as T;
  } catch {
    return null;
  }
}

async function readJsonl<T>(workspaceRoot: string, filePath: string): Promise<T[]> {
  const contents = await readOptionalWorkspaceFile(workspaceRoot, filePath);
  if (!contents) return [];
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

async function writeJson(workspaceRoot: string, filePath: string, value: unknown): Promise<void> {
  await writeWorkspaceFile(workspaceRoot, filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeJsonl<T>(workspaceRoot: string, filePath: string, records: T[]): Promise<void> {
  await writeWorkspaceFile(
    workspaceRoot,
    filePath,
    records.length > 0 ? `${records.map((record) => JSON.stringify(record)).join('\n')}\n` : '',
  );
}
