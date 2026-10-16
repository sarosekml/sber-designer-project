import { normalizeScanPath } from './scan-shared';
import type { ComponentVariantRecord } from './variant-scanner';
import type {
  ComponentUsageCard,
  ComponentUsageStats,
  IndexedComponentRecord,
  ProjectAgentNote,
  UsageCardSnippet,
  UsageFact,
  UsageSnippetRecord,
} from './types';

const MAX_CARD_SNIPPETS = 3;
const MAX_PROPS_THAT_MATTER = 5;
const PROP_SHARE_THRESHOLD = 0.3;
/** Sources whose facts are human-owned: never regenerated, always preserved. */
const HUMAN_FACT_SOURCES = new Set(['interview', 'reference-screen', 'run-feedback']);

export interface BuildUsageCardsInput {
  components: IndexedComponentRecord[];
  snippets: UsageSnippetRecord[];
  stats: ComponentUsageStats[];
  variants: ComponentVariantRecord[];
  agentNotes: ProjectAgentNote[];
  /** Raw usage-cards.jsonl from the previous index build. */
  existingCardsContents?: string | null;
  generatedAt: number;
}

/**
 * Compile per-component usage cards from all knowledge sources (0080 1.3).
 * Deterministic; fact ids are stable so human `status` edits survive re-index,
 * and human-source facts (interview/reference-screen/run-feedback) are always
 * carried over verbatim.
 */
export function buildUsageCards(input: BuildUsageCardsInput): ComponentUsageCard[] {
  const existing = parseExistingCards(input.existingCardsContents ?? null);
  const snippetsByComponent = groupBy(input.snippets, (snippet) => snippet.componentId);
  const statsByComponent = new Map(input.stats.map((stat) => [stat.componentId, stat]));
  const variantsByComponent = new Map(input.variants.map((record) => [record.componentId, record]));
  const notesByComponent = new Map<string, ProjectAgentNote[]>();
  for (const note of input.agentNotes) {
    if (note.targetType !== 'component' || !note.targetId) continue;
    const list = notesByComponent.get(note.targetId) ?? [];
    list.push(note);
    notesByComponent.set(note.targetId, list);
  }

  const cards: ComponentUsageCard[] = [];
  for (const component of input.components) {
    const previous = existing.get(component.id);
    const variantRecord = variantsByComponent.get(component.id);
    const card = compileCard(component, {
      snippets: snippetsByComponent.get(component.id) ?? [],
      stats: statsByComponent.get(component.id),
      variants: variantRecord?.props ?? [],
      requiredProps: variantRecord?.requiredProps ?? [],
      notes: notesByComponent.get(component.id) ?? [],
      previous,
      generatedAt: input.generatedAt,
    });
    if (card) cards.push(card);
  }
  return cards.sort((a, b) => a.componentId.localeCompare(b.componentId));
}

interface CompileContext {
  snippets: UsageSnippetRecord[];
  stats: ComponentUsageStats | undefined;
  variants: ComponentUsageCard['variantGuidance'];
  requiredProps: string[];
  notes: ProjectAgentNote[];
  previous: ComponentUsageCard | undefined;
  generatedAt: number;
}

