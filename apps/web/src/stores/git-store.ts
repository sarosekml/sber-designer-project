import { create } from 'zustand';

import { getGitStatus, type GitStatusResponse } from '@/lib/api-client';

/**
 * Single source of truth for the connected project's Git status (task 0096).
 *
 * Before 0096 the TopBar, SendPrDialog and SettingsDialog each fetched
 * `/api/git/status` independently and drifted out of sync. Everything now
 * reads one `status` here and calls `refresh()` after a git mutation. The
 * lifecycle wiring (focus / interval / session changes) lives in
 * `useGitStatusSync`, mounted once by the editor shell.
 */
interface GitStoreState {
  status: GitStatusResponse | null;
  loading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  /**
   * Fetch fresh status. `silent` avoids the loading flicker on background
   * ticks; `refreshPr` asks the backend to re-check the PR state on the host
   * (task 0110 A7 — throttled by the caller to once per window focus).
   */
  refresh: (opts?: { silent?: boolean; refreshPr?: boolean }) => Promise<void>;
  /** Adopt a status returned inline by a git mutation (e.g. Send PR result). */
  setStatus: (status: GitStatusResponse | null) => void;
  reset: () => void;
}

// De-duplicate concurrent refreshes (status bar + dialog can both ask at once).
let inflight: Promise<void> | null = null;

export const useGitStore = create<GitStoreState>((set) => ({
  status: null,
  loading: false,
  error: null,
  lastFetchedAt: null,
  setStatus: (status) => set({ status, error: null, lastFetchedAt: Date.now() }),
  reset: () => {
    inflight = null;
    set({ status: null, loading: false, error: null, lastFetchedAt: null });
  },
  refresh: (opts) => {
    if (inflight) return inflight;
    if (!opts?.silent) set({ loading: true });
    inflight = (async () => {
      try {
        const status = await getGitStatus(opts?.refreshPr ? { refreshPr: true } : {});
        set({ status, error: null, loading: false, lastFetchedAt: Date.now() });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err), loading: false });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },
}));
