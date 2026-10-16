import { create } from 'zustand';
import type { SberDesignerProject } from '@sber-designer/shared-types';

import { mergeAssistantStateByFreshness } from '@/lib/assistant-sessions';

/**
 * Active .sdproj state (Phase 5.1).
 *
 * Loaded from /api/project on editor mount; saved via PUT on Save
 * button + auto-save (debounced) when dirty. We keep `lastSaved` for
 * the UI indicator and `dirty` derived from comparing serialized
 * baseline against current.
 */

interface ProjectStoreState {
  /** Currently loaded project. null until /api/project fetches once. */
  project: SberDesignerProject | null;
  /** Last saved serialized JSON — compared against current to detect dirty. */
  baseline: string | null;
  saving: boolean;
  loadError: string | null;
  saveError: string | null;

  setProject: (project: SberDesignerProject) => void;
  /** Replace entire project + reset baseline (used after a successful save). */
  setBaseline: (project: SberDesignerProject) => void;
  patch: (patch: Partial<SberDesignerProject>) => void;
  setSaving: (saving: boolean) => void;
  setLoadError: (error: string | null) => void;
  setSaveError: (error: string | null) => void;
}

export const useProjectStore = create<ProjectStoreState>((set) => ({
  project: null,
  baseline: null,
  saving: false,
  loadError: null,
  saveError: null,
  setProject: (project) => set({ project }),
  setBaseline: (project) =>
    set((state) => {
      const mergedProject = mergeProjectAssistantByFreshness(state.project, project);
      return {
        project: mergedProject,
        baseline: JSON.stringify(mergedProject),
        saveError: null,
      };
    }),
  patch: (p) => set((s) => (s.project ? { project: { ...s.project, ...p } } : {})),
  setSaving: (saving) => set({ saving }),
  setLoadError: (loadError) => set({ loadError }),
  setSaveError: (saveError) => set({ saveError }),
}));

export function mergeProjectAssistantByFreshness(
  localProject: SberDesignerProject | null | undefined,
  incomingProject: SberDesignerProject,
): SberDesignerProject {
  if (
    !localProject ||
    localProject.workspacePath !== incomingProject.workspacePath ||
    localProject.name !== incomingProject.name
  ) {
    return incomingProject;
  }
  const merged: SberDesignerProject = {
    ...incomingProject,
    assistant: mergeAssistantStateByFreshness({
      local: localProject.assistant,
      incoming: incomingProject.assistant,
    }),
  };
  if (localProject.screensPanel !== undefined) {
    merged.screensPanel = localProject.screensPanel;
  }
  return merged;
}

export function isProjectDirty(state: ProjectStoreState): boolean {
  if (!state.project) return false;
  return JSON.stringify(state.project) !== state.baseline;
}
