/**
 * Data layer for the project-index tools: jsonl/json readers for the
 * design-index artifacts, icon-candidate matching/ranking, and the
 * search scoring helpers.
 */
import {
  DESIGN_INDEX_PATHS,
  type AssetRecord,
  type IconCandidateRecord,
  type IconIndexFile,
  type IndexedComponentRecord,
  type ProjectAgentNote,
  type RouteRecord,
  type RoutesIndexFile,
  type TokenRecord,
} from '@sber-designer/design-indexer';

import { readWorkspaceFile } from '../../safe-fs';

export interface ProjectIndexSearchResult {
  type: 'component' | 'token' | 'icon' | 'asset' | 'screen' | 'route' | 'note';
  id: string;
  title: string;
  filePath?: string;
  summary?: string;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  matchedFields: string[];
  matchReason: string;
  recordConfidence?: IndexedComponentRecord['confidence'];
  recommendedStoryId?: string | undefined;
  source?: string;
  validFor?: string[];
  usage?: {
    jsx?: string;
    importStatement?: string;
    requiresMaterialization?: boolean;
    tool?: string;
  };
  fields: Array<ProjectIndexSearchField | string>;
}

export interface ProjectIndexSearchField {
  name: string;
  value: string;
}

export function emptyProjectIndexCounts() {
  return {
    components: 0,
    componentGroups: 0,
    tokens: 0,
    icons: 0,
    iconCandidates: 0,
    iconSources: 0,
    workspaceIconSources: 0,
    externalIconSources: 0,
    externalIcons: 0,
    projectIconContracts: 0,
    fallbackIcons: 0,
    assets: 0,
    illustrations: 0,
    routes: 0,
    screens: 0,
    examples: 0,
    notes: 0,
    agentNotes: 0,
    diagnostics: 0,
  };
}