function compileCard(
  component: IndexedComponentRecord,
  context: CompileContext,
): ComponentUsageCard | null {
  const layer = component.descriptionLayer;
  const facts = compileFacts(component, context);
  // 0083 R3: authored layer fields (the human-confirmed interview output) must
  // reach the compiled card, not just the mined data — otherwise generation never
  // sees the confirmed variant meanings / required props / canonical usage.
  const catalogSnippets = compileCssCatalogSnippets(component);
  const snippets = mergeAuthoredSnippets(
    layer?.canonicalSnippets,
    [...catalogSnippets, ...compileSnippets(context.snippets)],
    component.filePath,
  );
  const variantGuidance = applyAuthoredVariants(
    mergeVariantMeanings(
      [...compileCssCatalogVariants(component), ...context.variants],
      context.previous,
    ),
    layer?.variantGuidance,
  );
  // Authored 0083 `whenToUse`/`whenNotToUse` merge with the legacy usage[].when
  // and avoid/deprecated notes so the compiled card reflects the human source.
  const whenToUse = dedupe([
    ...(component.descriptionLayer?.usage ?? []).map((usage) => usage.when.trim()),
    ...(component.descriptionLayer?.whenToUse ?? []).map((item) => item.trim()),
  ]);
  const whenNotToUse = dedupe([
    ...context.notes
      .filter((note) => note.intent === 'avoid' || note.intent === 'deprecated')
      .map((note) => note.note.trim()),
    ...(component.descriptionLayer?.whenNotToUse ?? []).map((item) => item.trim()),
  ]);
  const usageCount = context.stats?.totalCount ?? 0;
  const purpose = component.descriptionLayer?.purpose?.trim();
  const visualRefs = context.previous?.visualRefs ?? [];
  const propsThatMatter = compilePropsThatMatter(
    context.snippets,
    // R3: authored required props lead, then mined required props.
    dedupe([
      ...(layer?.requiredProps ?? []),
      ...context.requiredProps,
      ...cssRequiredClasses(component),
    ]),
    usageCount,
    component.source === 'css-catalog' ? 'required class' : 'required prop',
  );
  const hasCssCatalogSignal =
    component.source === 'css-catalog' &&
    (Boolean(component.canonicalHtml?.trim()) ||
      (component.requiredClasses?.length ?? 0) > 0 ||
      (component.modifiers?.length ?? 0) > 0);

  const hasSignal =
    Boolean(purpose) ||
    whenToUse.length > 0 ||
    whenNotToUse.length > 0 ||
    facts.length > 0 ||
    snippets.length > 0 ||
    variantGuidance.length > 0 ||
    propsThatMatter.length > 0 ||
    usageCount > 0 ||
    hasCssCatalogSignal;
  if (!hasSignal) return null;

  // A card is "incomplete" when the component is clearly used but carries no
  // instantiation guidance — variant meanings, props, or an explicit-prop
  // snippet. These rise to the top of the Phase 2 interview queue (0080).
  const hasCanonicalSnippet = snippets.some((snippet) => !snippet.code.includes('{...'));
  const incomplete =
    usageCount > 0 &&
    variantGuidance.length === 0 &&
    propsThatMatter.length === 0 &&
    !hasCanonicalSnippet;

  return {
    componentId: component.id,
    publicImport: {
      name: component.shortName,
      module: publicModuleFor(component.filePath),
    },
    ...(component.source === 'css-catalog' && component.requiredClasses?.length
      ? { requiredClasses: component.requiredClasses }
      : {}),
    ...(component.source === 'css-catalog' && component.modifiers?.length
      ? { modifiers: component.modifiers }
      : {}),
    ...(purpose ? { purpose } : {}),
    whenToUse,
    whenNotToUse,
    variantGuidance,
    propsThatMatter,
    snippets,
    pairsWith: (context.stats?.pairsWith ?? []).map((pair) => pair.componentId),
    usageCount,
    visualRefs,
    ...(incomplete ? { incomplete: true } : {}),
    facts,
  };
}

function compileFacts(component: IndexedComponentRecord, context: CompileContext): UsageFact[] {
  const previousFacts = new Map(
    (context.previous?.facts ?? []).map((fact) => [fact.id, fact] as const),
  );
  const generated: UsageFact[] = [];

  for (const guidance of component.descriptionLayer?.agentGuidance ?? []) {
    const text = guidance.trim();
    if (!text) continue;
    generated.push(
      makeFact(`fact-${component.id}-dl-${shortHash(text)}`, text, 'description-layer', {
        status: 'confirmed',
        generatedAt: context.generatedAt,
        previousFacts,
      }),
    );
  }

  for (const note of context.notes) {
    generated.push(
      makeFact(`fact-${component.id}-note-${note.id}`, note.note.trim(), 'agent-note', {
        status: note.source === 'agent' ? 'draft' : 'confirmed',
        evidence: note.id,
        generatedAt: context.generatedAt,
        previousFacts,
      }),
    );
  }

  const topCluster = context.snippets[0];
  if (topCluster && context.stats && topCluster.count > 1) {
    const propsText =
      Object.entries(topCluster.propsPreview)
        .map(([prop, value]) => `${prop}="${value}"`)
        .join(' ') || topCluster.propNames.join(', ');
    const text = `Most common mined usage: <${component.shortName}${propsText ? ` ${propsText}` : ''}> — ${topCluster.count} of ${context.stats.totalCount} usages.`;
    generated.push(
      makeFact(`fact-${component.id}-mined-top-cluster`, text, 'mined-usage', {
        status: 'draft',
        evidence: topCluster.sourcePath,
        generatedAt: context.generatedAt,
        previousFacts,
      }),
    );
  }

  if (context.stats && context.stats.pairsWith.length > 0) {
    const text = `Commonly used in the same files as: ${context.stats.pairsWith
      .map((pair) => pair.componentId)
      .join(', ')}.`;
    generated.push(
      makeFact(`fact-${component.id}-mined-pairs`, text, 'mined-usage', {
        status: 'draft',
        generatedAt: context.generatedAt,
        previousFacts,
      }),
    );
  }

  // Human-owned facts are never regenerated — carry them over verbatim.
  const generatedIds = new Set(generated.map((fact) => fact.id));
  for (const fact of context.previous?.facts ?? []) {
    if (HUMAN_FACT_SOURCES.has(fact.source) && !generatedIds.has(fact.id)) {
      generated.push(fact);
    }
  }

  return generated.sort((a, b) => a.id.localeCompare(b.id));
}

