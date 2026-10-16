import type { ComponentUseCandidate } from './component-pack';

export const DEFAULT_COMPONENT_HYDRATION_BATCH_BUDGET_BYTES = 12_000;
const MAX_SNIPPET_BYTES = 3_500;

export interface ComponentHydrationBatchManifest {
  id: string;
  regionIds: string[];
  roles: string[];
  componentIds: string[];
  byteSize: number;
  oversized: boolean;
}

export interface ComponentHydrationManifest {
  version: 1;
  strategy: 'region-byte-batches';
  batchBudgetBytes: number;
  totalBytes: number;
  hydratedComponentIds: string[];
  batches: ComponentHydrationBatchManifest[];
}

export interface RenderedComponentHydrationBatch {
  manifest: ComponentHydrationBatchManifest;
  content: string;
}

export interface ComponentHydrationBuildResult {
  manifest: ComponentHydrationManifest;
  renderedBatches: RenderedComponentHydrationBatch[];
}

interface CandidateHydrationBlock {
  candidate: ComponentUseCandidate;
  content: string;
}

export function buildComponentHydrationBatches(
  candidates: ComponentUseCandidate[],
  batchBudgetBytes = DEFAULT_COMPONENT_HYDRATION_BATCH_BUDGET_BYTES,
): ComponentHydrationBuildResult {
  const budget = normalizeByteBudget(batchBudgetBytes);
  const groups = groupCandidatesByRegions(candidates);
  const renderedBatches: RenderedComponentHydrationBatch[] = [];
  for (const group of groups) {
    const blocks = group.candidates.map((candidate) => ({
      candidate,
      content: renderHydratedCandidate(candidate),
    }));
    let current: CandidateHydrationBlock[] = [];
    let part = 1;
    for (const block of blocks) {
      const tentative = [...current, block];
      const tentativeId = hydrationBatchId(group.regionIds, part);
      const tentativeContent = renderBatchContent(tentativeId, group.regionIds, tentative);
      if (current.length > 0 && utf8ByteLength(tentativeContent) > budget) {
        renderedBatches.push(finalizeBatch(group.regionIds, part, current, budget));
        part += 1;
        current = [block];
        continue;
      }
      current = tentative;
    }
    if (current.length > 0) {
      renderedBatches.push(finalizeBatch(group.regionIds, part, current, budget));
    }
  }
  const hydratedComponentIds = Array.from(
    new Set(renderedBatches.flatMap((batch) => batch.manifest.componentIds)),
  );
  const totalBytes = renderedBatches.reduce((sum, batch) => sum + batch.manifest.byteSize, 0);
  return {
    manifest: {
      version: 1,
      strategy: 'region-byte-batches',
      batchBudgetBytes: budget,
      totalBytes,
      hydratedComponentIds,
      batches: renderedBatches.map((batch) => batch.manifest),
    },
    renderedBatches,
  };
}

export function renderComponentHydrationBatches(
  candidates: ComponentUseCandidate[],
  manifest: ComponentHydrationManifest | null | undefined,
): string {
  const built = buildComponentHydrationBatches(
    candidates,
    manifest?.batchBudgetBytes ?? DEFAULT_COMPONENT_HYDRATION_BATCH_BUDGET_BYTES,
  );
  if (built.renderedBatches.length === 0) return '';
  const lines = [
    '### Hydrated contract batches',
    '',
    `- strategy: ${built.manifest.strategy}`,
    `- hydrationBatchBudgetBytes: ${built.manifest.batchBudgetBytes}`,
    `- hydratedComponentCount: ${built.manifest.hydratedComponentIds.length}`,
    `- hydrationBatchCount: ${built.manifest.batches.length}`,
    `- hydrationBytes: ${built.manifest.totalBytes}`,
  ];
  for (const batch of built.renderedBatches) {
    lines.push(
      '',
      `- batch ${batch.manifest.id}: ${batch.manifest.byteSize} bytes${batch.manifest.oversized ? ' (single contract exceeds batch budget)' : ''}`,
      batch.content,
    );
  }
  return lines.join('\n');
}

