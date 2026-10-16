/**
 * @sber-designer/storybook-indexer — public surface.
 *
 * Two strategies (ADR-0011):
 *   - indexFromStorybook(previewUrl) — fetch /index.json from the
 *     running Storybook dev-server. Preferred when available.
 *   - indexFromStaticAst(workspaceRoot) — scan the workspace for
 *     default-exported React components. Fallback for repos without
 *     Storybook (Phase 1.7).
 */
import type {
  ComponentCatalog,
  ComponentDescriptionLayer,
  ComponentEntry,
  StoryEntry,
} from '@sber-designer/shared-types';

import { StorybookIndexSchema, type StorybookIndexEntry } from './storybook-index';
import {
  componentDescriptionToMarkdown,
  extractStorybookUsageMetadata,
  readComponentSidecarDescription,
  readComponentSidecarLayer,
  storyDescriptionToMarkdown,
} from './usage-metadata';

export { StorybookIndexSchema };
export type { StorybookIndex, StorybookIndexEntry } from './storybook-index';
export { indexFromStaticAst } from './static-indexer';
export type { IndexFromStaticAstOptions } from './static-indexer';
export {
  componentDescriptionToMarkdown,
  extractStorybookUsageMetadata,
  readComponentSidecarDescription,
  readComponentSidecarLayer,
  storyDescriptionToMarkdown,
};
export type { StorybookUsageMetadata } from './usage-metadata';
export {
  coerceComponentLayer,
  descriptionLayerFromMarkdown,
  descriptionLayerToMarkdown,
  extractDescriptionForAiSection,
  extractStructuredLayerBlock,
  hasDescriptionForAiSection,
  parseDescriptionForAi,
} from './description-for-ai';
export type { ParsedDescriptionForAi } from './description-for-ai';

export interface IndexFromStorybookOptions {
  fetchImpl?: typeof fetch;
  /** Defaults to 5_000ms. */
  timeoutMs?: number;
  /** Workspace root used to read CSF files and local description metadata. */
  workspaceRoot?: string;
}

/**
 * Fetches `<previewUrl>/index.json`, validates it, groups story entries
 * by their `title` into a ComponentCatalog. `type==='docs'` entries are
 * skipped — they are auto-generated and don't represent components.
 *
 * Throws on network/parse failure; callers are expected to surface a
 * clean error and let the user retry.
 */
export async function indexFromStorybook(
  previewUrl: string,
  opts: IndexFromStorybookOptions = {},
): Promise<ComponentCatalog> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = previewUrl.replace(/\/+$/, '') + '/index.json';

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? 5_000);

  let response: Response;
  try {
    response = await fetchImpl(url, { signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Storybook index fetch failed: HTTP ${response.status} from ${url}`);
  }

  const raw = (await response.json()) as unknown;
  const parsed = StorybookIndexSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Storybook index schema mismatch: ${parsed.error.message}`);
  }

  const components = await groupByComponent(parsed.data.entries, previewUrl, opts.workspaceRoot);

  return {
    source: 'storybook',
    generatedAt: Date.now(),
    previewUrl,
    components,
  };
}

interface ComponentGroup {
  entry: ComponentEntry;
  /** Stable public component name from CSF `component:`, when known (0082). */
  identityName?: string;
  /** Titles of every merged story file, for common-prefix display title. */
  titles: string[];
}

