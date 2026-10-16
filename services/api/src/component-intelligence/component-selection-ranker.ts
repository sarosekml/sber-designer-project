import path from 'node:path';
import type {
  ComponentUsageCard,
  IndexedComponentRecord,
  ProjectAgentNote,
} from '@sber-designer/design-indexer';

export interface ComponentRoleQuery {
  role: string;
  queries: string[];
  regionIds?: string[];
}

export interface ScoredComponent {
  component: IndexedComponentRecord;
  score: number;
  semanticScore: number;
  incidentalScore: number;
  sourceAuthority: number;
  matchedFields: string[];
  noteGuidance: string[];
}

interface ComponentSearchField {
  name: string;
  value: string;
  weight: number;
  semantic: boolean;
}

interface FieldMatch {
  field: ComponentSearchField;
  score: number;
}

const QUERY_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'be',
  'component',
  'components',
  'control',
  'controls',
  'current',
  'exists',
  'for',
  'from',
  'implement',
  'into',
  'matching',
  'of',
  'or',
  'project',
  'purpose',
  'region',
  'role',
  'screen',
  'support',
  'the',
  'this',
  'to',
  'use',
  'user',
  'with',
  'и',
  'в',
  'во',
  'для',
  'из',
  'к',
  'на',
  'по',
  'с',
  'со',
  'это',
]);

export function bestComponentForRole(input: {
  roleQuery: ComponentRoleQuery;
  components: IndexedComponentRecord[];
  notesByComponent: Map<string, ProjectAgentNote[]>;
  cardsByComponent: Map<string, ComponentUsageCard>;
  usedComponentIds: Set<string>;
  publicBarrels: Map<string, IndexedComponentRecord>;
  forbiddenComponentNames: string[];
}): ScoredComponent | null {
  const scored = input.components
    .filter(
      (component) =>
        !input.usedComponentIds.has(component.id) &&
        !isDemotedImplementationRecord(component, input.publicBarrels) &&
        !input.forbiddenComponentNames.some((forbiddenName) =>
          [component.shortName, component.id, component.title].some((value) =>
            sameComponentName(value, forbiddenName),
          ),
        ),
    )
    .flatMap((component) => {
      const notes = input.notesByComponent.get(component.id) ?? [];
      const card = input.cardsByComponent.get(component.id);
      const best = input.roleQuery.queries
        .map((query) => scoreComponent(input.roleQuery.role, query, component, notes, card))
        .sort(compareScores)[0];
      if (!best || best.score <= 0) return [];
      return [{ component, ...best }];
    })
    .sort((left, right) => {
      const relevanceDelta =
        right.semanticScore + right.sourceAuthority - (left.semanticScore + left.sourceAuthority);
      if (relevanceDelta !== 0) return relevanceDelta;
      const scoreDelta = right.score - left.score;
      if (scoreDelta !== 0) return scoreDelta;
      return confidenceRank(right.component.confidence) - confidenceRank(left.component.confidence);
    });
  return scored[0] ?? null;
}

