import {
  buildComponentSelectionMap,
  DESIGN_INDEX_PATHS,
  type ComponentDescriptionMapEntry,
  type ComponentGroupRecord,
  type ComponentSelectionMap,
  type ComponentUsageCard,
  type DesignIndexDiagnostic,
  type DesignIndexManifest,
  type IndexedComponentRecord,
  type ProjectAgentNote,
} from '@sber-designer/design-indexer';

import { loadProjectDesignIndex } from '../design-index';
import { readWorkspaceFile } from '../safe-fs';
import type { TaskRelevantComponentSelectionMap } from './component-pack';

interface ComponentPackIndexState {
  stale: boolean;
  manifest: DesignIndexManifest | null;
  descriptionMap: ComponentDescriptionMapEntry[];
  diagnostics: DesignIndexDiagnostic[];
  componentSelectionMap: ComponentSelectionMap | null;
}

export async function loadIndexState(workspaceRoot: string): Promise<ComponentPackIndexState> {
  try {
    const context = await loadProjectDesignIndex(workspaceRoot);
    return {
      stale: context.stale,
      manifest: context.manifest,
      descriptionMap: context.descriptionMap ?? [],
      diagnostics: context.diagnostics,
      componentSelectionMap: context.componentSelectionMap ?? null,
    };
  } catch {
    return {
      stale: false,
      manifest: null,
      descriptionMap: [],
      diagnostics: [],
      componentSelectionMap: null,
    };
  }
}

export function resolveComponentSelectionMap(input: {
  components: IndexedComponentRecord[];
  usageCards: ComponentUsageCard[];
  indexState: ComponentPackIndexState;
}): TaskRelevantComponentSelectionMap {
  const artifact = input.indexState.componentSelectionMap;
  const artifactMatchesIndex =
    artifact &&
    artifact.entries.length === input.components.length &&
    artifact.counts.indexed === input.components.length;
  const map = artifactMatchesIndex
    ? artifact
    : buildComponentSelectionMap({
        components: input.components,
        usageCards: input.usageCards,
        descriptionMap: input.indexState.descriptionMap,
        diagnostics: input.indexState.diagnostics,
        generatedAt: input.indexState.manifest?.generatedAt ?? 0,
        indexFingerprint: input.indexState.manifest?.fingerprint ?? '',
      });
  return {
    ...map,
    source: artifactMatchesIndex ? 'artifact' : 'derived',
    stale: input.indexState.stale,
  };
}

export async function readJsonl<T>(workspaceRoot: string, filePath: string): Promise<T[]> {
  let contents = '';
  try {
    contents = await readWorkspaceFile(workspaceRoot, filePath);
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

export async function readComponentGroups(workspaceRoot: string): Promise<ComponentGroupRecord[]> {
  let contents = '';
  try {
    contents = await readWorkspaceFile(workspaceRoot, DESIGN_INDEX_PATHS.componentGroups);
  } catch {
    return [];
  }
  try {
    const parsed = JSON.parse(contents) as { groups?: ComponentGroupRecord[] };
    return Array.isArray(parsed.groups) ? parsed.groups : [];
  } catch {
    return [];
  }
}

export function componentFamilyNamesByComponent(
  components: IndexedComponentRecord[],
  groups: ComponentGroupRecord[],
): Map<string, string[]> {
  const namesById = new Map(components.map((component) => [component.id, component.shortName]));
  const result = new Map<string, string[]>();
  for (const component of components) {
    const names = new Set([component.shortName]);
    for (const group of groups) {
      if (!group.componentIds.includes(component.id)) continue;
      for (const id of group.componentIds) {
        const name = namesById.get(id);
        if (name) names.add(name);
      }
    }
    result.set(
      component.id,
      Array.from(names).sort((a, b) => a.localeCompare(b)),
    );
  }
  return result;
}

export function groupComponentNotes(notes: ProjectAgentNote[]): Map<string, ProjectAgentNote[]> {
  const byComponent = new Map<string, ProjectAgentNote[]>();
  for (const note of notes) {
    if (note.targetType !== 'component' || !note.targetId) continue;
    const existing = byComponent.get(note.targetId) ?? [];
    existing.push(note);
    byComponent.set(note.targetId, existing);
  }
  return byComponent;
}

export function normalizeSearch(value: string): string {
  return value.toLowerCase().trim();
}
