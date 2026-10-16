import { create } from 'zustand';
import type { ProjectTask } from '@sber-designer/shared-types';

import { fetchTasks } from '@/lib/api-client';

export type TaskContextMode = 'all' | 'none' | 'custom';

interface TasksStoreState {
  tasks: ProjectTask[];
  loading: boolean;
  error: string | null;
  lastSyncedAt: number | null;
  taskContextMode: TaskContextMode;
  taskContextIds: string[];
  sync: () => Promise<void>;
  setTaskContextMode: (mode: TaskContextMode) => void;
  setTaskContextIds: (ids: string[]) => void;
}

export const useTasksStore = create<TasksStoreState>((set) => ({
  tasks: [],
  loading: false,
  error: null,
  lastSyncedAt: null,
  taskContextMode: 'all',
  taskContextIds: [],

  sync: async () => {
    set({ loading: true, error: null });
    try {
      const tasks = await fetchTasks();
      set({ tasks, loading: false, lastSyncedAt: Date.now() });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  setTaskContextMode: (taskContextMode) => set({ taskContextMode }),
  setTaskContextIds: (taskContextIds) => set({ taskContextIds }),
}));

export function tasksForScreen(tasks: ProjectTask[], screenId: string | null | undefined) {
  if (!screenId) return [];
  return tasks.filter((task) => task.screenIds.includes(screenId));
}

export function resolveTaskContext(
  tasks: ProjectTask[],
  screenId: string | null | undefined,
  mode: TaskContextMode,
  ids: string[],
) {
  const activeTasks = tasksForScreen(tasks, screenId);
  if (mode === 'none') return [];
  if (mode === 'all') return activeTasks;
  const idSet = new Set(ids);
  return activeTasks.filter((task) => idSet.has(task.id));
}