async function groupByComponent(
  entries: Record<string, StorybookIndexEntry>,
  previewUrl: string,
  workspaceRoot?: string,
): Promise<ComponentEntry[]> {
  // Preserve sidebar order — the index.json is already sorted by Storybook.
  const grouped = new Map<string, ComponentGroup>();
  const metadataByImportPath = new Map<
    string,
    Awaited<ReturnType<typeof extractStorybookUsageMetadata>>
  >();

  for (const entry of Object.values(entries)) {
    if (entry.type !== 'story') continue;
    const metadata = workspaceRoot
      ? await metadataForImportPath(workspaceRoot, entry.importPath, metadataByImportPath)
      : null;
    const storyMetadata = metadata?.stories.get(entry.name);
    // 0082 Track 1: merge story files that document the same component
    // (same CSF `component:` symbol + import source) into one catalog entry,
    // keyed by public identity. Fall back to per-title grouping when the
    // identity is unknown (no source access / `component:` omitted).
    const identity = metadata?.componentIdentity;
    const groupKey = identity
      ? `id${identity.name}${identity.importSource}`
      : `title${entry.title}`;
    const existing = grouped.get(groupKey);
    const story: StoryEntry = {
      id: entry.id,
      name: entry.name,
      previewUrl: storyPreviewUrl(previewUrl, entry.id),
      ...(storyMetadata?.description ? { description: storyMetadata.description } : {}),
      ...(storyMetadata?.descriptionLayer
        ? { descriptionLayer: storyMetadata.descriptionLayer }
        : {}),
    };
    if (existing) {
      if (!existing.entry.description && metadata?.component?.description) {
        existing.entry.description = metadata.component.description;
      }
      if (!existing.entry.descriptionLayer && metadata?.component?.descriptionLayer) {
        existing.entry.descriptionLayer = metadata.component.descriptionLayer;
      }
      existing.entry.stories.push(story);
      existing.titles.push(entry.title);
      continue;
    }
    grouped.set(groupKey, {
      ...(identity ? { identityName: identity.name } : {}),
      titles: [entry.title],
      entry: {
        id: kebab(entry.title),
        title: entry.title,
        shortName: identity?.name ?? shortName(entry.title),
        filePath: normalizeImportPath(entry.importPath),
        ...(metadata?.component?.description
          ? { description: metadata.component.description }
          : {}),
        ...(metadata?.component?.descriptionLayer
          ? { descriptionLayer: metadata.component.descriptionLayer }
          : {}),
        stories: [story],
      },
    });
  }

  const components = [...grouped.values()].map((group) => finalizeGroup(group));
  if (workspaceRoot) {
    for (const component of components) {
      // 0083 E1: a plain CSF `docs.description.component`, or a draft/markdown-
      // derived layer, must NOT block a confirmed sidecar from reaching the index
      // — otherwise a freshly-authored .sber-designer/components/<id>.md never
      // raises coverage. Only an already-confirmed structured layer (an authored
      // Storybook source — conflict rule 2) lets us skip the sidecar read.
      const hasConfirmedLayer = component.descriptionLayer?.status === 'confirmed';
      if (component.description && hasConfirmedLayer) continue;
      const sidecar = await readComponentSidecarLayer(workspaceRoot, component);
      if (!sidecar) continue;
      if (!component.description && sidecar.description) {
        component.description = sidecar.description;
      }
      if (
        sidecar.descriptionLayer &&
        shouldAdoptSidecarLayer(component.descriptionLayer, sidecar.descriptionLayer)
      ) {
        component.descriptionLayer = sidecar.descriptionLayer;
      }
    }
  }
  return components;
}

/**
 * 0083 E1 — decide whether a sidecar layer wins over what the CSF already
 * carries. No existing layer → adopt. A confirmed sidecar overrides a
 * non-confirmed (draft / markdown-derived) layer; an already-confirmed
 * structured CSF layer is kept (authored Storybook source wins, conflict rule 2).
 */
function shouldAdoptSidecarLayer(
  existing: ComponentDescriptionLayer | undefined,
  sidecar: ComponentDescriptionLayer,
): boolean {
  if (!existing) return true;
  if (existing.status === 'confirmed') return false;
  return sidecar.status === 'confirmed';
}

/**
 * Collapse a merged group's display identity: title becomes the longest common
 * title prefix of its story files (`Organisms/Table/Basic` + `…/Configuration`
 * -> `Organisms/Table`), and id is derived from it. shortName keeps the public
 * component name when known. Single-story groups are unchanged.
 */
function finalizeGroup(group: ComponentGroup): ComponentEntry {
  if (group.titles.length <= 1) return group.entry;
  const commonTitle = longestCommonTitlePrefix(group.titles);
  if (!commonTitle) return group.entry;
  return {
    ...group.entry,
    title: commonTitle,
    id: kebab(commonTitle),
    shortName: group.identityName ?? shortName(commonTitle),
  };
}

/** Longest shared `Category/Component` path prefix across Storybook titles. */
function longestCommonTitlePrefix(titles: string[]): string {
  const segmentLists = titles.map((title) => title.split('/'));
  const first = segmentLists[0];
  if (!first) return '';
  const prefix: string[] = [];
  for (let depth = 0; depth < first.length; depth += 1) {
    const segment = first[depth];
    if (segmentLists.every((segs) => segs[depth] === segment)) prefix.push(segment as string);
    else break;
  }
  return prefix.join('/');
}

async function metadataForImportPath(
  workspaceRoot: string,
  importPath: string,
  cache: Map<string, Awaited<ReturnType<typeof extractStorybookUsageMetadata>>>,
) {
  const key = importPath.replace(/^\.\//, '');
  const cached = cache.get(key);
  if (cached) return cached;
  const metadata = await extractStorybookUsageMetadata({ workspaceRoot, importPath });
  cache.set(key, metadata);
  return metadata;
}

function storyPreviewUrl(base: string, storyId: string): string {
  // Storybook serves the iframe with ?id=<storyId>; viewMode=story shows
  // the bare component without the docs shell.
  const u = new URL('iframe.html', base.endsWith('/') ? base : base + '/');
  u.searchParams.set('id', storyId);
  u.searchParams.set('viewMode', 'story');
  u.searchParams.set('shortcuts', 'false');
  u.searchParams.set('singleStory', 'true');
  return u.toString();
}

function shortName(title: string): string {
  const segs = title.split('/');
  return segs[segs.length - 1] ?? title;
}

function kebab(s: string): string {
  return s
    .replace(/[\s/]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function normalizeImportPath(p: string): string {
  // Storybook prefixes "./" — drop it for cleaner display.
  return p.replace(/^\.\//, '');
}
