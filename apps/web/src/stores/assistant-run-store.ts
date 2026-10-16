import { create } from 'zustand';
import type { AssistantActiveRun } from '@sber-designer/shared-types';

export interface AssistantRunStoreState {
  runs: Record<string, AssistantActiveRun>;
  localCancel: Record<string, () => void>;
  upsertRun: (run: AssistantActiveRun) => void;
  replaceRun: (clientRunId: string, run: AssistantActiveRun) => void;
  updateRun: (clientRunId: string, patch: Partial<AssistantActiveRun>) => void;
  finishRun: (clientRunId: string, patch?: Partial<AssistantActiveRun>) => void;
  runsForScreen: (screenId: string | null | undefined) => AssistantActiveRun[];
  runForSession: (sessionId: string | null | undefined) => AssistantActiveRun | null;
  hasActiveRunForScreen: (screenId: string | null | undefined) => boolean;
  setLocalCancel: (clientRunId: string, cancel: (() => void) | null) => void;
  cancelLocal: (clientRunId: string) => boolean;
  reset: () => void;
}

let lastRunsSnapshot: AssistantRunStoreState['runs'] | null = null;
let lastRunsList: AssistantActiveRun[] = [];

export function selectAssistantRunsList(state: AssistantRunStoreState): AssistantActiveRun[] {
  if (state.runs === lastRunsSnapshot) return lastRunsList;
  lastRunsSnapshot = state.runs;
  lastRunsList = Object.values(state.runs);
  return lastRunsList;
}

export const useAssistantRunStore = create<AssistantRunStoreState>((set, get) => ({
  runs: {},
  localCancel: {},

  upsertRun: (run) =>
    set((state) => ({
      runs: {
        ...state.runs,
        [run.clientRunId]: run,
      },
    })),

  replaceRun: (clientRunId, run) =>
    set((state) => {
      const runs = { ...state.runs };
      delete runs[clientRunId];
      runs[run.clientRunId] = run;
      return { runs };
    }),

  updateRun: (clientRunId, patch) =>
    set((state) => {
      const run = state.runs[clientRunId];
      if (!run) return {};
      return {
        runs: {
          ...state.runs,
          [clientRunId]: {
            ...run,
            ...patch,
            updatedAt: patch.updatedAt ?? Date.now(),
          },
        },
      };
    }),

  finishRun: (clientRunId, patch = {}) =>
    set((state) => {
      const runs = { ...state.runs };
      delete runs[clientRunId];
      const localCancel = { ...state.localCancel };
      delete localCancel[clientRunId];
      void patch;
      return { runs, localCancel };
    }),

  runsForScreen: (screenId) => {
    if (!screenId) return [];
    return Object.values(get().runs)
      .filter((run) => run.screenId === screenId)
      .sort((a, b) => a.startedAt - b.startedAt);
  },

  runForSession: (sessionId) => {
    if (!sessionId) return null;
    return (
      Object.values(get().runs).find(
        (run) => run.sessionId === sessionId && isVisibleActiveRunStatus(run.status),
      ) ?? null
    );
  },

  hasActiveRunForScreen: (screenId) => get().runsForScreen(screenId).length > 0,

  setLocalCancel: (clientRunId, cancel) =>
    set((state) => {
      const localCancel = { ...state.localCancel };
      if (cancel) localCancel[clientRunId] = cancel;
      else delete localCancel[clientRunId];
      return { localCancel };
    }),

  cancelLocal: (clientRunId) => {
    const cancel = get().localCancel[clientRunId];
    if (!cancel) return false;
    cancel();
    return true;
  },

  reset: () => set({ runs: {}, localCancel: {} }),
}));

function isVisibleActiveRunStatus(status: AssistantActiveRun['status']): boolean {
  return status === 'queued' || status === 'running' || status === 'stopping';
}
