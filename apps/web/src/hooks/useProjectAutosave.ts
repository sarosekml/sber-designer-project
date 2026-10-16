import { useEffect } from 'react';
import type { SberDesignerProject } from '@sber-designer/shared-types';

import { saveProjectToApi } from '@/lib/api-client';
import { carryProjectRevision } from '@/lib/project-revision';
import { selectAssistantRunsList, useAssistantRunStore } from '@/stores/assistant-run-store';
import { mergeProjectAssistantByFreshness, useProjectStore } from '@/stores/project-store';

const AUTOSAVE_DELAY_MS = 800;

export function shouldAutosaveProjectChange(input: {
  project: unknown;
  baseline: string | null;
  saving: boolean;
  assistantRunActive?: boolean;
}): boolean {
  if (!input.project || input.saving || input.assistantRunActive) return false;
  return JSON.stringify(input.project) !== input.baseline;
}

export function mergeSavedProjectForAutosaveBaseline(input: {
  current: SberDesignerProject | null | undefined;
  saved: SberDesignerProject;
}): SberDesignerProject {
  return mergeProjectAssistantByFreshness(input.current, input.saved);
}

export function reconcileAutosaveSuccess(input: {
  current: SberDesignerProject | null | undefined;
  payloadSnapshot: string;
  saved: SberDesignerProject;
}): { project: SberDesignerProject; baseline: string; followUpRequired: boolean } {
  if (!input.current) {
    return {
      project: input.saved,
      baseline: JSON.stringify(input.saved),
      followUpRequired: false,
    };
  }

  const currentSnapshot = JSON.stringify(input.current);
  const mergedSavedProject = mergeSavedProjectForAutosaveBaseline({
    current: input.current,
    saved: input.saved,
  });
  const mergedSavedSnapshot = JSON.stringify(mergedSavedProject);

  if (currentSnapshot === input.payloadSnapshot) {
    return {
      project: mergedSavedProject,
      baseline: mergedSavedSnapshot,
      followUpRequired: false,
    };
  }

  const currentWithSavedMetadata: SberDesignerProject = {
    ...input.current,
    ...(input.saved.savedAt !== undefined ? { savedAt: input.saved.savedAt } : {}),
  };
  if (JSON.stringify(currentWithSavedMetadata) === mergedSavedSnapshot) {
    return {
      project: mergedSavedProject,
      baseline: mergedSavedSnapshot,
      followUpRequired: false,
    };
  }

  return {
    project: carryProjectRevision({ ...input.current }, input.saved),
    baseline: mergedSavedSnapshot,
    followUpRequired: true,
  };
}

export function useProjectAutosave(): void {
  const project = useProjectStore((state) => state.project);
  const baseline = useProjectStore((state) => state.baseline);
  const saving = useProjectStore((state) => state.saving);
  const saveError = useProjectStore((state) => state.saveError);
  const setSaving = useProjectStore((state) => state.setSaving);
  const setSaveError = useProjectStore((state) => state.setSaveError);
  const assistantRunActive = useAssistantRunStore((state) =>
    selectAssistantRunsList(state).some(
      (run) => run.status === 'queued' || run.status === 'running' || run.status === 'stopping',
    ),
  );

  useEffect(() => {
    if (saveError) return;
    if (!shouldAutosaveProjectChange({ project, baseline, saving, assistantRunActive })) return;

    const timer = window.setTimeout(() => {
      const latest = useProjectStore.getState().project;
      if (!latest) return;

      const payloadSnapshot = JSON.stringify(latest);
      setSaving(true);
      setSaveError(null);

      void saveProjectToApi(latest)
        .then((saved) => {
          const current = useProjectStore.getState().project;
          const reconciled = reconcileAutosaveSuccess({ current, payloadSnapshot, saved });
          useProjectStore.setState({
            project: reconciled.project,
            baseline: reconciled.baseline,
            saveError: null,
          });
        })
        .catch((err) => {
          setSaveError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => setSaving(false));
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [assistantRunActive, baseline, project, saving, saveError, setSaveError, setSaving]);
}
