import { isHtmlDesignSystemCanonical } from '@sber-designer/shared-types';

import {
  DESIGN_INDEX_PATHS,
  type DesignIndexContext,
  type DesignIndexCounts,
  type ProjectSystemContextItem,
  type ProjectSystemFreshness,
  type ProjectSystemNextAction,
  type ProjectSystemOverview,
} from './types';

type OverviewInput = Omit<DesignIndexContext, 'projectSystem'>;

const EMPTY_COUNTS: DesignIndexCounts = {
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
  usageSnippets: 0,
  usageCards: 0,
  describedComponents: 0,
  patterns: 0,
  notes: 0,
  agentNotes: 0,
  diagnostics: 0,
};

export function buildProjectSystemOverview(context: OverviewInput): ProjectSystemOverview {
  const counts = normalizeCounts(context.manifest?.counts);
  const freshness = resolveFreshness(context);
  const warnings = context.diagnostics.filter((item) => item.level !== 'info').slice(0, 5);

  return {
    projectName: context.manifest?.projectName ?? null,
    status: context.status,
    freshness,
    nextAction: resolveNextAction(freshness),
    generatedAt: context.manifest?.generatedAt ?? null,
    summary: buildSummary(context),
    counts,
    ...(context.manifest?.quality ? { quality: context.manifest.quality } : {}),
    sources: context.manifest?.sources ?? null,
    ...(context.manifest?.projectProfile?.htmlDesignSystem
      ? { htmlDesignSystem: context.manifest.projectProfile.htmlDesignSystem }
      : {}),
    contextItems: buildContextItems(context, counts),
    warnings,
  };
}

function normalizeCounts(counts: Partial<DesignIndexCounts> | null | undefined): DesignIndexCounts {
  return { ...EMPTY_COUNTS, ...counts };
}

function resolveFreshness(context: OverviewInput): ProjectSystemFreshness {
  if (!context.manifest || context.status === 'missing') return 'missing';
  if (context.status === 'error') return 'error';
  if (context.stale || context.status === 'stale') return 'stale';
  if (context.status === 'warning') return 'needs-attention';
  return 'ready';
}

function resolveNextAction(freshness: ProjectSystemFreshness): ProjectSystemNextAction {
  if (freshness === 'missing') return 'index-project';
  if (freshness === 'stale') return 'reindex-project';
  if (freshness === 'error' || freshness === 'needs-attention') return 'review-diagnostics';
  return 'ready';
}

function buildSummary(context: OverviewInput): string {
  const promptSummary = compact(context.promptSummary, 420);
  if (promptSummary) return promptSummary;
  if (!context.manifest) {
    return 'Index the project to turn the connected repository into Project Design System context for Assistant.';
  }
  if (isHtmlCssProject(context)) {
    const htmlDesignSystem = context.manifest.projectProfile?.htmlDesignSystem;
    if (isHtmlDesignSystemCanonical(htmlDesignSystem?.status)) {
      return 'The canonical design-system package is indexed. Use its Design.md, CSS sources, reference pages, static screens, and HTML patterns before broad source scans.';
    }
    return htmlDesignSystem?.status === 'non-canonical'
      ? 'This HTML project needs restructuring before design-system authoring can write safely.'
      : 'HTML-first project is indexed without a design-system package. Add the canonical sources under design-system/ to establish it.';
  }
  return 'Project Design System context is indexed. Use component, token, icon, screen, route, example, and agent-note records before broad source scans.';
}

function buildContextItems(
  context: OverviewInput,
  counts: DesignIndexCounts,
): ProjectSystemContextItem[] {
  const missing = !context.manifest || context.status === 'missing';
  const htmlDesignSystem = context.manifest?.projectProfile?.htmlDesignSystem;
  const htmlCssProject = isHtmlCssProject(context);
  return [
    {
      id: 'components',
      label: htmlCssProject ? 'Design system' : 'Components',
      description: htmlCssProject
        ? 'HTML design-system package: Design.md, tokens.css, components.css, managed index.html, reference pages, and reusable CSS patterns.'
        : 'Indexed React components, Storybook stories, props hints, and usage tags.',
      count: counts.components,
      status: htmlCssProject
        ? missing
          ? 'missing'
          : isHtmlDesignSystemCanonical(htmlDesignSystem?.status)
            ? 'ready'
            : 'warning'
        : statusForRequiredCount(counts.components, missing),
      artifactPath: DESIGN_INDEX_PATHS.components,
    },
    {
      id: 'tokens',
      label: 'Tokens',
      description: 'Color, spacing, radius, typography, theme, and CSS variable records.',
      count: counts.tokens,
      status: missing ? 'missing' : counts.tokens > 0 ? 'ready' : 'warning',
      artifactPath: DESIGN_INDEX_PATHS.tokens,
    },
    {
      id: 'icons',
      label: 'Icons',
      description: context.manifest?.sources.lucideFallback
        ? 'Project iconName contracts, asset icons, project icon files, and controlled Lucide fallback vocabulary.'
        : 'Project icon records.',
      count: counts.iconCandidates || counts.icons,
      status: missing ? 'missing' : counts.iconCandidates || counts.icons ? 'ready' : 'empty',
      artifactPath: DESIGN_INDEX_PATHS.iconCandidates,
    },
    {
      id: 'assets',
      label: 'Assets',
      description:
        'Imported project icons, illustrations, image files, and Storybook asset gallery records.',
      count: counts.assets,
      status: statusForOptionalCount(counts.assets, missing),
      artifactPath: DESIGN_INDEX_PATHS.assets,
    },
    {
      id: 'screens',
      label: 'Screens',
      description: 'Known screen implementations, stories, and Design-readable status hints.',
      count: counts.screens,
      status: statusForOptionalCount(counts.screens, missing),
      artifactPath: DESIGN_INDEX_PATHS.screens,
    },
    {
      id: 'routes',
      label: 'Routes',
      description: 'Application routes discovered from the project.',
      count: counts.routes,
      status: statusForOptionalCount(counts.routes, missing),
      artifactPath: DESIGN_INDEX_PATHS.routes,
    },
    {
      id: 'examples',
      label: 'Examples',
      description: 'High-signal Storybook and description-layer usage examples.',
      count: counts.examples,
      status: statusForOptionalCount(counts.examples, missing),
      artifactPath: DESIGN_INDEX_PATHS.usageExamples,
    },
    {
      id: 'agent-notes',
      label: 'Agent notes',
      description: 'Project-specific guidance that Assistant should cite before code generation.',
      count: counts.agentNotes,
      status: statusForOptionalCount(counts.agentNotes, missing),
      artifactPath: DESIGN_INDEX_PATHS.agentNotes,
    },
  ];
}

function isHtmlCssProject(context: OverviewInput): boolean {
  return context.manifest?.projectProfile?.componentModel === 'css-catalog';
}

function statusForRequiredCount(
  count: number,
  missing: boolean,
): ProjectSystemContextItem['status'] {
  if (missing) return 'missing';
  return count > 0 ? 'ready' : 'warning';
}

function statusForOptionalCount(
  count: number,
  missing: boolean,
): ProjectSystemContextItem['status'] {
  if (missing) return 'missing';
  return count > 0 ? 'ready' : 'empty';
}

function compact(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}