export async function readProjectIndexJsonl<T>(
  workspacePath: string,
  filePath: string,
): Promise<T[]> {
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

export async function readProjectIndexJson<T>(
  workspacePath: string,
  filePath: string,
  fallback: T,
): Promise<T> {
  try {
    return JSON.parse(await readWorkspaceFile(workspacePath, filePath)) as T;
  } catch {
    return fallback;
  }
}

export async function readTokens(workspacePath: string): Promise<TokenRecord[]> {
  const file = await readProjectIndexJson<{ tokens?: TokenRecord[] }>(
    workspacePath,
    DESIGN_INDEX_PATHS.tokens,
    { tokens: [] },
  );
  return file.tokens ?? [];
}

export async function readIcons(workspacePath: string): Promise<IconIndexFile> {
  return readProjectIndexJson<IconIndexFile>(workspacePath, DESIGN_INDEX_PATHS.icons, {
    projectIcons: [],
    fallback: {
      provider: 'lucide',
      packageName: 'lucide-react',
      packageVersion: 'unknown',
      count: 0,
      icons: [],
    },
  });
}

export async function readIconCandidates(workspacePath: string): Promise<IconCandidateRecord[]> {
  return readProjectIndexJsonl<IconCandidateRecord>(
    workspacePath,
    DESIGN_INDEX_PATHS.iconCandidates,
  );
}

export async function readAssets(workspacePath: string): Promise<AssetRecord[]> {
  return readProjectIndexJsonl<AssetRecord>(workspacePath, DESIGN_INDEX_PATHS.assets);
}

export function iconCandidateMatches(icon: IconCandidateRecord, needle: string): boolean {
  return iconCandidateSearchFields(icon).some((field) => {
    const value = typeof field === 'string' ? field : field.value;
    const normalized = normalizeSearch(value);
    return normalized === needle || normalized.includes(needle);
  });
}

export function iconCandidateSearchFields(
  icon: IconCandidateRecord,
): Array<ProjectIndexSearchField | string> {
  return [
    searchField('id', icon.id),
    searchField('name', icon.name),
    searchField('source', icon.source),
    searchField('validFor', icon.validFor.join(' ')),
    searchField('componentName', icon.componentName ?? ''),
    searchField('propName', icon.propName ?? ''),
    searchField('importName', icon.importName ?? ''),
    searchField('importSource', icon.importSource ?? ''),
    searchField('filePath', icon.filePath ?? ''),
    searchField('externalIconId', icon.externalIconId ?? ''),
    searchField('sourceId', icon.sourceId ?? ''),
    searchField('sourceRelPath', icon.sourceRelPath ?? ''),
    searchField('tags', icon.tags.join(' ')),
  ];
}

export function iconCandidateSummary(icon: IconCandidateRecord): string {
  if (icon.source === 'project-icon-prop') {
    return `project Icon ${icon.propName ?? 'iconName'} value: ${icon.name}`;
  }
  if (icon.source === 'project-asset') {
    return `project asset icon: ${icon.importName ?? icon.filePath ?? icon.name}`;
  }
  if (icon.source === 'project-file') {
    return `project icon file: ${icon.importName ?? icon.filePath ?? icon.name}`;
  }
  if (icon.source === 'external-icon-reference') {
    return `external icon reference: ${icon.sourceRelPath ?? icon.externalIconId ?? icon.name}`;
  }
  return `lucide fallback import: ${icon.importName ?? icon.name}`;
}

export function iconCandidateUsage(icon: IconCandidateRecord): {
  jsx?: string;
  importStatement?: string;
  requiresMaterialization?: boolean;
  tool?: string;
} {
  if (icon.source === 'project-icon-prop') {
    return {
      jsx: `<${icon.componentName ?? 'Icon'} ${icon.propName ?? 'iconName'}="${icon.name}" />`,
    };
  }
  if (icon.importName && icon.importSource) {
    return { importStatement: `import { ${icon.importName} } from '${icon.importSource}';` };
  }
  if (icon.importName && icon.filePath) {
    return { importStatement: `import ${icon.importName} from '${icon.filePath}';` };
  }
  if (icon.source === 'external-icon-reference') {
    return {
      requiresMaterialization: true,
      tool: 'materialize_indexed_icon',
    };
  }
  return {};
}

export function iconCandidateRank(icon: IconCandidateRecord): number {
  if (icon.source === 'project-icon-prop') return 0;
  if (icon.source === 'project-asset') return 1;
  if (icon.source === 'project-file') return 2;
  if (icon.source === 'external-icon-reference') return 3;
  return 4;
}

export function iconCandidateMatchRank(icon: IconCandidateRecord, needle: string): number {
  const exactFields = [icon.id, icon.name, icon.importName ?? ''];
  if (exactFields.some((field) => normalizeSearch(field) === needle)) return 0;
  return 1;
}

export function findFuzzyProjectIconCandidate(
  candidates: IconCandidateRecord[],
  idOrName: string,
): IconCandidateRecord | null {
  const scored = candidates
    .filter((icon) => icon.source !== 'lucide-fallback')
    .map((icon) => ({
      icon,
      score: fuzzyProjectIconScore(icon, idOrName),
    }))
    .filter((item) => item.score >= 10)
    .sort(
      (a, b) =>
        b.score - a.score ||
        iconCandidateRank(a.icon) - iconCandidateRank(b.icon) ||
        a.icon.name.localeCompare(b.icon.name),
    );
  return scored[0]?.icon ?? null;
}

function fuzzyProjectIconScore(icon: IconCandidateRecord, idOrName: string): number {
  const needleComparable = comparableIconName(idOrName);
  const needleTokens = iconNameTokens(idOrName);
  if (!needleComparable || needleTokens.length === 0) return 0;

  let bestScore = 0;
  const values = [icon.name, icon.importName ?? '', icon.id, ...icon.tags].filter(Boolean);
  for (const value of values) {
    const candidateComparable = comparableIconName(value);
    const candidateTokens = iconNameTokens(value);
    if (!candidateComparable || candidateTokens.length === 0) continue;

    const prefixLength = commonPrefixLength(candidateComparable, needleComparable);
    const firstTokenMatches =
      candidateTokens[0] === needleTokens[0] && (candidateTokens[0]?.length ?? 0) >= 4;
    const tokenOverlap = candidateTokens.filter((token) => needleTokens.includes(token)).length;
    const containsComparable =
      candidateComparable.startsWith(needleComparable) ||
      needleComparable.startsWith(candidateComparable);

    if (!firstTokenMatches && prefixLength < 5 && !containsComparable) continue;

    const score =
      (firstTokenMatches ? 8 : 0) +
      Math.min(8, prefixLength) +
      Math.min(6, tokenOverlap * 2) +
      (containsComparable ? 6 : 0);
    bestScore = Math.max(bestScore, score);
  }
  return bestScore;
}

function comparableIconName(value: string): string {
  return iconNameTokens(value).join('');
}

function iconNameTokens(value: string): string[] {
  return value
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function commonPrefixLength(left: string, right: string): number {
  const max = Math.min(left.length, right.length);
  let index = 0;
  while (index < max && left[index] === right[index]) index += 1;
  return index;
}

export function hasProjectIconContract(candidates: IconCandidateRecord[]): boolean {
  return candidates.some((icon) => icon.source === 'project-icon-prop');
}

export async function readRoutes(workspacePath: string): Promise<RouteRecord[]> {
  const file = await readProjectIndexJson<RoutesIndexFile>(
    workspacePath,
    DESIGN_INDEX_PATHS.routes,
    {
      routes: [],
    },
  );
  return file.routes ?? [];
}

export function addScoredResult(
  results: ProjectIndexSearchResult[],
  query: string,
  result: Omit<ProjectIndexSearchResult, 'score' | 'confidence' | 'matchedFields' | 'matchReason'>,
): void {
  const evidence = scoreProjectIndexResult(query, result.fields);
  const score = evidence.score;
  if (score <= 0) return;
  results.push({
    ...result,
    score,
    confidence: searchConfidence(score),
    matchedFields: evidence.matchedFields,
    matchReason: buildMatchReason(evidence.matchedFields),
  });
}

export function scoreProjectIndexResult(
  query: string,
  fields: Array<ProjectIndexSearchField | string>,
): { score: number; matchedFields: string[] } {
  const terms = normalizeSearch(query)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  if (terms.length === 0) return { score: 0, matchedFields: [] };
  const normalizedFields = fields.map((field, index) => {
    if (typeof field === 'string') {
      return { name: `field[${index}]`, value: normalizeSearch(field) };
    }
    return {
      name: field.name,
      value: normalizeSearch(field.value),
    };
  });
  const haystack = normalizedFields.map((field) => field.value).join(' ');
  let score = 0;
  const matchedFields = new Set<string>();
  for (const term of terms) {
    const exact = normalizedFields.find((field) => field.value === term);
    const prefix = normalizedFields.find((field) => field.value.startsWith(term));
    const contains = normalizedFields.find((field) => field.value.includes(term));
    if (exact) {
      score += 8;
      matchedFields.add(exact.name);
    } else if (prefix) {
      score += 5;
      matchedFields.add(prefix.name);
    } else if (contains) {
      score += 2;
      matchedFields.add(contains.name);
    } else if (haystack.includes(term)) {
      score += 1;
    }
  }
  return { score, matchedFields: Array.from(matchedFields) };
}

export function searchField(name: string, value: string): ProjectIndexSearchField {
  return { name, value };
}

export function searchConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

export function buildMatchReason(matchedFields: string[]): string {
  if (matchedFields.length === 0) return 'Matched query against indexed record text.';
  return `Matched query in ${matchedFields.join(', ')}.`;
}

export function normalizeSearch(value: string): string {
  return value.toLowerCase().trim();
}

export function groupComponentAgentNotes(
  notes: ProjectAgentNote[],
): Map<string, ProjectAgentNote[]> {
  const byComponent = new Map<string, ProjectAgentNote[]>();
  for (const note of notes) {
    if (note.targetType !== 'component' || !note.targetId) continue;
    const existing = byComponent.get(note.targetId) ?? [];
    existing.push(note);
    byComponent.set(note.targetId, existing);
  }
  return byComponent;
}

export function compactLine(value: string, maxLength: number): string {
  const compacted = value.replace(/\s+/g, ' ').trim();
  if (compacted.length <= maxLength) return compacted;
  return `${compacted.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function assetSearchKeys(asset: AssetRecord): string[] {
  return [
    asset.id,
    asset.name,
    asset.filePath,
    asset.importName ?? '',
    asset.importSource ?? '',
    asset.storybookTitle ?? '',
    asset.storybookStory ?? '',
    ...asset.tags,
  ].filter(Boolean);
}

// ---------- get_selection ----------------------------------------------
