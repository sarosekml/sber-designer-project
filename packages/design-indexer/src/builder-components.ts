/**
 * Component and usage records for the design index (0136 R12 — extracted from
 * builder.ts).
 *
 * Grouping rules, component records, groups and usage examples, plus the
 * small id/slug helpers they share.
 */
import {
  type BuildDesignIndexInput,
  type ComponentAgentNote,
  type ComponentGroupRecord,
  type IndexedComponentRecord,
  type UsageExampleRecord,
} from './types';

const COMPONENT_GROUP_RULES = [
  {
    id: 'tables-lists',
    name: 'Tables and lists',
    keywords: ['table', 'grid', 'list', 'row', 'cell'],
    guidance: 'Use for dense data, sortable lists, table pages and bulk actions.',
  },
  {
    id: 'forms-inputs',
    name: 'Forms and inputs',
    keywords: ['input', 'field', 'form', 'select', 'checkbox', 'radio', 'textarea', 'search'],
    guidance: 'Use for collecting data, filters and editable settings.',
  },
  {
    id: 'navigation',
    name: 'Navigation',
    keywords: ['nav', 'menu', 'breadcrumb', 'tab', 'sidebar', 'command'],
    guidance: 'Use for sidebars, breadcrumbs, tabs, menus and route surfaces.',
  },
  {
    id: 'actions',
    name: 'Actions',
    keywords: ['button', 'link', 'action', 'dropdown', 'toolbar'],
    guidance: 'Use for commands, primary actions and contextual controls.',
  },
  {
    id: 'status-feedback',
    name: 'Status and feedback',
    keywords: ['badge', 'status', 'alert', 'toast', 'progress', 'priority', 'empty'],
    guidance: 'Use for priorities, state badges, validation and async feedback.',
  },
  {
    id: 'layout-surfaces',
    name: 'Layout and surfaces',
    keywords: ['card', 'modal', 'dialog', 'drawer', 'sheet', 'panel', 'layout', 'page'],
    guidance: 'Use for page structure, panels, dialogs and repeated content surfaces.',
  },
  {
    id: 'data-visualization',
    name: 'Data visualization',
    keywords: ['chart', 'graph', 'metric', 'kpi', 'stat'],
    guidance: 'Use for metrics, trends, charts and analytical summaries.',
  },
] as const;

export function buildComponents(
  input: BuildDesignIndexInput,
  notes: ComponentAgentNote[],
  extraComponents: IndexedComponentRecord[] = [],
): IndexedComponentRecord[] {
  const noteCounts = new Map<string, number>();
  for (const note of notes)
    noteCounts.set(note.componentId, (noteCounts.get(note.componentId) ?? 0) + 1);

  const catalogComponents = (input.catalog?.components ?? [])
    .map((component) => {
      const text =
        `${component.id} ${component.title} ${component.shortName} ${component.filePath}`.toLowerCase();
      const groupIds = COMPONENT_GROUP_RULES.filter((rule) =>
        rule.keywords.some((keyword) => text.includes(keyword)),
      ).map((rule) => rule.id);
      return {
        id: component.id,
        title: component.title,
        shortName: component.shortName,
        filePath: component.filePath,
        storyCount: component.stories.length,
        stories: component.stories.map((story) => ({ id: story.id, name: story.name })),
        ...(component.description ? { description: component.description } : {}),
        ...(component.descriptionLayer ? { descriptionLayer: component.descriptionLayer } : {}),
        tags: Array.from(new Set([...kebabWords(component.id), ...kebabWords(component.title)])),
        groupIds: groupIds.length > 0 ? groupIds : ['layout-surfaces'],
        noteCount: noteCounts.get(component.id) ?? 0,
        confidence: component.descriptionLayer ? 'high' : component.description ? 'medium' : 'low',
      } satisfies IndexedComponentRecord;
    })
    .sort((a, b) => a.title.localeCompare(b.title));
  const indexedExtraComponents = extraComponents.map((component) => ({
    ...component,
    noteCount: noteCounts.get(component.id) ?? component.noteCount,
  }));
  return dedupeById([...catalogComponents, ...indexedExtraComponents]).sort((a, b) =>
    a.title.localeCompare(b.title),
  );
}

export function buildGroups(components: IndexedComponentRecord[]): ComponentGroupRecord[] {
  return COMPONENT_GROUP_RULES.map((rule) => ({
    id: rule.id,
    name: rule.name,
    guidance: rule.guidance,
    componentIds: components
      .filter((component) => component.groupIds.includes(rule.id))
      .map((component) => component.id),
  })).filter((group) => group.componentIds.length > 0);
}

export function buildUsageExamples(input: BuildDesignIndexInput): UsageExampleRecord[] {
  const examples: UsageExampleRecord[] = [];
  for (const component of input.catalog?.components ?? []) {
    for (const usage of component.descriptionLayer?.usage ?? []) {
      examples.push({
        id: `${component.id}:${slug(usage.title)}`,
        componentId: component.id,
        title: usage.title,
        when: usage.when,
        source: 'description-layer',
      });
    }
    for (const story of component.stories) {
      if (!story.descriptionLayer?.purpose && !story.description) continue;
      examples.push({
        id: `${component.id}:${story.id}`,
        componentId: component.id,
        title: story.name,
        when: story.descriptionLayer?.purpose ?? story.description ?? story.name,
        source: 'storybook',
      });
    }
  }
  return examples.sort((a, b) => a.id.localeCompare(b.id));
}

export function kebabWords(value: string): string[] {
  return value
    .split(/[^A-Za-z0-9]+/)
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);
}

export function slug(value: string): string {
  return kebabWords(value).join('-') || 'example';
}

export function dedupeById<T extends { id: string }>(records: T[]): T[] {
  return Array.from(new Map(records.map((record) => [record.id, record])).values());
}