function finalizeBatch(
  regionIds: string[],
  part: number,
  blocks: CandidateHydrationBlock[],
  budget: number,
): RenderedComponentHydrationBatch {
  const id = hydrationBatchId(regionIds, part);
  const content = renderBatchContent(id, regionIds, blocks);
  const byteSize = utf8ByteLength(content);
  return {
    manifest: {
      id,
      regionIds,
      roles: Array.from(new Set(blocks.map((block) => block.candidate.role))),
      componentIds: Array.from(new Set(blocks.map((block) => block.candidate.componentId))),
      byteSize,
      oversized: byteSize > budget,
    },
    content,
  };
}

function renderBatchContent(
  id: string,
  regionIds: string[],
  blocks: CandidateHydrationBlock[],
): string {
  return [
    `#### ${id}`,
    '',
    `Regions: ${regionIds.join(', ') || 'unassigned'}.`,
    `Components: ${blocks.map((block) => block.candidate.componentId).join(', ')}.`,
    '',
    ...blocks.map((block) => block.content),
  ].join('\n');
}

function renderHydratedCandidate(candidate: ComponentUseCandidate): string {
  const lines = [
    `- ${candidate.role}: \`${candidate.shortName}\` (${candidate.componentId})`,
    `  - title: ${candidate.title}`,
    `  - confidence: ${candidate.confidence}; recordConfidence: ${candidate.recordConfidence}; score: ${candidate.score}`,
    `  - reason: ${candidate.reason}`,
  ];
  if (candidate.regionIds?.length) lines.push(`  - regions: ${candidate.regionIds.join(', ')}`);
  if (candidate.publicImport) {
    lines.push(
      `  - resolved public import: \`${candidate.publicImport.name}\` from \`${candidate.publicImport.module}\` (${candidate.publicImport.verified ? 'verified' : 'unverified'} via ${candidate.publicImport.evidence})`,
    );
  } else if (candidate.importHint) lines.push(`  - source: ${candidate.importHint}`);
  if (candidate.resolution) {
    lines.push(`  - instantiation resolution: ${candidate.resolution.status}`);
    for (const variant of candidate.resolution.chosenVariants) {
      lines.push(
        `  - chosen variant: ${variant.prop}=\`${variant.value}\` (${variant.selectedBy}; allowed by ${variant.allowedBy})${variant.meaning ? ` — ${variant.meaning}` : ''}`,
      );
    }
    if (candidate.resolution.criticalProps.length > 0) {
      lines.push(
        `  - critical props: ${candidate.resolution.criticalProps.map(renderCriticalProp).join(', ')}`,
      );
    }
    if (candidate.resolution.unresolvedVariantProps.length > 0) {
      lines.push(
        `  - unresolved variants: ${candidate.resolution.unresolvedVariantProps.join(', ')}; inspect current source/Storybook evidence before instantiation.`,
      );
    }
    if (candidate.resolution.excludedAuthoredFacts.length > 0) {
      lines.push(
        `  - diverged authored facts excluded: ${candidate.resolution.excludedAuthoredFacts.join(', ')}`,
      );
    }
  }
  if (candidate.userRequired) {
    lines.push('  - requirement: mandatory; do not replace with a related component or primitive.');
  }
  if (candidate.recommendedStoryId) lines.push(`  - story: ${candidate.recommendedStoryId}`);
  for (const guidance of candidate.guidance.slice(0, 4)) {
    lines.push(`  - guidance: ${guidance}`);
  }
  for (const hint of candidate.variantHints ?? []) {
    lines.push(`  - variants: ${hint}`);
  }
  for (const contract of renderStructuralContracts(candidate)) {
    lines.push(`  - ${contract}`);
  }
  if (candidate.requiredClasses?.length) {
    lines.push(`  - required classes: ${candidate.requiredClasses.join(', ')}`);
  }
  if (candidate.modifiers?.length) {
    lines.push(`  - modifiers: ${candidate.modifiers.join(', ')}`);
  }
  if (candidate.requiredProps?.length) {
    const required = candidate.requiredProps.join(', ');
    lines.push(
      `  - required props: ${required}`,
      `  - prop contract: ${joinHumanList(candidate.requiredProps)} ${candidate.requiredProps.length === 1 ? 'is' : 'are'} mandatory; do not instantiate without ${candidate.requiredProps.length === 1 ? 'this prop' : 'these props'}.`,
    );
  }
  for (const avoid of candidate.whenNotToUse ?? []) {
    lines.push(`  - avoid: ${avoid}`);
  }
  if (candidate.snippet) {
    lines.push(
      `  - canonical usage contract from this project (${candidate.snippet.sourcePath}):`,
      '',
      '    ```tsx',
      indentSnippet(truncateUtf8(candidate.snippet.code, MAX_SNIPPET_BYTES)),
      '    ```',
      '',
    );
  }
  if (candidate.canonicalHtml) {
    lines.push(
      '  - canonical HTML contract from css catalog:',
      '',
      '    ```html',
      indentSnippet(truncateUtf8(candidate.canonicalHtml, MAX_SNIPPET_BYTES)),
      '    ```',
      '',
    );
  }
  return lines.join('\n');
}

