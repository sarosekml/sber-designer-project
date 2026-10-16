import { DESIGN_INDEX_PATHS, type IndexedComponentRecord } from '@sber-designer/design-indexer';
import {
  descriptionLayerToMarkdown,
  extractStorybookUsageMetadata,
  readComponentSidecarLayer,
} from '@sber-designer/storybook-indexer';
import type { ComponentDescriptionLayer } from '@sber-designer/shared-types';

import { readHtmlDesignSystemDescriptionProjection } from './html-design-system-description-write';

export type ComponentDescriptionSurfaceKind = 'sidecar' | 'indexed' | 'storybook' | 'design-system';

export interface ComponentDescriptionSurfaceReadback {
  source: ComponentDescriptionSurfaceKind;
  path: string;
  status: ComponentDescriptionLayer['status'] | null;
  updatedAt: string | null;
  fresh: boolean;
  descriptionLayer: ComponentDescriptionLayer | null;
  markdown: string | null;
  diagnostics: string[];
}

export interface ComponentDescriptionSourceReadback {
  componentId: string;
  source: 'sidecar' | 'index' | 'projection' | 'none';
  sidecarPath: string;
  canonical: ComponentDescriptionSurfaceReadback | null;
  indexed: ComponentDescriptionSurfaceReadback | null;
  projections: ComponentDescriptionSurfaceReadback[];
  descriptionLayer: ComponentDescriptionLayer | null;
  markdown: string | null;
  diagnostics: string[];
}

export function compareableLayer(layer: ComponentDescriptionLayer | null | undefined): {
  purpose: string;
  keywords: string[];
  requiredProps: string[];
  variantGuidance: { prop: string; values: { value: string; meaning: string }[] }[];
  canonicalSnippets: string[];
} {
  const normMeaning = (value: string) => value.trim().replace(/[.;]+$/u, '');
  return {
    purpose: layer?.purpose?.trim() ?? '',
    keywords: (layer?.keywords ?? []).map((keyword) => keyword.trim()),
    requiredProps: layer?.requiredProps ?? [],
    variantGuidance: (layer?.variantGuidance ?? []).map((guidance) => ({
      prop: guidance.prop,
      values: guidance.values.map((value) => ({
        value: value.value,
        meaning: normMeaning(value.meaning),
      })),
    })),
    canonicalSnippets: (layer?.canonicalSnippets ?? []).map((snippet) => snippet.code.trim()),
  };
}

export function divergentDescriptionLayerFields(
  canonical: ComponentDescriptionLayer | null | undefined,
  candidate: ComponentDescriptionLayer | null | undefined,
): string[] {
  const a = compareableLayer(canonical);
  const b = compareableLayer(candidate);
  return (Object.keys(a) as Array<keyof ReturnType<typeof compareableLayer>>).filter(
    (key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]),
  );
}

export async function readComponentDescriptionSource(
  workspacePath: string,
  component: IndexedComponentRecord,
): Promise<ComponentDescriptionSourceReadback> {
  const sidecarPath = `.sber-designer/components/${component.id}.md`;
  const sidecar = await readComponentSidecarLayer(workspacePath, component);
  const canonical = sidecar?.descriptionLayer
    ? surface({
        source: 'sidecar',
        path: sidecarPath,
        layer: sidecar.descriptionLayer,
        markdown: sidecar.description,
      })
    : null;
  const indexed = component.descriptionLayer
    ? surface({
        source: 'indexed',
        path: DESIGN_INDEX_PATHS.components,
        layer: component.descriptionLayer,
        markdown: component.description ?? descriptionLayerToMarkdown(component.descriptionLayer),
        canonical,
      })
    : null;
  const projections = (
    await Promise.all([
      readStorybookProjection(workspacePath, component, canonical),
      readDesignSystemProjection(workspacePath, component, canonical),
    ])
  ).filter((item): item is ComponentDescriptionSurfaceReadback => Boolean(item));
  const diagnostics = uniqueDiagnostics([
    ...(indexed?.diagnostics ?? []),
    ...projections.flatMap((projection) => projection.diagnostics),
  ]);
  const descriptionLayer =
    canonical?.descriptionLayer ??
    indexed?.descriptionLayer ??
    projections.find((projection) => projection.descriptionLayer)?.descriptionLayer ??
    null;
  const markdown =
    canonical?.markdown ??
    indexed?.markdown ??
    projections.find((projection) => projection.markdown)?.markdown ??
    null;
  const source = canonical
    ? 'sidecar'
    : indexed
      ? 'index'
      : projections.length > 0
        ? 'projection'
        : 'none';

  return {
    componentId: component.id,
    source,
    sidecarPath,
    canonical,
    indexed,
    projections,
    descriptionLayer,
    markdown,
    diagnostics:
      source === 'none'
        ? ['No authored description found. This component is still undescribed.']
        : diagnostics,
  };
}

async function readStorybookProjection(
  workspacePath: string,
  component: IndexedComponentRecord,
  canonical: ComponentDescriptionSurfaceReadback | null,
): Promise<ComponentDescriptionSurfaceReadback | null> {
  if (!component.filePath || !/\.stories\.[jt]sx?$/u.test(component.filePath)) return null;
  try {
    const metadata = await extractStorybookUsageMetadata({
      workspaceRoot: workspacePath,
      importPath: component.filePath,
    });
    const layer = metadata.component?.descriptionLayer;
    if (!layer) return null;
    return surface({
      source: 'storybook',
      path: component.filePath,
      layer,
      markdown: descriptionLayerToMarkdown(layer),
      canonical,
    });
  } catch {
    return null;
  }
}

async function readDesignSystemProjection(
  workspacePath: string,
  component: IndexedComponentRecord,
  canonical: ComponentDescriptionSurfaceReadback | null,
): Promise<ComponentDescriptionSurfaceReadback | null> {
  if (component.source !== 'css-catalog') return null;
  const projection = await readHtmlDesignSystemDescriptionProjection({
    workspacePath,
    component,
  });
  if (!projection) return null;
  return surface({
    source: 'design-system',
    path: projection.filePath,
    layer: projection.descriptionLayer,
    markdown: projection.markdown,
    canonical,
  });
}

function surface(input: {
  source: ComponentDescriptionSurfaceKind;
  path: string;
  layer: ComponentDescriptionLayer;
  markdown: string | null;
  canonical?: ComponentDescriptionSurfaceReadback | null;
}): ComponentDescriptionSurfaceReadback {
  const fields = input.canonical?.descriptionLayer
    ? divergentDescriptionLayerFields(input.canonical.descriptionLayer, input.layer)
    : [];
  const diagnostics =
    fields.length > 0
      ? [
          `sources diverge: ${surfaceLabel(input.source)} differs from canonical sidecar (${fields.join(
            ', ',
          )})`,
        ]
      : [];
  return {
    source: input.source,
    path: input.path,
    status: input.layer.status ?? null,
    updatedAt: input.layer.updatedAt ?? null,
    fresh: !input.canonical?.descriptionLayer || fields.length === 0,
    descriptionLayer: input.layer,
    markdown: input.markdown,
    diagnostics,
  };
}

function surfaceLabel(source: ComponentDescriptionSurfaceKind): string {
  if (source === 'storybook') return 'Storybook projection';
  if (source === 'design-system') return 'design-system projection';
  if (source === 'indexed') return 'indexed layer';
  return 'sidecar';
}

function uniqueDiagnostics(diagnostics: string[]): string[] {
  return Array.from(new Set(diagnostics.filter(Boolean)));
}
