import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import {
  DESIGN_INDEX_PATHS,
  buildDescriptionMap,
  type ComponentUsageCard,
  type IndexedComponentRecord,
} from '@sber-designer/design-indexer';
import {
  descriptionLayerToMarkdown,
  readComponentSidecarLayer,
} from '@sber-designer/storybook-indexer';
import type { ComponentDescriptionLayer } from '@sber-designer/shared-types';

import { readWorkspaceFile, writeWorkspaceFile } from '../safe-fs';

const SIDECAR_DIR = '.sber-designer/components';

export const ListUndescribedInput = z
  .object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe('Max components to return (default 10).'),
  })
  .strict();

const VariantGuidanceSchema = z.object({
  prop: z.string().min(1),
  values: z.array(z.object({ value: z.string(), meaning: z.string() })).min(1),
});

export const DescriptionLayerSchema = z.object({
  purpose: z.string().min(1).describe('One sentence - what the component is for.'),
  keywords: z.array(z.string()).optional().describe('2-3 retrieval keywords.'),
  whenToUse: z.array(z.string()).optional(),
  whenNotToUse: z.array(z.string()).optional(),
  variantGuidance: z.array(VariantGuidanceSchema).optional(),
  requiredProps: z.array(z.string()).optional(),
  canonicalSnippets: z
    .array(z.object({ code: z.string(), label: z.string().optional() }))
    .optional(),
  pairsWith: z.array(z.string()).optional(),
  a11yNotes: z.array(z.string()).optional(),
  interactionNotes: z.array(z.string()).optional(),
  agentGuidance: z.array(z.string()).optional(),
  anatomy: z.array(z.string()).optional(),
  evidence: z.array(z.object({ source: z.string(), ref: z.string().optional() })).optional(),
  status: z.enum(['draft', 'confirmed']).optional(),
});

export const WriteComponentDescriptionInput = z.object({
  componentId: z.string().min(1).describe('Component id, title, or shortName.'),
  layer: z
    .union([DescriptionLayerSchema, z.string()])
    .describe('The Description for AI layer object (or a JSON string of it).'),
  target: z
    .enum(['sidecar', 'storybook', 'design-system', 'auto'])
    .optional()
    .describe(
      'Write target (default sidecar). API/in-product tools may also project to Storybook or design-system surfaces; file fallback writes the sidecar.',
    ),
});

export const GetComponentDescriptionSourceInput = z
  .object({
    componentId: z.string().min(1).describe('Component id, title, or shortName.'),
  })
  .strict();

export type DescriptionWriteTarget = 'sidecar' | 'storybook' | 'design-system';

export interface ComponentDescriptionWriteCoreResult {
  publicResult: {
    ok: true;
    componentId: string;
    shortName: string;
    sidecarPath: string;
    status: ComponentDescriptionLayer['status'];
    reindexHint: string;
  };
  component: IndexedComponentRecord;
  layer: ComponentDescriptionLayer;
  target: DescriptionWriteTarget;
  sidecarPath: string;
  changedFiles: string[];
}

