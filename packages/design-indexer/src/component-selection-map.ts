/**
 * 0114 B6.2 — compile the complete compact component map used before detailed
 * component hydration. This is generated evidence, never a hand-authored
 * source of truth.
 */
import type {
  ComponentDescriptionMapEntry,
  ComponentSelectionMap,
  ComponentSelectionMapEntry,
  ComponentUsageCard,
  DesignIndexDiagnostic,
  IndexedComponentRecord,
} from './types';

export interface BuildComponentSelectionMapInput {
  components: IndexedComponentRecord[];
  usageCards: ComponentUsageCard[];
  descriptionMap: ComponentDescriptionMapEntry[];
  diagnostics?: DesignIndexDiagnostic[];
  generatedAt: number;
  indexFingerprint: string;
}

const MAX_PURPOSE_CHARS = 220;
const MAX_GUIDANCE_CHARS = 140;
const MAX_ROLES = 5;
const MAX_CAPABILITIES = 6;
const MAX_KEYWORDS = 6;
const MAX_WHEN_TO_USE = 3;
const MAX_WHEN_NOT_TO_USE = 2;
const MAX_VARIANT_AXES = 4;
const MAX_VARIANT_VALUES = 6;

export function buildComponentSelectionMap(
  input: BuildComponentSelectionMapInput,
): ComponentSelectionMap {
  const cardsById = new Map(input.usageCards.map((card) => [card.componentId, card]));
  const descriptionsById = new Map(input.descriptionMap.map((entry) => [entry.componentId, entry]));
  const divergedIds = divergentComponentIds(input.diagnostics ?? []);
  const entries = input.components
    .map((component) =>
      toSelectionMapEntry(
        component,
        cardsById.get(component.id),
        descriptionsById.get(component.id),
        divergedIds.has(component.id),
      ),
    )
    .sort((left, right) => left.componentId.localeCompare(right.componentId));

  return {
    version: 1,
    generatedAt: input.generatedAt,
    indexFingerprint: input.indexFingerprint,
    counts: {
      indexed: entries.length,
      described: entries.filter((entry) => entry.descriptionStatus === 'authored').length,
      diverged: entries.filter((entry) => entry.descriptionStatus === 'diverged').length,
    },
    entries,
  };
}

function toSelectionMapEntry(
  component: IndexedComponentRecord,
  card: ComponentUsageCard | undefined,
  description: ComponentDescriptionMapEntry | undefined,
  diverged: boolean,
): ComponentSelectionMapEntry {
  const layer = component.descriptionLayer;
  const publicName = card?.publicImport.name?.trim() || component.shortName;
  const roles = compactValues(component.groupIds, MAX_ROLES);
  const capabilities = compactValues(
    [
      ...(layer?.keywords ?? []),
      ...component.tags,
      ...(card?.pairsWith ?? []).map((value) => `pairs:${value}`),
    ],
    MAX_CAPABILITIES,
  );
  const keywords = compactValues(
    [
      ...(description?.keywords ?? []),
      ...(layer?.keywords ?? []),
      ...component.tags,
      ...splitComponentName(component.shortName),
    ],
    MAX_KEYWORDS,
  );
  const purpose = compactText(
    card?.purpose ?? layer?.purpose ?? component.description,
    MAX_PURPOSE_CHARS,
  );
  const whenToUse = compactValues(
    card?.whenToUse ?? layer?.whenToUse ?? layer?.usage.map((usage) => usage.when) ?? [],
    MAX_WHEN_TO_USE,
    MAX_GUIDANCE_CHARS,
  );
  const whenNotToUse = compactValues(
    card?.whenNotToUse ?? layer?.whenNotToUse ?? [],
    MAX_WHEN_NOT_TO_USE,
    MAX_GUIDANCE_CHARS,
  );
  const variantAxes = (card?.variantGuidance ?? layer?.variantGuidance ?? [])
    .slice(0, MAX_VARIANT_AXES)
    .map((axis) => ({
      prop: compactText(axis.prop, 48) ?? axis.prop,
      values: compactValues(
        axis.values.map((value) => value.value),
        MAX_VARIANT_VALUES,
        48,
      ),
    }))
    .filter((axis) => axis.prop && axis.values.length > 0);

  return {
    componentId: component.id,
    publicName,
    title: component.title,
    sourcePath: component.filePath,
    source: component.source ?? 'react-index',
    ...(purpose ? { purpose } : {}),
    roles,
    capabilities,
    keywords,
    whenToUse,
    whenNotToUse,
    descriptionStatus: diverged ? 'diverged' : (description?.status ?? 'missing'),
    evidenceConfidence: component.confidence,
    variantAxes,
  };
}

function divergentComponentIds(diagnostics: DesignIndexDiagnostic[]): Set<string> {
  const ids = new Set<string>();
  for (const diagnostic of diagnostics) {
    const match = diagnostic.message.match(/description-diverged:\s+(\S+)/u);
    if (match?.[1]) ids.add(match[1]);
  }
  return ids;
}

function compactValues(values: string[], limit: number, maxChars = 64): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => compactText(value, maxChars))
        .filter((value): value is string => Boolean(value)),
    ),
  ).slice(0, limit);
}

function compactText(value: string | undefined, maxChars: number): string | undefined {
  const compact = value?.replace(/\s+/gu, ' ').trim();
  if (!compact) return undefined;
  if (compact.length <= maxChars) return compact;
  return `${compact.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

function splitComponentName(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .split(/[^\p{L}\p{N}]+/gu)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}
