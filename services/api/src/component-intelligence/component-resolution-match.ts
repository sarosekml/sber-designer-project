import type {
  ComponentUsageCard,
  IndexedComponentRecord,
  UsageCardSnippet,
  UsageCardVariantGuidance,
} from '@sber-designer/design-indexer';

import type { ComponentUseCandidate } from './component-pack';
import type {
  ResolvedComponentCriticalProp,
  ResolvedComponentPublicImport,
  ResolvedComponentVariant,
  ResolveSelectedComponentContractsInput,
} from './component-resolution';
import type { ImportConvention } from './import-conventions';
import { verifyPublicExportName, type ModuleExports } from './public-exports';

export interface AuthoritativeVariantAxis extends UsageCardVariantGuidance {
  allowedBy: ResolvedComponentVariant['allowedBy'];
}

export function authoritativeVariantAxes(
  component: IndexedComponentRecord,
  card: ComponentUsageCard | undefined,
  fresh: UsageCardVariantGuidance[] | undefined,
  divergedFields: string[],
): AuthoritativeVariantAxis[] {
  const sourceAxes = fresh?.length
    ? fresh
    : component.source === 'css-catalog'
      ? (card?.variantGuidance ?? []).filter((axis) => axis.source === 'css-catalog')
      : divergedFields.includes('variantGuidance')
        ? []
        : (card?.variantGuidance ?? []).filter((axis) => axis.source !== 'description-layer');
  const meaningsByValue = divergedFields.includes('variantGuidance')
    ? new Map<string, string>()
    : variantMeanings(card?.variantGuidance ?? []);
  return sourceAxes.map((axis) => ({
    ...axis,
    values: axis.values.map((value) => ({
      value: value.value,
      meaning: meaningsByValue.get(`${axis.prop}:${value.value}`) ?? value.meaning,
    })),
    allowedBy:
      axis.source === 'ts-union'
        ? 'source-type'
        : axis.source === 'argtypes'
          ? 'storybook-argtypes'
          : 'css-catalog',
  }));
}

export function authoritativeSnippets(
  card: ComponentUsageCard | undefined,
  divergedFields: string[],
  allowScreenUsageEvidence: boolean,
): UsageCardSnippet[] {
  return (card?.snippets ?? []).filter((snippet) => {
    if (divergedFields.includes('canonicalSnippets') && snippet.source === 'description-layer') {
      return false;
    }
    if (!allowScreenUsageEvidence && snippet.source === 'mined-usage') return false;
    return true;
  });
}

export async function resolvePublicImport(input: {
  workspaceRoot: string;
  component: IndexedComponentRecord;
  card: ComponentUsageCard | undefined;
  importConventions: ImportConvention[];
  exportCache: Map<string, ModuleExports>;
}): Promise<ResolvedComponentPublicImport> {
  if (input.component.source === 'css-catalog') {
    return {
      name: input.component.shortName,
      module: input.component.filePath,
      verified: true,
      evidence: 'source-index',
    };
  }
  const check = await verifyPublicExportName(
    input.workspaceRoot,
    input.component.filePath,
    input.component.shortName,
    input.exportCache,
  ).catch(() => null);
  const name = check?.actualName ?? input.card?.publicImport.name ?? input.component.shortName;
  const convention = input.importConventions.find(
    (item) => item.symbol === name && !item.collision && item.modules.length === 1,
  );
  if (convention?.modules[0]) {
    return {
      name,
      module: convention.modules[0].module,
      verified: true,
      evidence: 'confirmed-usage',
    };
  }
  if (check?.verifiable && (check.exported || check.actualName)) {
    return {
      name,
      module: check.barrel ?? input.card?.publicImport.module ?? input.component.filePath,
      verified: true,
      evidence: 'public-barrel',
    };
  }
  return {
    name,
    module: input.card?.publicImport.module ?? input.component.filePath,
    verified: false,
    evidence: input.card ? 'usage-card' : 'source-index',
  };
}

export function chooseVariants(
  axes: AuthoritativeVariantAxis[],
  context: string,
  snippetProps: Map<string, string>,
  snippetPath: string | undefined,
): ResolvedComponentVariant[] {
  const choices: ResolvedComponentVariant[] = [];
  for (const axis of axes) {
    const ranked = axis.values
      .map((value) => ({ value, score: variantIntentScore(axis.prop, value, context) }))
      .sort(
        (left, right) =>
          right.score - left.score || left.value.value.localeCompare(right.value.value),
      );
    const best = ranked[0];
    const second = ranked[1];
    if (best && best.score > 0 && best.score > (second?.score ?? 0)) {
      choices.push({
        prop: axis.prop,
        value: best.value.value,
        ...(best.value.meaning ? { meaning: best.value.meaning } : {}),
        allowedBy: axis.allowedBy,
        selectedBy: 'task-intent',
        evidence: `Matched run intent for ${axis.prop}.`,
      });
      continue;
    }
    const usedValue = snippetProps.get(axis.prop);
    const used = axis.values.find((value) => value.value === usedValue);
    if (!used) continue;
    choices.push({
      prop: axis.prop,
      value: used.value,
      ...(used.meaning ? { meaning: used.meaning } : {}),
      allowedBy: axis.allowedBy,
      selectedBy: 'confirmed-usage',
      ...(snippetPath ? { evidence: snippetPath } : {}),
    });
  }
  return choices;
}

