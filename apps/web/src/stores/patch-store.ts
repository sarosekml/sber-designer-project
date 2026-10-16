import { create } from 'zustand';

/**
 * Tracks per-file `before`/`after` snapshots produced by recent
 * apply_patch responses (Phase 3.2). The CodeView reads this — when
 * the currently-viewed file has a recent diff, it swaps to a Monaco
 * DiffEditor so the user sees what the agent changed.
 *
 * Entries are dismissable per file. Auto-evict the oldest beyond a
 * cap to avoid unbounded memory if the agent edits many files.
 */

export interface PatchDiff {
  path: string;
  before: string;
  after: string;
  /** Epoch ms when the diff was recorded. */
  at: number;
  source?: 'agent' | 'visual';
}

const MAX_DIFFS = 32;

interface PatchStoreState {
  /** Map of workspace-relative path → most-recent diff for that file. */
  diffs: Record<string, PatchDiff>;
  recordDiffs: (entries: Omit<PatchDiff, 'at'>[]) => void;
  dismissDiff: (path: string) => void;
  reset: () => void;
}

export const usePatchStore = create<PatchStoreState>((set) => ({
  diffs: {},
  recordDiffs: (entries) =>
    set((s) => {
      const next: Record<string, PatchDiff> = { ...s.diffs };
      const at = Date.now();
      for (const e of entries) {
        next[e.path] = {
          path: e.path,
          before: e.before,
          after: e.after,
          at,
          ...(e.source ? { source: e.source } : {}),
        };
      }
      // Evict oldest if we're over the cap.
      const keys = Object.keys(next);
      if (keys.length > MAX_DIFFS) {
        const sorted = keys.sort((a, b) => next[a]!.at - next[b]!.at);
        for (const k of sorted.slice(0, keys.length - MAX_DIFFS)) delete next[k];
      }
      return { diffs: next };
    }),
  dismissDiff: (path) =>
    set((s) => {
      if (!(path in s.diffs)) return {};
      const next = { ...s.diffs };
      delete next[path];
      return { diffs: next };
    }),
  reset: () => set({ diffs: {} }),
}));