function makeFact(
  id: string,
  text: string,
  source: UsageFact['source'],
  options: {
    status: UsageFact['status'];
    evidence?: string;
    generatedAt: number;
    previousFacts: Map<string, UsageFact>;
  },
): UsageFact {
  const previous = options.previousFacts.get(id);
  return {
    id,
    text,
    source,
    // Human review survives re-index: a previous status always wins.
    status: previous?.status ?? options.status,
    ...(options.evidence ? { evidence: options.evidence } : {}),
    createdAt: previous?.createdAt ?? options.generatedAt,
    updatedAt: previous && previous.text === text ? previous.updatedAt : options.generatedAt,
  };
}

function compileSnippets(snippets: UsageSnippetRecord[]): UsageCardSnippet[] {
  // Prefer the most "canonical" instantiation: explicit literal props over
  // `{...args}`/`{...props}` spreads (which hide how the component is used),
  // then more named props, then more frequent (0082 Track 2).
  return [...snippets]
    .sort(
      (a, b) =>
        spreadRank(a.code) - spreadRank(b.code) ||
        b.propNames.length - a.propNames.length ||
        b.count - a.count,
    )
    .slice(0, MAX_CARD_SNIPPETS)
    .map((snippet) => ({
      code: snippet.code,
      sourcePath: snippet.sourcePath,
      label: `${snippet.origin} usage · ${snippet.count}x (${Math.round(snippet.share * 100)}% of mined usages)`,
      source: 'mined-usage' as const,
    }));
}

function compileCssCatalogSnippets(component: IndexedComponentRecord): UsageCardSnippet[] {
  if (component.source !== 'css-catalog' || !component.canonicalHtml?.trim()) return [];
  return [
    {
      code: component.canonicalHtml,
      sourcePath: component.filePath,
      label: 'CSS catalog canonical markup',
      source: 'css-catalog',
    },
  ];
}

function compileCssCatalogVariants(
  component: IndexedComponentRecord,
): ComponentUsageCard['variantGuidance'] {
  if (component.source !== 'css-catalog' || !component.modifiers?.length) return [];
  return [
    {
      prop: 'modifier',
      values: component.modifiers.map((modifier) => ({ value: modifier, meaning: '' })),
      source: 'css-catalog',
    },
  ];
}

function cssRequiredClasses(component: IndexedComponentRecord): string[] {
  if (component.source !== 'css-catalog') return [];
  return component.requiredClasses ?? [];
}