export function resolveCriticalProps(input: {
  candidate: ComponentUseCandidate;
  card: ComponentUsageCard | undefined;
  chosenVariants: ResolvedComponentVariant[];
  snippetProps: Map<string, string>;
  snippetPath?: string;
  sourceRequiredProps: string[] | null;
  divergedFields: string[];
}): ResolvedComponentCriticalProp[] {
  if (input.candidate.requiredClasses?.length) {
    return [
      {
        name: 'class',
        required: true,
        value: input.candidate.requiredClasses.join(' '),
        evidence: 'css-catalog',
        ...(input.candidate.importHint ? { evidenceRef: input.candidate.importHint } : {}),
      },
    ];
  }
  const props = new Map<string, ResolvedComponentCriticalProp>();
  for (const name of input.sourceRequiredProps ?? []) {
    const value = input.snippetProps.get(name);
    props.set(name, {
      name,
      required: true,
      ...(value !== undefined ? { value } : {}),
      evidence: 'source-type',
      ...(input.snippetPath ? { evidenceRef: input.snippetPath } : {}),
    });
  }
  if (input.sourceRequiredProps === null && !input.divergedFields.includes('requiredProps')) {
    for (const name of input.candidate.requiredProps ?? []) {
      const value = input.snippetProps.get(name);
      props.set(name, {
        name,
        required: true,
        ...(value !== undefined ? { value } : {}),
        evidence: 'usage-card',
      });
    }
  }
  for (const choice of input.chosenVariants) {
    const existing = props.get(choice.prop);
    props.set(choice.prop, {
      name: choice.prop,
      required: existing?.required ?? false,
      value: choice.value,
      evidence: existing?.evidence ?? 'confirmed-usage',
      ...(choice.evidence ? { evidenceRef: choice.evidence } : {}),
    });
  }
  for (const prop of input.card?.propsThatMatter ?? []) {
    const value = input.snippetProps.get(prop.name);
    if (value === undefined || props.has(prop.name)) continue;
    props.set(prop.name, {
      name: prop.name,
      required: false,
      value,
      evidence: 'confirmed-usage',
      ...(input.snippetPath ? { evidenceRef: input.snippetPath } : {}),
    });
  }
  return Array.from(props.values()).slice(0, 10);
}

export function resolutionContext(
  candidate: ComponentUseCandidate,
  input: ResolveSelectedComponentContractsInput,
): string {
  const regionIds = new Set(candidate.regionIds ?? []);
  const plan = input.screenStructurePlan;
  const regions = plan?.regions.filter((region) => regionIds.has(region.id)) ?? [];
  const details = [
    input.userRequest,
    candidate.role,
    input.designBrief?.axes.density,
    input.designBrief?.axes.layout,
    ...(input.designBrief?.axes.constraints ?? []),
    plan?.intent,
    ...(plan?.constraints ?? []),
    ...regions.flatMap((region) => [region.label, region.purpose, ...region.uiRoles]),
    ...(plan?.data ?? [])
      .filter((item) => regionIds.has(item.regionId))
      .map((item) => item.description),
    ...(plan?.actions ?? [])
      .filter((item) => regionIds.has(item.regionId))
      .flatMap((item) => [item.label, item.priority]),
    ...(plan?.states ?? [])
      .filter((item) => !item.regionId || regionIds.has(item.regionId))
      .map((item) => item.state),
  ];
  return details.filter(Boolean).join(' ').toLowerCase();
}

export function extractLiteralProps(code: string, names: string[]): Map<string, string> {
  const escapedNames = Array.from(new Set(names.filter(Boolean))).map(escapeRegExp);
  if (escapedNames.length === 0) return new Map();
  const opening = new RegExp(`<(?:${escapedNames.join('|')})\\b([\\s\\S]*?)(?:/?>)`, 'u').exec(
    code,
  )?.[1];
  if (!opening) return new Map();
  const result = new Map<string, string>();
  const assigned = /([A-Za-z_$][\w$]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*["']([^"']*)["']\s*\})/gu;
  let match: RegExpExecArray | null;
  while ((match = assigned.exec(opening)) !== null) {
    const name = match[1];
    const value = match[2] ?? match[3] ?? match[4];
    if (name && value !== undefined) result.set(name, value);
  }
  return result;
}

export function renderVariantAxis(axis: AuthoritativeVariantAxis): string {
  return `${axis.prop}: ${axis.values
    .map((value) => (value.meaning ? `${value.value} (${value.meaning})` : value.value))
    .join(' | ')}`;
}

export function renderPublicImportContract(value: ResolvedComponentPublicImport): string {
  return `Public import contract: import \`${value.name}\` from \`${value.module}\` (${value.verified ? 'verified' : 'not verified'} via ${value.evidence}).`;
}

function variantIntentScore(
  prop: string,
  value: { value: string; meaning: string },
  context: string,
): number {
  const normalizedValue = value.value.toLowerCase();
  let score = 0;
  if (
    new RegExp(
      `\\b${escapeRegExp(prop)}\\s*[:=]\\s*["']?${escapeRegExp(normalizedValue)}\\b`,
      'iu',
    ).test(context)
  ) {
    score += 20;
  }
  if (hasTerm(context, normalizedValue)) score += 8;
  const contextTokens = new Set(tokens(context));
  for (const token of tokens(value.meaning)) if (contextTokens.has(token)) score += 2;
  return score;
}

function variantMeanings(axes: UsageCardVariantGuidance[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const axis of axes) {
    for (const value of axis.values) {
      if (value.meaning.trim()) result.set(`${axis.prop}:${value.value}`, value.meaning.trim());
    }
  }
  return result;
}

function hasTerm(text: string, term: string): boolean {
  if (!term) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(term)}(?=$|[^\\p{L}\\p{N}_])`, 'iu').test(
    text,
  );
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)
    .filter((token) => token.length >= 3);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
