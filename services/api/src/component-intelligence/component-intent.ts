import { readWorkspaceFile } from '../safe-fs';
import { htmlComponentFamilyPresent } from '../screen-craft-reuse-utils';
import type { ComponentUseCandidate, TaskRelevantComponentPack } from './component-pack';

export interface ComponentReplacementIntent {
  forbidden: string;
  required: string;
}

export type ComponentReplacementValidationStatus = 'passed' | 'failed';

export interface ComponentReplacementValidation {
  status: ComponentReplacementValidationStatus;
  reasonCode:
    | 'no_intent'
    | 'forbidden_component_present'
    | 'required_component_missing'
    | 'raw_layout_fallback'
    | 'replacement_verified';
  reason: string;
  intent: ComponentReplacementIntent;
  forbiddenPresent: boolean;
  requiredPresent: boolean;
  rawLayoutFallbacks: string[];
}

export type ComponentRoleContractValidationStatus = 'passed' | 'failed' | 'advisory';

export interface ComponentRoleContractValidation {
  status: ComponentRoleContractValidationStatus;
  reasonCode:
    | 'no_contract'
    | 'design_system_gap'
    | 'required_component_missing'
    | 'raw_layout_fallback'
    | 'role_contract_verified'
    | 'role_contract_advisory';
  reason: string;
  role: string;
  required: string;
  requiredPresent: boolean;
  rawLayoutFallbacks: string[];
  advisoryReason?: string;
  usedComponentIds?: string[];
  optionalUnused?: Array<{ role: string; componentId: string; component: string }>;
  repair?: { kind: 'retrieve-hydrate-repair'; role: string };
}

interface ComponentRoleContract {
  role: string;
  componentId: string;
  required: string;
  aliases: string[];
  requiredClasses: string[];
  enforce: boolean;
  advisoryReason?: string;
}

interface ComponentRoleContractOptions {
  userRequest?: string | null;
  activeScreenName?: string | null;
  activeScreenDescription?: string | null;
}

interface SourceComponentReference {
  name: string;
  index: number;
}

interface SourceRange {
  start: number;
  end: number;
}

const CONTRACT_ROLE_PATTERNS = [
  /^content-panel$/u,
  /^data-table$/u,
  /^page-action$/u,
  /^actions$/u,
  /^status-badge$/u,
  /^requested-component-/u,
];

export function extractComponentReplacementIntent(
  userRequest: string | null | undefined,
): ComponentReplacementIntent | null {
  const request = userRequest?.trim();
  if (!request) return null;
  const patterns = [
    /\breplace\s+(?:all\s+|every\s+)?[`'"]?([A-Za-z][A-Za-z0-9_]*)[`'"]?(?:\s+components?)?\s+(?:with|by)\s+[`'"]?([A-Za-z][A-Za-z0-9_]*)[`'"]?/iu,
    /\bremove\s+[`'"]?([A-Za-z][A-Za-z0-9_]*)[`'"]?\s+and\s+use\s+[`'"]?([A-Za-z][A-Za-z0-9_]*)[`'"]?/iu,
    /замен\p{L}*\s+(?:все\s+|каждый\s+|компонент\s+)?[`'"]?([\p{L}][\p{L}0-9_]*)[`'"]?(?:\s+компонент\p{L}*)?\s+на\s+[`'"]?([\p{L}][\p{L}0-9_]*)[`'"]?/iu,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(request);
    if (!match?.[1] || !match?.[2]) continue;
    return {
      forbidden: normalizeComponentName(match[1]),
      required: normalizeComponentName(match[2]),
    };
  }
  return null;
}

