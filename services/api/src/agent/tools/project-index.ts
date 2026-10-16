/**
 * Unified project-index tools: status, scored search, indexed component /
 * token / asset / icon lookups, indexed screens, reindex requests, and
 * asset-pack import. Data readers and scoring live in project-index-data.
 */
import { z } from 'zod';
import {
  DESIGN_INDEX_PATHS,
  buildProjectSystemOverview,
  type ComponentUsageCard,
  type CompositionPatternRecord,
  type IndexedComponentRecord,
  type ProjectAgentNote,
  type ScreenIndexRecord,
} from '@sber-designer/design-indexer';

import { importAssetPack, type AssetPackKind } from '../../assets/asset-pack-importer';
import { resolveCatalog } from '../../catalog-cache';
import { getProject } from '../../project-store';
import { findActiveProjectIndexJob } from '../../project-index/job-store';
import { startProjectIndexJob } from '../../project-index/indexing-runner';
import { markStorybookReloadPendingForPath } from '../../storybook-reload';
import { generateProjectDesignIndexFiles, loadProjectDesignIndex } from '../../design-index';
import { recordToolReceiptSafely } from '../run-recorder';
import type { ServerTool } from '../types';
import {
  addScoredResult,
  assetSearchKeys,
  compactLine,
  emptyProjectIndexCounts,
  groupComponentAgentNotes,
  iconCandidateSearchFields,
  iconCandidateSummary,
  iconCandidateUsage,
  normalizeSearch,
  readAssets,
  readIconCandidates,
  readIcons,
  readProjectIndexJsonl,
  readRoutes,
  readTokens,
  searchField,
  type ProjectIndexSearchResult,
} from './project-index-data';
import { requireWorkspace } from './shared';

export { getIndexedIcon, materializeIndexedIconTool } from './project-index-icons';

const ProjectIndexSearchType = z.enum([
  'component',
  'token',
  'icon',
  'asset',
  'screen',
  'route',
  'note',
]);

const GetProjectIndexStatusInput = z.object({}).strict();

export const getProjectIndexStatus: ServerTool<
  z.infer<typeof GetProjectIndexStatusInput>,
  unknown
> = {
  name: 'get_project_index_status',
  description:
    'Read the unified .sber-designer/design-index status, counts, diagnostics, and compact summary. Use this before deeper project-index lookups.',
  inputSchema: GetProjectIndexStatusInput,
  handler: async (_input, ctx) => {
    const workspacePath = requireWorkspace(ctx);
    const context = await loadProjectDesignIndex(workspacePath);
    return {
      status: context.status,
      stale: context.stale,
      projectName: context.manifest?.projectName ?? null,
      generatedAt: context.manifest?.generatedAt ?? null,
      counts: context.manifest?.counts ?? emptyProjectIndexCounts(),
      artifacts: context.artifacts,
      diagnostics: context.diagnostics,
      promptSummary: context.promptSummary,
      projectSystem: context.projectSystem ?? buildProjectSystemOverview(context),
    };
  },
};