function renderCriticalProp(
  prop: NonNullable<ComponentUseCandidate['resolution']>['criticalProps'][number],
): string {
  return `${prop.name}${prop.value === undefined ? '' : `=\`${prop.value}\``}${prop.required ? ' (required)' : ''} [${prop.evidence}]`;
}

function renderStructuralContracts(candidate: ComponentUseCandidate): string[] {
  const haystack = [
    candidate.role,
    candidate.shortName,
    candidate.title,
    candidate.snippet?.code,
    ...candidate.guidance,
  ]
    .filter(Boolean)
    .join('\n');
  const isTableCandidate =
    candidate.role === 'data-table' || /\b(?:data)?table\b|rowsconfig/iu.test(haystack);
  if (!isTableCandidate) return [];
  if (!/\bRowsConfig\b/u.test(haystack) || !/\bcells\b/u.test(haystack)) return [];
  return [
    'table row contract: every key in each row data object must have a matching cells renderer/key; keep row data, cells, and columns in sync, especially for grouped rows.',
  ];
}

function groupCandidatesByRegions(candidates: ComponentUseCandidate[]): Array<{
  regionIds: string[];
  candidates: ComponentUseCandidate[];
}> {
  const groups = new Map<string, { regionIds: string[]; candidates: ComponentUseCandidate[] }>();
  for (const candidate of candidates) {
    const regionIds = candidate.regionIds?.length
      ? Array.from(new Set(candidate.regionIds))
      : [candidate.userRequired ? 'explicit-requirements' : 'unassigned'];
    const key = regionIds.join('|');
    const existing = groups.get(key) ?? { regionIds, candidates: [] };
    existing.candidates.push(candidate);
    groups.set(key, existing);
  }
  return Array.from(groups.values());
}

function hydrationBatchId(regionIds: string[], part: number): string {
  const regionLabel = regionIds.map(slug).filter(Boolean).join('-') || 'unassigned';
  return `hydration-${regionLabel}${part > 1 ? `-part-${part}` : ''}`;
}

function indentSnippet(value: string): string {
  return value
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
}

function truncateUtf8(value: string, maxBytes: number): string {
  const encoded = new TextEncoder().encode(value);
  if (encoded.byteLength <= maxBytes) return value;
  const truncated = new TextDecoder().decode(encoded.slice(0, maxBytes));
  return `${truncated}\n/* Contract excerpt truncated at ${maxBytes} UTF-8 bytes. */`;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function normalizeByteBudget(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_COMPONENT_HYDRATION_BATCH_BUDGET_BYTES;
  return Math.max(1_000, Math.floor(value));
}

function joinHumanList(values: string[]): string {
  if (values.length <= 2) return values.join(' and ');
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}
