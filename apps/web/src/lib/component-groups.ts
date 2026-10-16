import type { ComponentEntry } from '@sber-designer/shared-types';

export interface ComponentGroup {
  name: string;
  components: ComponentEntry[];
}

export function groupCatalogComponents(components: readonly ComponentEntry[]): ComponentGroup[] {
  const groups = new Map<string, ComponentEntry[]>();
  const seenIds = new Set<string>();
  for (const component of components) {
    if (seenIds.has(component.id)) continue;
    seenIds.add(component.id);
    const groupName = component.title.split('/')[0]?.trim() || 'Components';
    groups.set(groupName, [...(groups.get(groupName) ?? []), component]);
  }
  return Array.from(groups.entries()).map(([name, entries]) => ({
    name,
    components: entries.sort((a, b) => a.shortName.localeCompare(b.shortName)),
  }));
}