export async function listUndescribedComponentsForWorkspace(
  input: z.infer<typeof ListUndescribedInput>,
  workspacePath: string,
): Promise<unknown> {
  const [components, usageCards, sidecarIds] = await Promise.all([
    readComponents(workspacePath),
    readUsageCards(workspacePath),
    readSidecarComponentIds(workspacePath),
  ]);
  const map = buildDescriptionMap({ components, usageCards });
  const usageById = new Map(usageCards.map((card) => [card.componentId, card.usageCount]));
  const componentById = new Map(components.map((component) => [component.id, component]));

  const describable = map.filter(
    (entry) => !isComponentIdentityArtifact(entry.componentId, entry.shortName),
  );
  const sidecarAuthored = new Set<string>();
  for (const entry of describable) {
    if (entry.status === 'authored' || !sidecarIds.has(entry.componentId)) continue;
    const component = componentById.get(entry.componentId);
    if (!component) continue;
    const sidecar = await readComponentSidecarLayer(workspacePath, component);
    if (sidecar?.descriptionLayer) sidecarAuthored.add(entry.componentId);
  }

  const undescribed = describable.filter(
    (entry) => entry.status !== 'authored' && !sidecarAuthored.has(entry.componentId),
  );
  const queue = undescribed
    .map((entry) => ({
      componentId: entry.componentId,
      shortName: entry.shortName,
      status: entry.status,
      keywords: entry.keywords,
      usageCount: usageById.get(entry.componentId) ?? 0,
      confidence: componentById.get(entry.componentId)?.confidence ?? 'low',
      sourcePath: entry.docsRef.sourcePath,
    }))
    .sort(
      (a, b) =>
        b.usageCount - a.usageCount ||
        confidenceRank(b.confidence) - confidenceRank(a.confidence) ||
        a.componentId.localeCompare(b.componentId),
    )
    .map(({ confidence: _confidence, ...entry }) => entry);

  const describedCount = describable.length - undescribed.length;
  return {
    queue: queue.slice(0, input.limit ?? 10),
    remaining: undescribed.length,
    describedCount,
    totalComponents: describable.length,
    progress: { index: describedCount + 1, total: describable.length },
  };
}

export async function writeComponentDescriptionSidecarForWorkspace(
  input: z.infer<typeof WriteComponentDescriptionInput>,
  workspacePath: string,
): Promise<ComponentDescriptionWriteCoreResult> {
  const components = await readComponents(workspacePath);
  const component = findComponent(components, input.componentId);
  if (!component) {
    throw new Error(
      `Indexed component not found: ${input.componentId}. Use list_undescribed_components or search_project_index for valid ids.`,
    );
  }
  const layer = buildComponentDescriptionLayer(resolveDescriptionLayerInput(input.layer));
  const target = resolveDescriptionWriteTarget(component, input.target);
  const sidecarPath = `${SIDECAR_DIR}/${component.id}.md`;
  await writeWorkspaceFile(
    workspacePath,
    sidecarPath,
    renderComponentDescriptionSidecar(component, layer),
  );
  return {
    publicResult: {
      ok: true,
      componentId: component.id,
      shortName: component.shortName,
      sidecarPath,
      status: layer.status,
      reindexHint:
        'Call request_project_reindex after the pass to recompile usage-cards and the description-map.',
    },
    component,
    layer,
    target,
    sidecarPath,
    changedFiles: [sidecarPath],
  };
}

export async function getComponentDescriptionSourceForWorkspace(
  input: z.infer<typeof GetComponentDescriptionSourceInput>,
  workspacePath: string,
): Promise<unknown> {
  const components = await readComponents(workspacePath);
  const component = findComponent(components, input.componentId);
  if (!component) throw new Error(`Indexed component not found: ${input.componentId}`);
  const sidecar = await readComponentSidecarLayer(workspacePath, component);
  const source = sidecar?.descriptionLayer
    ? 'sidecar'
    : component.descriptionLayer
      ? 'index'
      : 'none';
  return {
    componentId: component.id,
    source,
    sidecarPath: `${SIDECAR_DIR}/${component.id}.md`,
    descriptionLayer: sidecar?.descriptionLayer ?? component.descriptionLayer ?? null,
    markdown: sidecar?.description ?? null,
    diagnostics:
      source === 'none'
        ? ['No authored description found. This component is still undescribed.']
        : [],
  };
}

export function resolveDescriptionWriteTarget(
  component: IndexedComponentRecord,
  requested: z.infer<typeof WriteComponentDescriptionInput>['target'],
): DescriptionWriteTarget {
  if (!requested || requested === 'sidecar') return 'sidecar';
  if (requested === 'auto') {
    return component.source === 'css-catalog' ? 'design-system' : 'storybook';
  }
  return requested;
}

async function readComponents(workspacePath: string): Promise<IndexedComponentRecord[]> {
  return readDesignIndexJsonl<IndexedComponentRecord>(workspacePath, DESIGN_INDEX_PATHS.components);
}

async function readUsageCards(workspacePath: string): Promise<ComponentUsageCard[]> {
  return readDesignIndexJsonl<ComponentUsageCard>(workspacePath, DESIGN_INDEX_PATHS.usageCards);
}