const SearchProjectIndexInput = z
  .object({
    query: z.string().min(1),
    types: z.array(ProjectIndexSearchType).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();

export const searchProjectIndex: ServerTool<z.infer<typeof SearchProjectIndexInput>, unknown> = {
  name: 'search_project_index',
  description:
    'Search unified project-index components, tokens, icons, screens, routes, and agent notes. Use this before opening broad source files.',
  inputSchema: SearchProjectIndexInput,
  handler: async (input, ctx) => {
    const workspacePath = requireWorkspace(ctx);
    const types = new Set(input.types ?? ProjectIndexSearchType.options);
    const limit = input.limit ?? 12;
    const results: ProjectIndexSearchResult[] = [];

    if (types.has('component')) {
      const components = await readProjectIndexJsonl<IndexedComponentRecord>(
        workspacePath,
        DESIGN_INDEX_PATHS.components,
      );
      const notes = await readProjectIndexJsonl<ProjectAgentNote>(
        workspacePath,
        DESIGN_INDEX_PATHS.agentNotes,
      );
      const notesByComponent = groupComponentAgentNotes(notes);
      for (const component of components) {
        const componentNotes = notesByComponent.get(component.id) ?? [];
        addScoredResult(results, input.query, {
          type: 'component',
          id: component.id,
          title: component.title,
          filePath: component.filePath,
          summary: compactLine(component.description ?? component.shortName, 180),
          fields: [
            searchField('id', component.id),
            searchField('title', component.title),
            searchField('shortName', component.shortName),
            searchField('filePath', component.filePath),
            searchField('description', component.description ?? ''),
            searchField('tags', component.tags.join(' ')),
            searchField('groupIds', component.groupIds.join(' ')),
            searchField('descriptionLayer.purpose', component.descriptionLayer?.purpose ?? ''),
            searchField(
              'descriptionLayer.anatomy',
              component.descriptionLayer?.anatomy.join(' ') ?? '',
            ),
            searchField(
              'descriptionLayer.agentGuidance',
              component.descriptionLayer?.agentGuidance.join(' ') ?? '',
            ),
            searchField(
              'descriptionLayer.usage.when',
              component.descriptionLayer?.usage.map((usage) => usage.when).join(' ') ?? '',
            ),
            // 0083 R8: authored retrieval signals — find a component by its
            // confirmed keywords / when-to-use / variant meanings, not just its name.
            searchField(
              'descriptionLayer.keywords',
              component.descriptionLayer?.keywords?.join(' ') ?? '',
            ),
            searchField(
              'descriptionLayer.whenToUse',
              component.descriptionLayer?.whenToUse?.join(' ') ?? '',
            ),
            searchField(
              'descriptionLayer.whenNotToUse',
              component.descriptionLayer?.whenNotToUse?.join(' ') ?? '',
            ),
            searchField(
              'descriptionLayer.requiredProps',
              component.descriptionLayer?.requiredProps?.join(' ') ?? '',
            ),
            searchField(
              'descriptionLayer.variantGuidance',
              (component.descriptionLayer?.variantGuidance ?? [])
                .flatMap((guidance) => [
                  guidance.prop,
                  ...guidance.values.map((value) => `${value.value} ${value.meaning}`),
                ])
                .join(' '),
            ),
            searchField('agentNotes.note', componentNotes.map((note) => note.note).join(' ')),
          ],
          recordConfidence: component.confidence,
          recommendedStoryId: component.stories[0]?.id,
        });
      }
    }

    if (types.has('token')) {
      const tokens = await readTokens(workspacePath);
      for (const token of tokens) {
        addScoredResult(results, input.query, {
          type: 'token',
          id: token.id,
          title: token.name,
          filePath: token.filePath,
          summary: `${token.kind}: ${token.value}`,
          fields: [token.id, token.name, token.value, token.kind, token.source, token.filePath],
        });
      }
    }

    if (types.has('icon')) {
      const candidates = await readIconCandidates(workspacePath);
      if (candidates.length > 0) {
        for (const icon of candidates) {
          addScoredResult(results, input.query, {
            type: 'icon',
            id: icon.id,
            title: icon.name,
            ...(icon.filePath !== undefined ? { filePath: icon.filePath } : {}),
            summary: iconCandidateSummary(icon),
            source: icon.source,
            validFor: icon.validFor,
            usage: iconCandidateUsage(icon),
            fields: iconCandidateSearchFields(icon),
          });
        }
      } else {
        const icons = await readIcons(workspacePath);
        const assets = await readAssets(workspacePath);
        for (const asset of assets.filter((item) => item.kind === 'icon')) {
          addScoredResult(results, input.query, {
            type: 'asset',
            id: asset.id,
            title: asset.name,
            filePath: asset.filePath,
            summary: `project asset icon: ${asset.importName ?? asset.filePath}`,
            fields: [
              asset.id,
              asset.name,
              asset.filePath,
              asset.importName ?? '',
              asset.importSource ?? '',
              asset.tags.join(' '),
            ],
          });
        }
        for (const icon of icons.projectIcons) {
          addScoredResult(results, input.query, {
            type: 'icon',
            id: icon.id,
            title: icon.name,
            ...(icon.filePath !== undefined ? { filePath: icon.filePath } : {}),
            summary: `project icon: ${icon.importName}`,
            fields: [icon.id, icon.name, icon.importName, icon.filePath],
          });
        }
        for (const icon of icons.fallback.icons) {
          addScoredResult(results, input.query, {
            type: 'icon',
            id: icon.id,
            title: icon.name,
            summary: `lucide fallback: ${icon.importName}`,
            fields: [icon.id, icon.name, icon.importName, icon.tags.join(' ')],
          });
        }
      }
    }

    if (types.has('asset')) {
      const assets = await readAssets(workspacePath);
      for (const asset of assets) {
        addScoredResult(results, input.query, {
          type: 'asset',
          id: asset.id,
          title: asset.name,
          filePath: asset.filePath,
          summary: `${asset.kind}: ${asset.importName ?? asset.filePath}`,
          fields: [
            asset.id,
            asset.kind,
            asset.name,
            asset.filePath,
            asset.importName ?? '',
            asset.importSource ?? '',
            asset.storybookTitle ?? '',
            asset.storybookStory ?? '',
            asset.tags.join(' '),
          ],
        });
      }
    }

    if (types.has('screen')) {
      const screens = await readProjectIndexJsonl<ScreenIndexRecord>(
        workspacePath,
        DESIGN_INDEX_PATHS.screens,
      );
      for (const screen of screens) {
        addScoredResult(results, input.query, {
          type: 'screen',
          id: screen.id,
          title: screen.name,
          filePath: screen.implementationPath,
          summary: screen.routePath ?? screen.designReadableStatus,
          fields: [
            screen.id,
            screen.name,
            screen.implementationPath,
            screen.storyPath ?? '',
            screen.routePath ?? '',
            screen.designReadableStatus,
          ],
        });
      }
    }

    if (types.has('route')) {
      const routes = await readRoutes(workspacePath);
      for (const route of routes) {
        addScoredResult(results, input.query, {
          type: 'route',
          id: route.id,
          title: route.routePath,
          filePath: route.filePath,
          summary: route.source,
          fields: [route.id, route.routePath, route.filePath, route.source],
        });
      }
    }

    if (types.has('note')) {
      const notes = await readProjectIndexJsonl<ProjectAgentNote>(
        workspacePath,
        DESIGN_INDEX_PATHS.agentNotes,
      );
      for (const note of notes) {
        addScoredResult(results, input.query, {
          type: 'note',
          id: note.id,
          title: note.targetId ?? note.targetType,
          summary: compactLine(note.note, 220),
          fields: [note.id, note.targetType, note.targetId ?? '', note.intent, note.note],
        });
      }
    }

    results.sort((a, b) => b.score - a.score || a.type.localeCompare(b.type));
    return {
      query: input.query,
      results: results.slice(0, limit).map(({ fields: _fields, ...result }) => result),
    };
  },
};

const GetIndexedComponentInput = z
  .object({
    id: z.string().min(1).describe('Component id, title, or shortName from components.jsonl.'),
  })
  .strict();

export const getIndexedComponent: ServerTool<z.infer<typeof GetIndexedComponentInput>, unknown> = {
  name: 'get_indexed_component',
  description:
    'Read one indexed component record by id/title/shortName, including matching project AI notes.',
  inputSchema: GetIndexedComponentInput,
  handler: async (input, ctx) => {
    const workspacePath = requireWorkspace(ctx);
    const needle = normalizeSearch(input.id);
    const components = await readProjectIndexJsonl<IndexedComponentRecord>(
      workspacePath,
      DESIGN_INDEX_PATHS.components,
    );
    const component = components.find(
      (item) =>
        normalizeSearch(item.id) === needle ||
        normalizeSearch(item.title) === needle ||
        normalizeSearch(item.shortName) === needle,
    );
    if (!component) throw new Error(`Indexed component not found: ${input.id}`);
    const notes = await readProjectIndexJsonl<ProjectAgentNote>(
      workspacePath,
      DESIGN_INDEX_PATHS.agentNotes,
    );
    return {
      component,
      notes: notes.filter(
        (note) => note.targetType === 'component' && note.targetId === component.id,
      ),
    };
  },
};

const GetUsageCardInput = z
  .object({
    componentId: z
      .string()
      .min(1)
      .describe('Component id, title, or shortName whose usage card to read.'),
  })
  .strict();

export const getUsageCard: ServerTool<z.infer<typeof GetUsageCardInput>, unknown> = {
  name: 'get_usage_card',
  description:
    'Read the compiled usage card for one component: variant semantics, real mined JSX snippets, when-to-use/when-not-to-use, co-used components, and provenance-carrying facts. Prefer this over re-reading component sources.',
  inputSchema: GetUsageCardInput,
  handler: async (input, ctx) => {
    const workspacePath = requireWorkspace(ctx);
    const needle = normalizeSearch(input.componentId);
    const cards = await readProjectIndexJsonl<ComponentUsageCard>(
      workspacePath,
      DESIGN_INDEX_PATHS.usageCards,
    );
    const card = cards.find(
      (item) =>
        normalizeSearch(item.componentId) === needle ||
        normalizeSearch(item.publicImport.name) === needle,
    );
    if (card) return { card };
    const components = await readProjectIndexJsonl<IndexedComponentRecord>(
      workspacePath,
      DESIGN_INDEX_PATHS.components,
    );
    const component = components.find(
      (item) =>
        normalizeSearch(item.id) === needle ||
        normalizeSearch(item.title) === needle ||
        normalizeSearch(item.shortName) === needle,
    );
    if (component) {
      const byComponentId = cards.find((item) => item.componentId === component.id);
      if (byComponentId) return { card: byComponentId };
      throw new Error(
        `No usage card compiled for ${component.id} yet. Re-index the project (request_project_reindex) to mine usage data, or fall back to get_indexed_component.`,
      );
    }
    throw new Error(`Indexed component not found: ${input.componentId}`);
  },
};

const ListPatternsInput = z.object({}).strict();

export const listPatterns: ServerTool<z.infer<typeof ListPatternsInput>, unknown> = {
  name: 'list_patterns',
  description:
    'List compiled composition patterns (project screen grammar from confirmed screen templates and mined evidence). Use before composing a full screen.',
  inputSchema: ListPatternsInput,
  handler: async (_input, ctx) => {
    const workspacePath = requireWorkspace(ctx);
    const patterns = await readProjectIndexJsonl<CompositionPatternRecord>(
      workspacePath,
      DESIGN_INDEX_PATHS.patterns,
    );
    return {
      patterns: patterns.map((pattern) => ({
        id: pattern.id,
        kind: pattern.kind,
        name: pattern.name,
        description: compactLine(pattern.description, 200),
        status: pattern.status,
        slotRoles: pattern.slots.map((slot) => slot.role),
      })),
    };
  },
};

const GetPatternInput = z
  .object({
    id: z.string().min(1).describe('Pattern id from list_patterns, e.g. "template-deal-page".'),
  })
  .strict();

export const getPattern: ServerTool<z.infer<typeof GetPatternInput>, unknown> = {
  name: 'get_pattern',
  description:
    'Read one composition pattern with full slots (role, bound componentIds, presets) and evidence.',
  inputSchema: GetPatternInput,
  handler: async (input, ctx) => {
    const workspacePath = requireWorkspace(ctx);
    const needle = normalizeSearch(input.id);
    const patterns = await readProjectIndexJsonl<CompositionPatternRecord>(
      workspacePath,
      DESIGN_INDEX_PATHS.patterns,
    );
    const pattern = patterns.find((item) => normalizeSearch(item.id) === needle);
    if (!pattern) throw new Error(`Pattern not found: ${input.id}`);
    return { pattern };
  },
};

const GetIndexedTokenInput = z
  .object({
    idOrName: z.string().min(1).describe('Token id or token name from tokens.json.'),
  })
  .strict();

export const getIndexedToken: ServerTool<z.infer<typeof GetIndexedTokenInput>, unknown> = {
  name: 'get_indexed_token',
  description: 'Read one indexed token by id or name from .sber-designer/design-index/tokens.json.',
  inputSchema: GetIndexedTokenInput,
  handler: async (input, ctx) => {
    const workspacePath = requireWorkspace(ctx);
    const needle = normalizeSearch(input.idOrName);
    const token = (await readTokens(workspacePath)).find(
      (item) => normalizeSearch(item.id) === needle || normalizeSearch(item.name) === needle,
    );
    if (!token) throw new Error(`Indexed token not found: ${input.idOrName}`);
    return { token };
  },
};

const GetIndexedAssetInput = z
  .object({
    idOrName: z
      .string()
      .min(1)
      .describe('Asset id, name, file path, importName, or filename from assets.jsonl.'),
  })
  .strict();

export const getIndexedAsset: ServerTool<z.infer<typeof GetIndexedAssetInput>, unknown> = {
  name: 'get_indexed_asset',
  description:
    'Read one indexed project asset by id/name/path/importName from .sber-designer/design-index/assets.jsonl. Use for imported icons, illustrations, and image files.',
  inputSchema: GetIndexedAssetInput,
  handler: async (input, ctx) => {
    const workspacePath = requireWorkspace(ctx);
    const needle = normalizeSearch(input.idOrName);
    const asset = (await readAssets(workspacePath)).find((item) =>
      assetSearchKeys(item).some(
        (key) => normalizeSearch(key) === needle || normalizeSearch(key).includes(needle),
      ),
    );
    if (!asset) throw new Error(`Indexed asset not found: ${input.idOrName}`);
    return { asset };
  },
};

const ListIndexedScreensInput = z
  .object({
    designReadableStatus: z.enum(['unknown', 'candidate', 'compatible', 'needs-review']).optional(),
  })
  .strict();

export const listIndexedScreens: ServerTool<z.infer<typeof ListIndexedScreensInput>, unknown> = {
  name: 'list_indexed_screens',
  description:
    'List indexed screens from screens.jsonl with implementation/story ownership and Design-readable status.',
  inputSchema: ListIndexedScreensInput,
  handler: async (input, ctx) => {
    const workspacePath = requireWorkspace(ctx);
    const screens = await readProjectIndexJsonl<ScreenIndexRecord>(
      workspacePath,
      DESIGN_INDEX_PATHS.screens,
    );
    const filtered = input.designReadableStatus
      ? screens.filter((screen) => screen.designReadableStatus === input.designReadableStatus)
      : screens;
    return { screens: filtered, count: filtered.length };
  },
};

const RequestProjectReindexInput = z
  .object({
    reason: z.string().min(1).optional(),
  })
  .strict();

export const requestProjectReindex: ServerTool<
  z.infer<typeof RequestProjectReindexInput>,
  unknown
> = {
  name: 'request_project_reindex',
  description:
    'Start a background project re-index job for derived .sber-designer/design-index artifacts and return the job id/status endpoint. Safe to call after writing component descriptions; repeated calls while a job is active return the existing job.',
  inputSchema: RequestProjectReindexInput,
  handler: async (input, ctx) => {
    const workspacePath = requireWorkspace(ctx);
    const existing = findActiveProjectIndexJob(workspacePath);
    const project = getProject();
    const job =
      existing ??
      startProjectIndexJob({
        workspaceRoot: workspacePath,
        projectName: project.name || ctx.projectName || 'Untitled project',
        ...(ctx.canvasUrl ? { canvasUrl: ctx.canvasUrl } : {}),
      });
    return {
      started: !existing,
      alreadyRunning: Boolean(existing),
      jobId: job.id,
      statusEndpoint: `/api/project/design-index/jobs/${job.id}`,
      reason: input.reason ?? 'Project index may be stale or missing.',
      message: existing
        ? 'Project re-index is already running; poll the status endpoint for completion.'
        : 'Project re-index started; poll the status endpoint for completion.',
    };
  },
};

const ImportAssetPackInput = z
  .object({
    sourcePath: z
      .string()
      .min(1)
      .describe(
        'Absolute local folder path inside the connected project. If the user has assets elsewhere, ask them to copy the folder into the project before importing.',
      ),
    packName: z.string().min(1).optional().describe('Human label for the imported asset pack.'),
    kinds: z
      .array(z.enum(['icons', 'illustrations']))
      .min(1)
      .default(['icons', 'illustrations']),
    overwrite: z.boolean().default(false),
  })
  .strict();

export const importAssetPackTool: ServerTool<
  z.infer<typeof ImportAssetPackInput>,
  unknown,
  z.input<typeof ImportAssetPackInput>
> = {
  name: 'import_asset_pack',
  description:
    'Import a user-approved in-project folder of SVG/PNG/JPG/WebP/AVIF icons or illustrations, generate Storybook asset galleries when Storybook exists, and refresh the project design index.',
  inputSchema: ImportAssetPackInput,
  handler: async (input, ctx) => {
    const workspacePath = requireWorkspace(ctx);
    const importResult = await importAssetPack({
      workspaceRoot: workspacePath,
      sourcePath: input.sourcePath,
      packName: input.packName ?? 'Imported assets',
      kinds: input.kinds as AssetPackKind[],
      overwrite: input.overwrite,
    });
    for (const filePath of importResult.changedFiles) {
      markStorybookReloadPendingForPath(filePath, true);
    }
    const catalogResult = await resolveCatalog({
      canvasUrl: ctx.canvasUrl,
      workspacePath,
      bypass: true,
    });
    const project = getProject();
    const indexResult = await generateProjectDesignIndexFiles(workspacePath, {
      projectName: project.name || ctx.projectName || 'Untitled project',
      catalog: 'catalog' in catalogResult ? catalogResult.catalog : null,
    });
    const changedFiles = Array.from(
      new Set([...importResult.changedFiles, ...indexResult.changedFiles]),
    );
    await recordToolReceiptSafely({
      workspacePath,
      runId: ctx.runId,
      tool: 'import_asset_pack',
      status: 'ok',
      changedFiles,
      summary: `Imported ${importResult.imported} asset${importResult.imported === 1 ? '' : 's'} and refreshed the project index.`,
      metadata: {
        imported: importResult.imported,
        skipped: importResult.skipped,
        indexChangedFiles: indexResult.changedFiles,
      },
    });
    return {
      ok: true,
      imported: importResult.imported,
      skipped: importResult.skipped,
      changedFiles,
      assetChangedFiles: importResult.changedFiles,
      indexChangedFiles: indexResult.changedFiles,
      projectIndex: {
        status: indexResult.context.status,
        stale: indexResult.context.stale,
        counts: indexResult.context.manifest?.counts ?? emptyProjectIndexCounts(),
      },
    };
  },
};