export function searchConfidence(
  score: number,
  recordConfidence: IndexedComponentRecord['confidence'],
): 'high' | 'medium' | 'low' {
  if (recordConfidence === 'low') return 'low';
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

export function publicBarrelsByDirectory(
  components: IndexedComponentRecord[],
): Map<string, IndexedComponentRecord> {
  const barrels = new Map<string, IndexedComponentRecord>();
  for (const component of components) {
    if (!isIndexModule(component.filePath)) continue;
    barrels.set(path.posix.dirname(normalizeComponentFilePath(component.filePath)), component);
  }
  return barrels;
}

export function isIndexModule(filePath: string): boolean {
  return /(^|\/)index\.[cm]?[tj]sx?$/iu.test(normalizeComponentFilePath(filePath));
}

export function normalizeComponentFilePath(filePath: string): string {
  return filePath.replace(/\\/gu, '/').replace(/^\.\//u, '');
}

function compareScores(
  left: Omit<ScoredComponent, 'component'>,
  right: Omit<ScoredComponent, 'component'>,
): number {
  const semanticDelta = right.semanticScore - left.semanticScore;
  if (semanticDelta !== 0) return semanticDelta;
  return right.score - left.score;
}

function scoreComponent(
  role: string,
  query: string,
  component: IndexedComponentRecord,
  notes: ProjectAgentNote[],
  card: ComponentUsageCard | undefined,
): Omit<ScoredComponent, 'component'> {
  const fields = componentSearchFields(component, notes, card);
  const terms = queryTerms(role, query);
  let semanticScore = 0;
  let incidentalScore = 0;
  const matchedFields = new Set<string>();
  for (const term of terms) {
    const match = bestFieldMatch(term, fields);
    if (!match) continue;
    if (match.field.semantic) semanticScore += match.score;
    else incidentalScore += match.score;
    matchedFields.add(match.field.name);
  }
  const roleFit = roleSpecificScore(role, component, card);
  semanticScore += roleFit;
  if (roleFit > 0) matchedFields.add('directRoleEvidence');
  if (roleFit < 0) matchedFields.add('roleConflict');
  return {
    score: roundScore(semanticScore + incidentalScore),
    semanticScore: roundScore(semanticScore),
    incidentalScore: roundScore(incidentalScore),
    sourceAuthority: sourceAuthorityRank(component),
    matchedFields: Array.from(matchedFields),
    noteGuidance: notes.map((note) => note.note),
  };
}

function bestFieldMatch(term: string, fields: ComponentSearchField[]): FieldMatch | null {
  const matches = fields.flatMap((field) => {
    const baseScore = fieldMatchScore(term, field.value);
    return baseScore > 0 ? [{ field, score: baseScore * field.weight }] : [];
  });
  matches.sort((left, right) => {
    const scoreDelta = right.score - left.score;
    if (scoreDelta !== 0) return scoreDelta;
    return Number(right.field.semantic) - Number(left.field.semantic);
  });
  return matches[0] ?? null;
}

function fieldMatchScore(term: string, value: string): number {
  if (!value) return 0;
  if (value === term) return 8;
  const tokens = value.split(' ').filter(Boolean);
  if (tokens.includes(term)) return 6;
  if (tokens.some((token) => singularSearchToken(token) === singularSearchToken(term))) return 5;
  if (term.length >= 4 && tokens.some((token) => token.startsWith(term))) {
    return 3;
  }
  return 0;
}

function singularSearchToken(value: string): string {
  if (value.length > 3 && value.endsWith('s') && !value.endsWith('ss') && !value.endsWith('us')) {
    return value.slice(0, -1);
  }
  return value;
}

function queryTerms(role: string, query: string): string[] {
  const roleTerms = tokenize(role);
  const contextTerms = tokenize(query).filter((term) => !QUERY_STOP_WORDS.has(term));
  return Array.from(new Set([...roleTerms, ...contextTerms]));
}

function componentSearchFields(
  component: IndexedComponentRecord,
  notes: ProjectAgentNote[],
  card: ComponentUsageCard | undefined,
): ComponentSearchField[] {
  return [
    field('shortName', component.shortName, 1.8, true),
    field('usageCard.purpose', card?.purpose ?? '', 2.2, true),
    field('usageCard.whenToUse', card?.whenToUse.join(' ') ?? '', 2, true),
    field('descriptionLayer.purpose', component.descriptionLayer?.purpose ?? '', 2, true),
    field(
      'descriptionLayer.usage.when',
      component.descriptionLayer?.usage.map((usage) => usage.when).join(' ') ?? '',
      1.8,
      true,
    ),
    field('description', component.description ?? '', 1.5, true),
    field(
      'descriptionLayer.agentGuidance',
      component.descriptionLayer?.agentGuidance.join(' ') ?? '',
      1.4,
      true,
    ),
    field('agentNotes.note', notes.map((note) => note.note).join(' '), 1.4, true),
    field('title', titleLeaf(component.title), 1.3, true),
    field('tags', component.tags.join(' '), 1, true),
    field(
      'descriptionLayer.anatomy',
      component.descriptionLayer?.anatomy.join(' ') ?? '',
      0.7,
      true,
    ),
    field('id', component.id, 0.5, false),
    field('filePath', component.filePath, 0.2, false),
    field('groupIds', component.groupIds.join(' '), 0.2, false),
  ];
}

function field(
  name: string,
  value: string,
  weight: number,
  semantic: boolean,
): ComponentSearchField {
  return { name, value: normalizeSearchValue(value), weight, semantic };
}

function roleSpecificScore(
  role: string,
  component: IndexedComponentRecord,
  card: ComponentUsageCard | undefined,
): number {
  const identity = normalizeSearchValue(`${component.shortName} ${titleLeaf(component.title)}`);
  const semantics = normalizeSearchValue(
    [
      component.description ?? '',
      component.descriptionLayer?.purpose ?? '',
      component.descriptionLayer?.agentGuidance.join(' ') ?? '',
      component.descriptionLayer?.usage.map((usage) => usage.when).join(' ') ?? '',
      card?.purpose ?? '',
      card?.whenToUse.join(' ') ?? '',
      component.tags.join(' '),
    ].join(' '),
  );
  const evidence = `${identity} ${semantics}`;
  if (role === 'data-table') {
    let score = 0;
    if (/\b(data table|datatable|data grid|datagrid|table)\b/u.test(evidence)) score += 14;
    if (/\b(columns?|pagination|sorting|sortable|registry|row heavy|dense)\b/u.test(semantics)) {
      score += 6;
    }
    if (/\b(grid tiles?|tile grid|layout grid|card grid|cards grid)\b/u.test(evidence)) {
      score -= 24;
    }
    return score;
  }
  if (role === 'status-badge') {
    let score = 0;
    if (/\b(status badge|badge|chip|marker|tag|state indicator)\b/u.test(evidence)) score += 12;
    if (/\b(counter|count|number badge)\b/u.test(evidence)) score -= 10;
    return score;
  }
  if (role === 'filters') {
    let score = 0;
    if (/\b(filter bar|filters?|search|filter modal|filter panel)\b/u.test(evidence)) score += 12;
    if (
      /\b(input date|date picker|calendar)\b/u.test(identity) &&
      !/\bfilters?\b/u.test(semantics)
    ) {
      score -= 10;
    }
    if (/\b(mass actions?|bulk actions?|batch operations?|selected rows?)\b/u.test(evidence)) {
      score -= 12;
    }
    if (/\b(status badge|state indicator)\b/u.test(evidence)) score -= 12;
    return score;
  }
  if (role === 'mass-actions') {
    let score = 0;
    if (
      /\b(mass actions?|bulk actions?|batch operations?|selected rows?|multi select)\b/u.test(
        evidence,
      )
    ) {
      score += 14;
    }
    if (/\b(grid tiles?|tile grid|layout grid|card grid|cards grid)\b/u.test(evidence)) {
      score -= 18;
    }
    return score;
  }
  if (role === 'side-preview') {
    return /\b(side preview|preview rail|details rail|master detail|selected row details)\b/u.test(
      evidence,
    )
      ? 14
      : 0;
  }
  return 0;
}

function sourceAuthorityRank(component: IndexedComponentRecord): number {
  const normalizedPath = normalizeComponentFilePath(component.filePath);
  let rank = 0;
  if (isIndexModule(normalizedPath)) rank += 4;
  if (/\/(?:plugins?|internal|implementation|parts|helpers)\//iu.test(normalizedPath)) rank -= 6;
  const baseName = path.posix.basename(normalizedPath).replace(/\.[cm]?[tj]sx?$/iu, '');
  if (sameComponentName(baseName, component.shortName)) rank += 2;
  return rank;
}

function isDemotedImplementationRecord(
  component: IndexedComponentRecord,
  publicBarrels: Map<string, IndexedComponentRecord>,
): boolean {
  if (component.confidence !== 'low') return false;
  if (isIndexModule(component.filePath)) return false;
  return publicBarrels.has(path.posix.dirname(normalizeComponentFilePath(component.filePath)));
}

function titleLeaf(title: string): string {
  return title.split('/').at(-1) ?? title;
}

function tokenize(value: string): string[] {
  return normalizeSearchValue(value).split(' ').filter(Boolean);
}

function normalizeSearchValue(value: string): string {
  return splitCamelCase(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function splitCamelCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/gu, '$1 $2').replace(/([A-Za-z])(\d)/gu, '$1 $2');
}

function sameComponentName(left: string, right: string): boolean {
  const normalize = (value: string) => value.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
  return normalize(left) === normalize(right);
}

function confidenceRank(confidence: IndexedComponentRecord['confidence']): number {
  if (confidence === 'high') return 3;
  if (confidence === 'medium') return 2;
  return 1;
}

function roundScore(score: number): number {
  return Math.round(score * 10) / 10;
}
