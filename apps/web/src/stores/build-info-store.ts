import { create } from 'zustand';

import { fetchBuildInfo, type BuildInfo } from '@/lib/api/version';

export type BuildInfoStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

interface BuildInfoStoreState {
  status: BuildInfoStatus;
  info: BuildInfo | null;
  /** Explanation for `unavailable` / `error`. */
  detail: string | null;
  /** Fetch /api/version once per page load; `force` re-reads it. */
  load: (options?: { force?: boolean }) => Promise<void>;
}

/**
 * The API snapshots BUILD_INFO.json at process start, so one read per page
 * load is enough for every surface that shows the version.
 */
export const useBuildInfoStore = create<BuildInfoStoreState>((set, get) => ({
  status: 'idle',
  info: null,
  detail: null,
  load: async ({ force = false } = {}) => {
    const { status } = get();
    if (status === 'loading') return;
    if (!force && status !== 'idle') return;
    set({ status: 'loading', detail: null });
    try {
      const result = await fetchBuildInfo();
      if (result.state === 'ready') {
        set({ status: 'ready', info: result.info, detail: null });
      } else {
        set({ status: 'unavailable', info: null, detail: result.detail });
      }
    } catch (error) {
      set({
        status: 'error',
        info: null,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  },
}));
