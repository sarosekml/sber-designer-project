import { DESIGN_INDEX_PATHS } from '@sber-designer/design-indexer';
import type { TaskRelevantComponentSelectionMap } from './component-pack';

const MAX_SELECTION_MAP_PROMPT_CHARS = 18_000;

export function renderComponentSelectionMap(
  selectionMap: TaskRelevantComponentSelectionMap | null | undefined,
): string {
  if (!selectionMap || selectionMap.entries.length === 0) return '';
  const header = [
    '## Project Component Selection Map',
    '',
    `Complete discovery map: ${selectionMap.counts.indexed} indexed · ${selectionMap.counts.described} described · ${selectionMap.counts.diverged} diverged.`,
    `- freshness: ${selectionMap.stale ? 'stale' : 'current'}; source: ${selectionMap.source}`,
    `- artifact: ${DESIGN_INDEX_PATHS.componentSelectionMap}`,
    '- Plan against the complete list before choosing components. The artifact carries compact purpose, roles, capabilities, when-to-use/avoid, and variant axes.',
    '- Do not guess props from this map. Hydrate usage-card/source contracts only for components selected for a concrete screen region.',
    '',
    '### Components',
  ];
  const standard = [...header, ...selectionMap.entries.map(renderStandardSelectionMapRow)].join(
    '\n',
  );
  if (standard.length <= MAX_SELECTION_MAP_PROMPT_CHARS) return standard;
  const compact = [...header, ...selectionMap.entries.map(renderCompactSelectionMapRow)].join('\n');
  if (compact.length <= MAX_SELECTION_MAP_PROMPT_CHARS) return compact;
  return [...header, ...selectionMap.entries.map(renderMinimalSelectionMapRow)].join('\n');
}

function renderStandardSelectionMapRow(
  entry: TaskRelevantComponentSelectionMap['entries'][number],
): string {
  const roles = entry.roles.join(',') || 'unclassified';
  const keywords = entry.keywords.join(',') || 'none';
  const variants = entry.variantAxes
    .map((axis) => `${axis.prop}=${axis.values.join('/')}`)
    .join(';');
  return [
    `- \`${entry.publicName}\` (${entry.componentId})`,
    `  - description: ${entry.descriptionStatus}; confidence: ${entry.evidenceConfidence}; roles: ${roles}`,
    `  - keywords: ${keywords}${variants ? `; variants: ${variants}` : ''}`,
  ].join('\n');
}

function renderCompactSelectionMapRow(
  entry: TaskRelevantComponentSelectionMap['entries'][number],
): string {
  const roles = entry.roles.join(',') || '-';
  const keywords = entry.keywords.slice(0, 3).join(',') || '-';
  return `- ${entry.componentId} | ${entry.publicName} | ${entry.descriptionStatus}/${entry.evidenceConfidence} | roles:${roles} | kw:${keywords}`;
}

function renderMinimalSelectionMapRow(
  entry: TaskRelevantComponentSelectionMap['entries'][number],
): string {
  return `- ${entry.componentId}|${entry.publicName}|${entry.descriptionStatus}`;
}
