import type { ComponentUseCandidate } from './component-intelligence/component-pack';
import type { ScreenCraftComponentReuseSummary } from './screen-craft';

/**
 * CSS catalog records aggregate every BEM element observed across examples.
 * Those elements describe optional states/slots, not a requirement that every
 * component instance render every slot. The root class is the stable family
 * identity used by component-reuse readiness.
 */
export function htmlComponentFamilyPresent(
  requiredClasses: string[],
  classSet: ReadonlySet<string>,
): boolean {
  const baseClass = requiredClasses[0];
  return Boolean(baseClass && classSet.has(baseClass));
}

export function scoreComponentReuse(
  candidates: ComponentUseCandidate[],
  usedTags: Set<string>,
  exactOnly: (candidate: ComponentUseCandidate) => boolean = () => false,
) {
  const exact: string[] = [];
  const substituted: ScreenCraftComponentReuseSummary['substituted'] = [];
  const skipped: ScreenCraftComponentReuseSummary['skipped'] = [];

  for (const candidate of candidates) {
    if (usedTags.has(candidate.shortName)) {
      exact.push(candidate.shortName);
      continue;
    }
    const substituteTags = exactOnly(candidate)
      ? []
      : componentReuseSubstituteTags(candidate).filter((tag) => usedTags.has(tag));
    if (substituteTags.length > 0) {
      substituted.push({
        role: candidate.role,
        expected: candidate.shortName,
        componentId: candidate.componentId,
        used: substituteTags.sort((a, b) => a.localeCompare(b)),
      });
      continue;
    }
    skipped.push({
      role: candidate.role,
      expected: candidate.shortName,
      componentId: candidate.componentId,
    });
  }

  exact.sort((a, b) => a.localeCompare(b));
  substituted.sort((a, b) => a.expected.localeCompare(b.expected));
  skipped.sort((a, b) => a.expected.localeCompare(b.expected));
  const earned = roundReuseScore(exact.length + substituted.length * 0.5);
  const total = candidates.length;
  return {
    exact,
    substituted,
    skipped,
    score: {
      earned,
      total,
      label: `${formatReuseScore(earned)}/${total}`,
    },
  };
}

export function componentReuseSubstituteTags(candidate: ComponentUseCandidate): string[] {
  const familyTags = (candidate.componentFamily ?? []).filter((tag) =>
    roleCompatibleFamilyTag(candidate.role, tag),
  );
  const fallbackTags = GENERIC_COMPONENT_REUSE_FALLBACK_TAGS[candidate.role] ?? [];
  return uniqueStrings([...familyTags, ...fallbackTags]).filter(
    (tag) => tag !== candidate.shortName,
  );
}

function roleCompatibleFamilyTag(role: string, tag: string): boolean {
  const compact = tag.replace(/[^A-Za-z0-9]/gu, '');
  switch (role) {
    case 'breadcrumb':
      return /(?:bread)?crumb|trail/iu.test(compact);
    case 'page-header':
      return /page(?:bar|header|title)|titlebar|topbar/iu.test(compact);
    case 'section-header':
      return /sectionheader|groupheader|subheader/iu.test(compact);
    case 'content-panel':
      return /card|panel|paper|surface|section|tile/iu.test(compact);
    case 'data-table':
      return /datagrid|datatable|table|grid|list/iu.test(compact);
    case 'filters':
      return /filter|search|input|select/iu.test(compact);
    case 'mass-actions':
      return /action|bulk|button|toolbar/iu.test(compact);
    case 'side-preview':
      return /aside|detail|drawer|preview|sidepanel/iu.test(compact);
    default:
      return false;
  }
}

// Generic UI vocabulary only: task/project-specific substitutes must come from
// role-compatible candidate.componentFamily values in the current design index.
const GENERIC_COMPONENT_REUSE_FALLBACK_TAGS: Record<string, string[]> = {
  'content-panel': ['Card', 'Panel', 'Paper', 'Section'],
  'data-table': ['DataGrid', 'DataTable', 'Grid', 'List', 'Table'],
  filters: ['FilterBar', 'Input', 'SearchInput', 'Select'],
  'mass-actions': ['ActionBar', 'BulkActionBar', 'Button', 'IconButton', 'Toolbar'],
  'side-preview': ['Aside', 'DetailPanel', 'Drawer', 'PreviewPanel', 'SidePanel'],
};

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function roundReuseScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatReuseScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
