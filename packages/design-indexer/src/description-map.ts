/**
 * 0083 — compile the thin `description-map.json` catalog projection.
 *
 * The map is a cheap, prompt-sized index: per component, 2–3 keywords, a
 * status, and a pointer (`docsRef`) to the full description. It is a strict
 * projection — the thick fields (purpose, variantGuidance, requiredProps,
 * canonical snippets) live only in usage-cards. The map is always recompiled
 * from source/usage-cards and is never hand-edited.
 */
import type { ComponentDescriptionLayer } from '@sber-designer/shared-types';

import type {
  ComponentDescriptionMapEntry,
  ComponentUsageCard,
  IndexedComponentRecord,
} from './types';

export interface BuildDescriptionMapInput {
  components: IndexedComponentRecord[];
  usageCards: ComponentUsageCard[];
  catalogSource?: 'storybook' | 'static' | null;
  /** Storybook preview URL, used to build docs deep links when available. */
  previewUrl?: string | null;
}

const MAX_KEYWORDS = 3;

export function buildDescriptionMap(
  input: BuildDescriptionMapInput,
): ComponentDescriptionMapEntry[] {
  const cardById = new Map(input.usageCards.map((card) => [card.componentId, card]));

  return input.components
    .map((component) => {
      const layer = component.descriptionLayer;
      const card = cardById.get(component.id);
      const status = resolveStatus(layer, card);
      const keywords = resolveKeywords(layer, component);
      const docsRef = buildDocsRef(component, input);

      return {
        componentId: component.id,
        shortName: component.shortName,
        keywords,
        status,
        docsRef,
        ...(layer ? { coverageScore: coverageScore(layer) } : {}),
      } satisfies ComponentDescriptionMapEntry;
    })
    .sort((a, b) => a.componentId.localeCompare(b.componentId));
}

/** Count of components carrying an authored layer — manifest coverage signal. */
export function countDescribedComponents(entries: ComponentDescriptionMapEntry[]): number {
  return entries.filter((entry) => entry.status === 'authored').length;
}

function resolveStatus(
  layer: ComponentDescriptionLayer | undefined,
  card: ComponentUsageCard | undefined,
): ComponentDescriptionMapEntry['status'] {
  if (layer) return 'authored';
  if (card && hasMiningSignal(card)) return 'mined-draft';
  return 'missing';
}

function hasMiningSignal(card: ComponentUsageCard): boolean {
  return (
    card.usageCount > 0 ||
    card.variantGuidance.length > 0 ||
    card.propsThatMatter.length > 0 ||
    card.snippets.length > 0
  );
}

function resolveKeywords(
  layer: ComponentDescriptionLayer | undefined,
  component: IndexedComponentRecord,
): string[] {
  const authored = (layer?.keywords ?? []).map((keyword) => keyword.trim()).filter(Boolean);
  if (authored.length > 0) return authored.slice(0, MAX_KEYWORDS);
  return deriveKeywords(component).slice(0, MAX_KEYWORDS);
}

/** Fallback keywords from the component tags / name, when none are authored. */
function deriveKeywords(component: IndexedComponentRecord): string[] {
  const fromTags = component.tags.filter((tag) => tag.length > 2);
  if (fromTags.length > 0) return unique(fromTags);
  return unique(
    component.shortName
      .split(/(?=[A-Z])|[^A-Za-z0-9]+/)
      .map((word) => word.trim().toLowerCase())
      .filter(Boolean),
  );
}

function buildDocsRef(
  component: IndexedComponentRecord,
  input: BuildDescriptionMapInput,
): ComponentDescriptionMapEntry['docsRef'] {
  const storybookUrl =
    input.catalogSource === 'storybook' && input.previewUrl
      ? `${input.previewUrl.replace(/\/+$/, '')}/?path=/docs/${component.id}--docs`
      : undefined;
  return {
    sourcePath: component.filePath,
    ...(storybookUrl ? { storybookUrl } : {}),
    ...(component.docsAnchor ? { anchor: component.docsAnchor } : {}),
  };
}

/** Fraction of the high-value authored fields that are populated (0..1). */
function coverageScore(layer: ComponentDescriptionLayer): number {
  const checks = [
    Boolean(layer.purpose?.trim()),
    (layer.keywords?.length ?? 0) > 0,
    (layer.whenToUse?.length ?? 0) > 0,
    (layer.variantGuidance?.length ?? 0) > 0,
    (layer.requiredProps?.length ?? 0) > 0,
    (layer.canonicalSnippets?.length ?? 0) > 0,
  ];
  const present = checks.filter(Boolean).length;
  return Math.round((present / checks.length) * 100) / 100;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