export function extractRequiredComponentNames(userRequest: string | null | undefined): string[] {
  const request = userRequest?.trim();
  if (!request) return [];
  const forbidden = new Set(
    extractForbiddenComponentNames(request).map((name) => componentNameKey(name)),
  );
  const patterns = [
    /\b(?:must\s+use|use)\s+(?:the\s+)?component\s+[`'"]?([A-Za-z][A-Za-z0-9_]*)[`'"]?/giu,
    /(?<![\p{L}\p{N}_])(?:используй|используйте|использовать)\s+компонент\p{L}*\s+[`'"]?([\p{L}][\p{L}0-9_]*)[`'"]?/giu,
  ];
  const names: string[] = [];
  for (const pattern of patterns) {
    for (const match of request.matchAll(pattern)) {
      if (!match[1]) continue;
      const name = normalizeComponentName(match[1]);
      if (!forbidden.has(componentNameKey(name))) names.push(name);
    }
  }
  return uniqueNames(names);
}

export function extractForbiddenComponentNames(userRequest: string | null | undefined): string[] {
  const request = userRequest?.trim();
  if (!request) return [];
  const patterns = [
    /\b(?:do\s+not|don['’]t|never)\s+use\s+(?:the\s+)?component\s+[`'"]?([A-Za-z][A-Za-z0-9_]*)[`'"]?/giu,
    /\b(?:[Dd]o\s+not|[Dd]on['’]t|[Nn]ever)\s+use\s+[`'"]?([A-Z][A-Za-z0-9_]*)[`'"]?(?:\s+component)?/gu,
    /(?<![\p{L}\p{N}_])(?:не\s+используй|не\s+используйте|не\s+использовать|не\s+применяй|не\s+применяйте|не\s+применять|запрещено\s+использовать)\s+компонент\p{L}*\s+[`'"]?([\p{L}][\p{L}0-9_]*)[`'"]?/giu,
    /(?<![\p{L}\p{N}_])(?:[Нн]е\s+используй|[Нн]е\s+используйте|[Нн]е\s+использовать|[Нн]е\s+применяй|[Нн]е\s+применяйте|[Нн]е\s+применять)\s+[`'"]?([\p{Lu}][\p{L}0-9_]*)[`'"]?/gu,
    /(?<![\p{L}\p{N}_])без\s+компонент\p{L}*\s+[`'"]?([\p{L}][\p{L}0-9_]*)[`'"]?/giu,
  ];
  const names: string[] = [];
  for (const pattern of patterns) {
    for (const match of request.matchAll(pattern)) {
      if (match[1]) names.push(normalizeComponentName(match[1]));
    }
  }
  return uniqueNames(names);
}

/**
 * Keep explicit prohibitions available to validation while preventing their
 * component names from being reinterpreted as positive screen/role intent.
 */
export function positiveComponentIntentText(userRequest: string | null | undefined): string {
  const request = userRequest?.trim();
  if (!request) return '';
  let positive = request;
  for (const forbiddenName of extractForbiddenComponentNames(request)) {
    const escaped = escapeRegExp(forbiddenName);
    positive = positive.replace(
      new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'giu'),
      ' ',
    );
  }
  return positive.replace(/\s+/gu, ' ').trim();
}

export function validateComponentReplacementSource(
  source: string,
  intent: ComponentReplacementIntent,
): ComponentReplacementValidation {
  const forbiddenPresent = componentNamePresent(source, intent.forbidden);
  const requiredAliases = componentAliasesForRequired(intent.required);
  const requiredPresent = componentAliasesPresent(source, requiredAliases);
  const rawLayoutFallbacks = rawLayoutFallbacksForReplacement(source, intent);

  if (forbiddenPresent) {
    return {
      status: 'failed',
      reasonCode: 'forbidden_component_present',
      reason: `Forbidden component ${intent.forbidden} is still present after replacement.`,
      intent,
      forbiddenPresent,
      requiredPresent,
      rawLayoutFallbacks,
    };
  }
  if (!requiredPresent) {
    return {
      status: 'failed',
      reasonCode: 'required_component_missing',
      reason: `Required replacement component ${intent.required} was not found in the changed source.`,
      intent,
      forbiddenPresent,
      requiredPresent,
      rawLayoutFallbacks,
    };
  }
  if (rawLayoutFallbacks.length > 0) {
    return {
      status: 'failed',
      reasonCode: 'raw_layout_fallback',
      reason: `Replacement uses raw layout fallback ${rawLayoutFallbacks.join(
        ', ',
      )} instead of the ${intent.required} layout contract.`,
      intent,
      forbiddenPresent,
      requiredPresent,
      rawLayoutFallbacks,
    };
  }
  return {
    status: 'passed',
    reasonCode: 'replacement_verified',
    reason: `${intent.forbidden} was replaced with ${intent.required}.`,
    intent,
    forbiddenPresent,
    requiredPresent,
    rawLayoutFallbacks,
  };
}

export async function validateRuntimeComponentReplacement(input: {
  workspacePath: string | null;
  userRequest: string | null | undefined;
  changedFiles: string[];
}): Promise<ComponentReplacementValidation | null> {
  const intent = extractComponentReplacementIntent(input.userRequest);
  if (!intent || !input.workspacePath || input.changedFiles.length === 0) return null;
  const sources: string[] = [];
  for (const filePath of input.changedFiles) {
    if (!/\.[cm]?[tj]sx?$/iu.test(filePath)) continue;
    const source = await readWorkspaceFile(input.workspacePath, filePath).catch(() => null);
    if (source) sources.push(source);
  }
  if (sources.length === 0) return null;
  return validateComponentReplacementSource(sources.join('\n\n'), intent);
}

export function validateComponentRoleContractsSource(
  source: string,
  componentPack: TaskRelevantComponentPack | null | undefined,
  options: ComponentRoleContractOptions = {},
): ComponentRoleContractValidation | null {
  const usage = componentRoleUsageSummary(source, componentPack);
  const gap = requiredSelectionGap(componentPack);
  if (gap) {
    return {
      status: 'failed',
      reasonCode: 'design_system_gap',
      reason: `Required role ${gap.role} has no selected design-system component; run one bounded retrieve, hydrate, and repair pass.`,
      role: gap.role,
      required: `project component for ${gap.role}`,
      requiredPresent: false,
      rawLayoutFallbacks: [],
      ...usage,
      repair: { kind: 'retrieve-hydrate-repair', role: gap.role },
    };
  }
  const contracts = roleContractsFromComponentPack(componentPack, options);
  if (contracts.length === 0) return null;
  for (const contract of contracts) {
    const requiredPresent =
      componentAliasesPresent(source, contract.aliases) ||
      requiredClassesPresent(source, contract.requiredClasses);
    const rawLayoutFallbacks = rawLayoutFallbacksForRoleContract(source, contract);
    if (!requiredPresent) {
      return {
        status: contract.enforce ? 'failed' : 'advisory',
        reasonCode: contract.enforce ? 'required_component_missing' : 'role_contract_advisory',
        reason: `Component-pack role ${contract.role} expected ${contract.required}, but the changed source did not use that component family.`,
        role: contract.role,
        required: contract.required,
        requiredPresent,
        rawLayoutFallbacks,
        ...usage,
        ...(contract.advisoryReason ? { advisoryReason: contract.advisoryReason } : {}),
      };
    }
    if (rawLayoutFallbacks.length > 0) {
      return {
        status: contract.enforce ? 'failed' : 'advisory',
        reasonCode: contract.enforce ? 'raw_layout_fallback' : 'role_contract_advisory',
        reason: `Component-pack role ${contract.role} used raw fallback ${rawLayoutFallbacks.join(
          ', ',
        )} instead of ${contract.required}.`,
        role: contract.role,
        required: contract.required,
        requiredPresent,
        rawLayoutFallbacks,
        ...usage,
        ...(contract.advisoryReason ? { advisoryReason: contract.advisoryReason } : {}),
      };
    }
  }
  const first = contracts[0]!;
  return {
    status: 'passed',
    reasonCode: 'role_contract_verified',
    reason: `Component-pack role ${first.role} used ${first.required}.`,
    role: first.role,
    required: first.required,
    requiredPresent: true,
    rawLayoutFallbacks: [],
    ...usage,
  };
}

export async function validateRuntimeComponentRoleContracts(input: {
  workspacePath: string | null;
  componentPack: TaskRelevantComponentPack | null | undefined;
  changedFiles: string[];
  userRequest?: string | null;
  activeScreenName?: string | null;
  activeScreenDescription?: string | null;
}): Promise<ComponentRoleContractValidation | null> {
  if (!input.workspacePath || input.changedFiles.length === 0) return null;
  const options = {
    userRequest: input.userRequest ?? null,
    activeScreenName: input.activeScreenName ?? null,
    activeScreenDescription: input.activeScreenDescription ?? null,
  };
  if (
    roleContractsFromComponentPack(input.componentPack, options).length === 0 &&
    !requiredSelectionGap(input.componentPack)
  ) {
    return null;
  }
  const sources: string[] = [];
  for (const filePath of input.changedFiles) {
    if (!/\.(?:html?|[cm]?[tj]sx?)$/iu.test(filePath)) continue;
    const source = await readWorkspaceFile(input.workspacePath, filePath).catch(() => null);
    if (source) sources.push(source);
  }
  if (sources.length === 0) return null;
  return validateComponentRoleContractsSource(sources.join('\n\n'), input.componentPack, options);
}

export function componentReplacementNotice(validation: ComponentReplacementValidation): string {
  return [
    '',
    '',
    'sber-designer: Component replacement verification failed.',
    `Reason: ${validation.reason}`,
    `Expected: remove ${validation.intent.forbidden} and use ${validation.intent.required}.`,
  ].join('\n');
}

export function componentRoleContractNotice(validation: ComponentRoleContractValidation): string {
  return [
    '',
    '',
    'sber-designer: Component role contract verification failed.',
    `Reason: ${validation.reason}`,
    `Expected: use ${validation.required} for ${validation.role}.`,
  ].join('\n');
}

export function componentRoleContractReviewNotice(
  validation: ComponentRoleContractValidation,
): string {
  return [
    '',
    '',
    'sber-designer: Component role contract verification needs review.',
    `Reason: ${validation.reason}`,
    `Expected: use ${validation.required} for ${validation.role}.`,
  ].join('\n');
}

function componentAliasesForRequired(required: string): string[] {
  return uniqueNames([required]);
}

function rawLayoutFallbacksForReplacement(
  source: string,
  intent: ComponentReplacementIntent,
): string[] {
  return rawLayoutFallbacks(source, componentAliasesForRequired(intent.required));
}

function roleContractsFromComponentPack(
  componentPack: TaskRelevantComponentPack | null | undefined,
  options: ComponentRoleContractOptions = {},
): ComponentRoleContract[] {
  if (!componentPack) return [];
  const requiredRoles = explicitRequiredRoleSet(componentPack);
  return componentPack.candidates.flatMap((candidate) => {
    const explicitlyRequired = requiredRoles?.has(candidate.role) ?? false;
    if (requiredRoles) {
      if (!candidate.userRequired && !explicitlyRequired) return [];
    } else if (!isRoleContractCandidate(candidate.role)) {
      return [];
    }
    const required = candidate.shortName.trim();
    if (!required) return [];
    let enforcement = roleContractEnforcement(componentPack, candidate, options);
    if (
      candidate.role === 'data-table' &&
      enforcement.enforce &&
      !requiredRoles?.has(candidate.role) &&
      !shouldEnforceDataTableContract(componentPack, options)
    ) {
      return [];
    }
    return [
      {
        role: candidate.role,
        componentId: candidate.componentId,
        required,
        aliases: componentAliasesForCandidate(candidate),
        requiredClasses: candidate.requiredClasses ?? [],
        enforce: enforcement.enforce,
        ...(enforcement.reason ? { advisoryReason: enforcement.reason } : {}),
      },
    ];
  });
}

function roleContractEnforcement(
  componentPack: TaskRelevantComponentPack,
  candidate: ComponentUseCandidate,
  options: ComponentRoleContractOptions,
): { enforce: boolean; reason?: string } {
  if (componentPack.status === 'weak' && !componentPack.selectionPlan?.requiredRoles) {
    return { enforce: false, reason: 'component pack is weak' };
  }
  if (componentPack.stale) {
    return { enforce: false, reason: 'component pack is stale' };
  }
  if (componentPack.taskKind === 'screen-edit') {
    return { enforce: false, reason: 'screen-edit role contracts are advisory' };
  }
  const confidence = `${candidate.confidence} ${candidate.recordConfidence}`.toLowerCase();
  const requiredByPlan = componentPack.selectionPlan?.requiredRoles?.includes(candidate.role);
  if (/\blow\b/u.test(confidence) && !candidate.userRequired && !requiredByPlan) {
    return { enforce: false, reason: 'candidate confidence is low' };
  }
  if (
    componentPack.taskKind === 'image-to-screen' ||
    componentPack.taskKind === 'screen-generation' ||
    componentPack.taskKind === 'screen-redesign' ||
    explicitlyNamesComponent(candidate, options)
  ) {
    return { enforce: true };
  }
  return { enforce: false, reason: 'task intent is not generation-specific' };
}

function explicitlyNamesComponent(
  candidate: ComponentUseCandidate,
  options: ComponentRoleContractOptions,
): boolean {
  const haystack = [options.userRequest, options.activeScreenName, options.activeScreenDescription]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase();
  if (!haystack) return false;
  return componentAliasesForCandidate(candidate).some((alias) =>
    haystack.includes(alias.toLowerCase()),
  );
}

function isRoleContractCandidate(role: string): boolean {
  return CONTRACT_ROLE_PATTERNS.some((pattern) => pattern.test(role));
}

function explicitRequiredRoleSet(componentPack: TaskRelevantComponentPack): Set<string> | null {
  const roles = componentPack.selectionPlan?.requiredRoles;
  return roles ? new Set(roles) : null;
}

function requiredSelectionGap(
  componentPack: TaskRelevantComponentPack | null | undefined,
): NonNullable<TaskRelevantComponentPack['selectionPlan']>['gaps'][number] | null {
  if (!componentPack?.selectionPlan?.requiredRoles) return null;
  const requiredRoles = new Set(componentPack.selectionPlan.requiredRoles);
  return componentPack.selectionPlan.gaps.find((gap) => requiredRoles.has(gap.role)) ?? null;
}

function componentRoleUsageSummary(
  source: string,
  componentPack: TaskRelevantComponentPack | null | undefined,
): Pick<ComponentRoleContractValidation, 'usedComponentIds' | 'optionalUnused'> {
  if (!componentPack) return { usedComponentIds: [], optionalUnused: [] };
  const requiredRoles = explicitRequiredRoleSet(componentPack);
  const usedComponentIds = componentPack.candidates
    .filter(
      (candidate) =>
        componentAliasesPresent(source, componentAliasesForCandidate(candidate)) ||
        requiredClassesPresent(source, candidate.requiredClasses ?? []),
    )
    .map((candidate) => candidate.componentId);
  const used = new Set(usedComponentIds);
  const optionalUnused = requiredRoles
    ? componentPack.candidates
        .filter(
          (candidate) =>
            !candidate.userRequired &&
            !requiredRoles.has(candidate.role) &&
            !used.has(candidate.componentId),
        )
        .map((candidate) => ({
          role: candidate.role,
          componentId: candidate.componentId,
          component: candidate.shortName,
        }))
    : [];
  return { usedComponentIds, optionalUnused };
}

function shouldEnforceDataTableContract(
  componentPack: TaskRelevantComponentPack,
  options: ComponentRoleContractOptions,
): boolean {
  if (hasDataTableIntentText(options)) return true;
  return componentPack.candidates.some((candidate) => {
    if (candidate.role !== 'data-table') return false;
    const confidence = `${candidate.confidence} ${candidate.recordConfidence}`.toLowerCase();
    const score = typeof candidate.score === 'number' ? candidate.score : 0;
    if (!/\b(high|confirmed)\b/u.test(confidence) || score < 10) return false;
    const text = [
      candidate.title,
      candidate.shortName,
      candidate.reason,
      ...(candidate.guidance ?? []),
    ]
      .join(' ')
      .toLowerCase();
    return /\b(data\s*table|datatable|registry|row-heavy|rows?|columns?)\b/u.test(text);
  });
}

function hasDataTableIntentText(options: ComponentRoleContractOptions): boolean {
  const text = [
    options.userRequest ?? '',
    options.activeScreenName ?? '',
    options.activeScreenDescription ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return /\b(data\s*table|datatable|registry|register|row-heavy|rows?|columns?)\b/u.test(text);
}

function componentAliasesForCandidate(
  candidate: TaskRelevantComponentPack['candidates'][number],
): string[] {
  return candidate.userRequired
    ? uniqueNames([candidate.shortName])
    : uniqueNames([candidate.shortName, ...(candidate.componentFamily ?? [])]);
}

function rawLayoutFallbacksForRoleContract(
  source: string,
  contract: ComponentRoleContract,
): string[] {
  return rawLayoutFallbacks(source, contract.aliases, contract.requiredClasses);
}

function componentNamePresent(source: string, name: string): boolean {
  const escaped = escapeRegExp(name);
  return (
    new RegExp(`<\\s*${escaped}\\b`, 'u').test(source) ||
    new RegExp(`\\bimport\\s*\\{[^}]*\\b${escaped}\\b[^}]*\\}`, 'u').test(source) ||
    new RegExp(`\\bimport\\s+${escaped}\\b`, 'u').test(source)
  );
}

function componentAliasesPresent(source: string, aliases: string[]): boolean {
  const sourceNames = sourceComponentNames(source);
  return aliases.some(
    (alias) =>
      componentNamePresent(source, alias) ||
      sourceNames.some((name) => componentNameMatchesAlias(name, alias)),
  );
}

function requiredClassesPresent(source: string, requiredClasses: string[]): boolean {
  if (requiredClasses.length === 0) return false;
  const classSet = new Set(sourceClassNames(source));
  return htmlComponentFamilyPresent(requiredClasses, classSet);
}

function sourceClassNames(source: string): string[] {
  const classNames: string[] = [];
  for (const match of source.matchAll(/\bclass(?:Name)?\s*=\s*["']([^"']+)["']/giu)) {
    for (const className of (match[1] ?? '').split(/\s+/)) {
      const trimmed = className.trim();
      if (trimmed) classNames.push(trimmed);
    }
  }
  return uniqueNames(classNames);
}

function rawLayoutFallbacks(
  source: string,
  allowedAliases: string[],
  allowedClasses: string[] = [],
): string[] {
  const fallbacks: string[] = [];
  const allowedContainerRanges = componentContainerRanges(source, allowedAliases);
  for (const ref of sourceComponentReferences(source)) {
    const name = ref.name;
    if (allowedAliases.some((alias) => componentNameMatchesAlias(name, alias))) continue;
    if (rangeContainsIndex(allowedContainerRanges, ref.index)) continue;
    if (looksLikeLayoutFallback(name) || componentOpeningHasLayoutProps(source, name)) {
      fallbacks.push(name);
    }
  }
  if (allowedClasses.length > 0 && !requiredClassesPresent(source, allowedClasses)) {
    fallbacks.push(
      ...sourceClassNames(source).filter((className) =>
        /(?:card|panel|tile|surface|box|grid|container|stack|paper)/iu.test(className),
      ),
    );
  }
  return uniqueNames(fallbacks).sort(
    (left, right) => fallbackSortRank(left) - fallbackSortRank(right),
  );
}

function sourceComponentNames(source: string): string[] {
  return uniqueNames(sourceComponentReferences(source).map((ref) => ref.name));
}

function sourceComponentReferences(source: string): SourceComponentReference[] {
  const unique = new Map<string, SourceComponentReference>();
  for (const match of source.matchAll(/<\s*([A-Z][A-Za-z0-9_]*(?:\.[A-Z][A-Za-z0-9_]*)?)/gu)) {
    const raw = match[1];
    if (!raw) continue;
    const name = raw.split('.').at(-1) ?? raw;
    const key = `${name.toLowerCase()}:${match.index}`;
    unique.set(key, { name, index: match.index });
  }
  return Array.from(unique.values());
}

function componentContainerRanges(source: string, allowedAliases: string[]): SourceRange[] {
  if (allowedAliases.length === 0) return [];
  const ranges: SourceRange[] = [];
  const stack: Array<{ name: string; start: number }> = [];
  const tagPattern = /<\s*(\/?)\s*([A-Z][A-Za-z0-9_]*(?:\.[A-Z][A-Za-z0-9_]*)?)([^>]*)>/gu;
  for (const match of source.matchAll(tagPattern)) {
    const closing = match[1] === '/';
    const rawName = match[2];
    if (!rawName) continue;
    const name = rawName.split('.').at(-1) ?? rawName;
    if (!allowedAliases.some((alias) => componentNameMatchesAlias(name, alias))) continue;
    if (closing) {
      const stackIndex = findLastStackIndex(stack, name);
      if (stackIndex === -1) continue;
      const [opening] = stack.splice(stackIndex, 1);
      if (opening) ranges.push({ start: opening.start, end: match.index + match[0].length });
      continue;
    }
    const attrs = match[3] ?? '';
    if (attrs.trim().endsWith('/')) continue;
    stack.push({ name, start: match.index });
  }
  return ranges;
}

function findLastStackIndex(stack: Array<{ name: string; start: number }>, name: string): number {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index]?.name === name) return index;
  }
  return -1;
}

function rangeContainsIndex(ranges: SourceRange[], index: number): boolean {
  return ranges.some((range) => index > range.start && index < range.end);
}

function componentNameMatchesAlias(name: string, alias: string): boolean {
  const normalizedName = name.toLowerCase();
  const normalizedAlias = alias.toLowerCase();
  return normalizedName === normalizedAlias || normalizedName.endsWith(normalizedAlias);
}

function looksLikeLayoutFallback(name: string): boolean {
  return /(card|panel|surface|box|grid|layout|container|stack|paper)$/iu.test(name);
}

function fallbackSortRank(name: string): number {
  return /(box|grid|layout|container|stack)$/iu.test(name) ? 2 : 1;
}

function componentOpeningHasLayoutProps(source: string, name: string): boolean {
  const escaped = escapeRegExp(name);
  const pattern = new RegExp(`<\\s*(?:[A-Z][A-Za-z0-9_]*\\.)?${escaped}\\b([^>]*)>`, 'gu');
  for (const match of source.matchAll(pattern)) {
    const attrs = match[1] ?? '';
    if (/\b(?:sx|style|display|gridTemplate|gridTemplateColumns|flexWrap|gap)\s*=/u.test(attrs)) {
      return true;
    }
  }
  return false;
}

function normalizeComponentName(raw: string): string {
  const compact = raw.replace(/[^A-Za-z0-9_]/gu, '').trim();
  if (!compact) return raw.trim();
  if (/^[a-z0-9_]+$/u.test(compact)) {
    return `${compact.charAt(0).toUpperCase()}${compact.slice(1)}`;
  }
  return compact;
}

function componentNameKey(value: string): string {
  return value.replace(/[^\p{L}\p{N}_]/gu, '').toLowerCase();
}

function uniqueNames(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const clean = value.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