function spreadRank(code: string): number {
  return /\{\s*\.\.\./u.test(code) ? 1 : 0;
}

function compilePropsThatMatter(
  snippets: UsageSnippetRecord[],
  requiredProps: string[],
  totalCount: number,
  requiredNote = 'required prop',
): { name: string; note: string }[] {
  const result: { name: string; note: string }[] = [];
  const seen = new Set<string>();
  // Required props lead — a non-source-reading LLM must set these to instantiate.
  for (const name of requiredProps) {
    if (seen.has(name)) continue;
    seen.add(name);
    result.push({ name, note: requiredNote });
  }
  if (totalCount === 0) return result.slice(0, MAX_PROPS_THAT_MATTER);
  const counts = new Map<string, number>();
  for (const snippet of snippets) {
    for (const prop of snippet.propNames) {
      counts.set(prop, (counts.get(prop) ?? 0) + snippet.count);
    }
  }
  const mined = Array.from(counts.entries())
    .map(([name, count]) => ({ name, share: count / totalCount }))
    .filter((entry) => entry.share >= PROP_SHARE_THRESHOLD && !seen.has(entry.name))
    .sort((a, b) => b.share - a.share || a.name.localeCompare(b.name))
    .map((entry) => ({
      name: entry.name,
      note: `set in ~${Math.round(entry.share * 100)}% of mined usages`,
    }));
  return [...result, ...mined].slice(0, MAX_PROPS_THAT_MATTER);
}

function mergeVariantMeanings(
  variants: ComponentUsageCard['variantGuidance'],
  previous: ComponentUsageCard | undefined,
): ComponentUsageCard['variantGuidance'] {
  if (!previous) return variants;
  const previousMeanings = new Map<string, string>();
  for (const guidance of previous.variantGuidance) {
    for (const value of guidance.values) {
      if (value.meaning.trim())
        previousMeanings.set(`${guidance.prop}:${value.value}`, value.meaning);
    }
  }
  if (previousMeanings.size === 0) return variants;
  return variants.map((guidance) => ({
    ...guidance,
    values: guidance.values.map((value) => ({
      value: value.value,
      meaning: previousMeanings.get(`${guidance.prop}:${value.value}`) ?? value.meaning,
    })),
  }));
}

/**
 * 0083 R3: overlay the authored layer's variant guidance onto the mined/previous
 * meanings. Authored meanings win; props/values present only in the authored layer
 * are added (the human can describe a variant mining never found).
 */
function applyAuthoredVariants(
  merged: ComponentUsageCard['variantGuidance'],
  authored: NonNullable<IndexedComponentRecord['descriptionLayer']>['variantGuidance'],
): ComponentUsageCard['variantGuidance'] {
  if (!authored || authored.length === 0) return merged;
  const result = merged.map((guidance) => ({
    ...guidance,
    values: guidance.values.map((value) => ({ ...value })),
  }));
  const indexByProp = new Map(result.map((guidance, index) => [guidance.prop, index]));
  for (const authoredGuidance of authored) {
    const index = indexByProp.get(authoredGuidance.prop);
    if (index === undefined) {
      result.push({
        prop: authoredGuidance.prop,
        values: authoredGuidance.values.map((value) => ({
          value: value.value,
          meaning: value.meaning,
        })),
        source: 'description-layer',
      });
      indexByProp.set(authoredGuidance.prop, result.length - 1);
      continue;
    }
    const target = result[index]!;
    for (const authoredValue of authoredGuidance.values) {
      const existing = target.values.find((value) => value.value === authoredValue.value);
      if (existing) existing.meaning = authoredValue.meaning.trim() || existing.meaning;
      else target.values.push({ value: authoredValue.value, meaning: authoredValue.meaning });
    }
  }
  return result;
}

/**
 * 0083 R3: prepend the authored canonical usage snippets (highest priority) ahead
 * of the mined snippets, deduped by code, capped at `MAX_CARD_SNIPPETS`.
 */
function mergeAuthoredSnippets(
  authored: { code: string; label?: string }[] | undefined,
  mined: UsageCardSnippet[],
  sourcePath: string,
): UsageCardSnippet[] {
  if (!authored || authored.length === 0) return mined;
  const authoredSnippets: UsageCardSnippet[] = authored
    .filter((snippet) => snippet.code?.trim())
    .map((snippet) => ({
      code: snippet.code,
      sourcePath,
      label: snippet.label?.trim() || 'authored canonical usage',
      source: 'description-layer',
    }));
  const seen = new Set<string>();
  const out: UsageCardSnippet[] = [];
  for (const snippet of [...authoredSnippets, ...mined]) {
    if (seen.has(snippet.code)) continue;
    seen.add(snippet.code);
    out.push(snippet);
  }
  return out.slice(0, MAX_CARD_SNIPPETS);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/** Directory barrels keep their index path; plain files lose the extension. */
function publicModuleFor(filePath: string): string {
  const normalized = normalizeScanPath(filePath);
  if (/(^|\/)index\.[cm]?[tj]sx?$/i.test(normalized)) return normalized;
  return normalized.replace(/\.[cm]?[jt]sx?$/i, '');
}

export function parseExistingCards(contents: string | null): Map<string, ComponentUsageCard> {
  const map = new Map<string, ComponentUsageCard>();
  if (!contents) return map;
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Partial<ComponentUsageCard>;
      if (!parsed.componentId) continue;
      map.set(parsed.componentId, {
        componentId: parsed.componentId,
        publicImport: parsed.publicImport ?? { name: parsed.componentId, module: '' },
        ...(parsed.requiredClasses ? { requiredClasses: parsed.requiredClasses } : {}),
        ...(parsed.modifiers ? { modifiers: parsed.modifiers } : {}),
        ...(parsed.purpose ? { purpose: parsed.purpose } : {}),
        whenToUse: parsed.whenToUse ?? [],
        whenNotToUse: parsed.whenNotToUse ?? [],
        variantGuidance: parsed.variantGuidance ?? [],
        propsThatMatter: parsed.propsThatMatter ?? [],
        snippets: parsed.snippets ?? [],
        pairsWith: parsed.pairsWith ?? [],
        usageCount: parsed.usageCount ?? 0,
        visualRefs: parsed.visualRefs ?? [],
        facts: (parsed.facts ?? []).filter((fact): fact is UsageFact =>
          Boolean(fact && fact.id && fact.text && fact.source && fact.status),
        ),
      });
    } catch {
      /* skip malformed lines */
    }
  }
  return map;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k) ?? [];
    list.push(item);
    map.set(k, list);
  }
  return map;
}

function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
