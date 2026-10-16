/**
 * Shared local CLI runtime inventory (0138 D4).
 *
 * One snapshot of `fetchAgentRuntimes` for Assistant, Settings and Annotate so
 * capability preflight never races a second in-flight request and never shows
 * two different capability snapshots at once. No new backend endpoint: the
 * loaders are injectable purely so tests can drive dedup/refresh without HTTP.
 */
import { create } from 'zustand';
import {
  fetchAgentRuntimes,
  refreshAgentRuntime,
  type AgentRuntimeKind,
  type AgentRuntimeStatus,
} from '@/lib/api/agent-runs';
import { AGENT_RUNTIMES_CHANGED_EVENT } from '@/lib/settings-events';

export interface AgentRuntimeInventoryState {
  statuses: AgentRuntimeStatus[];
  enabledKinds: AgentRuntimeKind[];
  loading: boolean;
  loaded: boolean;
  refreshing: boolean;
  error: string | null;
  /** Fetch once; concurrent callers share one request. Never rejects. */
  ensureLoaded: (signal?: AbortSignal) => Promise<void>;
  /** Forced inventory refetch (AGENT_RUNTIMES_CHANGED_EVENT, manual refresh). Never rejects. */
  reload: (signal?: AbortSignal) => Promise<void>;
  /** Settings "Refresh connected runtimes": re-probe every known runtime kind. */
  refreshConnectedRuntimes: () => Promise<void>;
  /** Replace or append one runtime after connect/disconnect/model selection. */
  updateRuntime: (runtime: AgentRuntimeStatus) => void;
  setError: (message: string | null) => void;
}

export type AgentRuntimesFetcher = typeof fetchAgentRuntimes;
export type AgentRuntimeRefresher = typeof refreshAgentRuntime;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function createAgentRuntimeInventoryStore(
  fetchRuntimes: AgentRuntimesFetcher = fetchAgentRuntimes,
  refreshRuntime: AgentRuntimeRefresher = refreshAgentRuntime,
) {
  let loadInFlight: Promise<void> | null = null;
  let reloadInFlight: Promise<void> | null = null;
  let refreshInFlight: Promise<void> | null = null;

  const runFetch = (signal?: AbortSignal) =>
    fetchRuntimes(signal)
      .then((response) => {
        loadInFlight = null;
        reloadInFlight = null;
        set({
          statuses: response.runtimes,
          enabledKinds: response.enabledKinds,
          loading: false,
          loaded: true,
          error: null,
        });
      })
      .catch((err: unknown) => {
        // An aborted signal belongs to a superseded caller (React strict-mode
        // remount): leave state alone so the follow-up request owns it.
        if (!signal?.aborted) {
          loadInFlight = null;
          reloadInFlight = null;
          set({ loading: false, error: errorMessage(err) });
        }
      });

  const useAgentRuntimeInventory = create<AgentRuntimeInventoryState>()((set, get) => ({
    statuses: [],
    enabledKinds: [],
    loading: false,
    loaded: false,
    refreshing: false,
    error: null,
    ensureLoaded: (signal) => {
      if (get().loaded) return Promise.resolve();
      if (loadInFlight || reloadInFlight) return (loadInFlight ?? reloadInFlight)!;
      set({ loading: true, error: null });
      loadInFlight = runFetch(signal);
      return loadInFlight;
    },
    reload: (signal) => {
      if (reloadInFlight) return reloadInFlight;
      if (loadInFlight) return loadInFlight;
      set({ loading: true, error: null });
      reloadInFlight = runFetch(signal);
      return reloadInFlight;
    },
    refreshConnectedRuntimes: () => {
      if (refreshInFlight) return refreshInFlight;
      const kinds = get().statuses.map((runtime) => runtime.kind);
      set({ refreshing: true, error: null });
      refreshInFlight = Promise.all(kinds.map((kind) => refreshRuntime(kind)))
        .then((responses) => {
          set({
            statuses: responses.map((response) => response.runtime),
            loaded: true,
            error: null,
          });
        })
        .catch((err: unknown) => {
          set({ error: errorMessage(err) });
        })
        .finally(() => {
          refreshInFlight = null;
          set({ refreshing: false });
        });
      return refreshInFlight;
    },
    updateRuntime: (runtime) =>
      set((state) => ({
        statuses: state.statuses.some((candidate) => candidate.kind === runtime.kind)
          ? state.statuses.map((candidate) =>
              candidate.kind === runtime.kind ? runtime : candidate,
            )
          : [...state.statuses, runtime],
      })),
    setError: (message) => set({ error: message }),
  }));

  function set(next: Partial<AgentRuntimeInventoryState>) {
    useAgentRuntimeInventory.setState(next);
  }

  return useAgentRuntimeInventory;
}

export const useAgentRuntimeInventory = createAgentRuntimeInventoryStore();

// Runtime rows already update the store directly; the event refetch catches
// changes that did not go through this tab (another window, server-side drift).
if (typeof window !== 'undefined') {
  window.addEventListener(AGENT_RUNTIMES_CHANGED_EVENT, () => {
    void useAgentRuntimeInventory.getState().reload();
  });
}
