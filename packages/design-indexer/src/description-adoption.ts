import type { BuildDesignIndexInput, DesignIndexDiagnostic, IndexedComponentRecord } from './types';

const DESCRIPTION_LAYER_DIVERGENCE_FIELDS = [
  'purpose',
  'whenToUse',
  'whenNotToUse',
  'variantGuidance',
  'requiredProps',
  'canonicalSnippets',
  'keywords',
] as const;

export function applyCssCatalogDescriptionLayers(
  components: IndexedComponentRecord[],
  sidecarLayers: BuildDesignIndexInput['componentSidecarLayers'],
  surfaceLayers: BuildDesignIndexInput['componentSurfaceLayers'],
): IndexedComponentRecord[] {
  if (!sidecarLayers && !surfaceLayers) return components;
  return components.map((component) => {
    if (component.source !== 'css-catalog' || component.descriptionLayer) return component;
    const descriptionLayer = sidecarLayers?.[component.id] ?? surfaceLayers?.[component.id];
    if (!descriptionLayer) return component;
    return {
      ...component,
      description: component.description ?? descriptionLayer.purpose,
      descriptionLayer,
      confidence: 'high',
    };
  });
}

export function buildDescriptionLayerDivergenceDiagnostics(
  input: Pick<BuildDesignIndexInput, 'componentSidecarLayers' | 'componentSurfaceLayers'>,
  components: IndexedComponentRecord[],
): DesignIndexDiagnostic[] {
  if (!input.componentSidecarLayers || !input.componentSurfaceLayers) return [];
  const diagnostics: DesignIndexDiagnostic[] = [];
  for (const component of components) {
    if (component.source !== 'css-catalog') continue;
    const sidecar = input.componentSidecarLayers[component.id];
    const surface = input.componentSurfaceLayers[component.id];
    if (!sidecar || !surface) continue;
    const fields = DESCRIPTION_LAYER_DIVERGENCE_FIELDS.filter(
      (field) =>
        normalizedDescriptionValue(sidecar[field]) !== normalizedDescriptionValue(surface[field]),
    );
    if (fields.length === 0) continue;
    diagnostics.push({
      level: 'warning',
      filePath: component.filePath,
      message: `description-diverged: ${component.id} has divergent ${fields.join(
        ', ',
      )} between sidecar and design-system surface. Sidecar layer is used; re-project or import from surface to resolve.`,
    });
  }
  return diagnostics;
}

function normalizedDescriptionValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value.trim());
  if (Array.isArray(value)) return JSON.stringify(value.map(normalizeDescriptionJsonValue));
  if (value && typeof value === 'object')
    return JSON.stringify(normalizeDescriptionJsonValue(value));
  return JSON.stringify(value ?? null);
}

function normalizeDescriptionJsonValue(value: unknown): unknown {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(normalizeDescriptionJsonValue);
  if (!value || typeof value !== 'object') return value ?? null;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, normalizeDescriptionJsonValue(nested)]),
  );
}