async function readDesignIndexJsonl<T>(workspacePath: string, filePath: string): Promise<T[]> {
  let contents = '';
  try {
    contents = await readWorkspaceFile(workspacePath, filePath);
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

async function readSidecarComponentIds(workspacePath: string): Promise<Set<string>> {
  try {
    const entries = await readdir(join(workspacePath, SIDECAR_DIR));
    return new Set(
      entries.filter((name) => name.endsWith('.md')).map((name) => name.slice(0, -'.md'.length)),
    );
  } catch {
    return new Set();
  }
}

function compactName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isComponentIdentityArtifact(componentId: string, shortName: string | undefined): boolean {
  const name = compactName(shortName ?? '');
  if (!name) return false;
  return !compactName(componentId).includes(name);
}

function confidenceRank(confidence: IndexedComponentRecord['confidence'] | undefined): number {
  if (confidence === 'high') return 2;
  if (confidence === 'medium') return 1;
  return 0;
}

function findComponent(
  components: IndexedComponentRecord[],
  needle: string,
): IndexedComponentRecord | undefined {
  const query = normalizeSearch(needle);
  return components.find(
    (component) =>
      normalizeSearch(component.id) === query ||
      normalizeSearch(component.title) === query ||
      normalizeSearch(component.shortName) === query,
  );
}

function normalizeSearch(value: string | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function resolveDescriptionLayerInput(
  raw: z.infer<typeof DescriptionLayerSchema> | string,
): z.infer<typeof DescriptionLayerSchema> {
  if (typeof raw !== 'string') return raw;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      'The `layer` was a string but not valid JSON. Send it as a JSON object with at least { "purpose": "..." }.',
    );
  }
  return DescriptionLayerSchema.parse(parsed);
}

export function buildComponentDescriptionLayer(
  input: z.infer<typeof DescriptionLayerSchema>,
): ComponentDescriptionLayer {
  return {
    purpose: input.purpose,
    anatomy: input.anatomy ?? [],
    usage: [],
    agentGuidance: input.agentGuidance ?? [],
    schemaVersion: 1,
    ...(input.keywords?.length ? { keywords: input.keywords } : {}),
    ...(input.whenToUse?.length ? { whenToUse: input.whenToUse } : {}),
    ...(input.whenNotToUse?.length ? { whenNotToUse: input.whenNotToUse } : {}),
    ...(input.variantGuidance?.length ? { variantGuidance: input.variantGuidance } : {}),
    ...(input.requiredProps?.length ? { requiredProps: input.requiredProps } : {}),
    ...(input.canonicalSnippets?.length
      ? {
          canonicalSnippets: input.canonicalSnippets.map((snippet) =>
            snippet.label !== undefined
              ? { code: snippet.code, label: snippet.label }
              : { code: snippet.code },
          ),
        }
      : {}),
    ...(input.pairsWith?.length ? { pairsWith: input.pairsWith } : {}),
    ...(input.a11yNotes?.length ? { a11yNotes: input.a11yNotes } : {}),
    ...(input.interactionNotes?.length ? { interactionNotes: input.interactionNotes } : {}),
    ...(input.evidence?.length
      ? {
          evidence: input.evidence.map((item) =>
            item.ref !== undefined
              ? { source: item.source, ref: item.ref }
              : { source: item.source },
          ),
        }
      : {}),
    status: input.status ?? 'confirmed',
    updatedAt: new Date().toISOString(),
  };
}

export function renderComponentDescriptionSidecar(
  component: IndexedComponentRecord,
  layer: ComponentDescriptionLayer,
): string {
  const json = JSON.stringify({ descriptionLayer: layer }, null, 2);
  return [
    `# ${component.shortName}`,
    '',
    descriptionLayerToMarkdown(layer),
    '',
    '<!-- Machine-managed by the sber-designer description agent. The fenced',
    '     block below is the canonical structured source; edit via the agent. -->',
    '```sberDesigner',
    json,
    '```',
    '',
  ].join('\n');
}
