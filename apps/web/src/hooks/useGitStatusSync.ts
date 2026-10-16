import { useEffect } from 'react';

import { useGitStore } from '@/stores/git-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';

const POLL_INTERVAL_MS = 15_000;
const PR_REFRESH_THROTTLE_MS = 60_000;

/**
 * Drives the single Git status store (task 0096). Mount once in the editor
 * shell. Refreshes when the sandbox session or the project git session
 * changes, on window focus, and on a light interval while connected.
 */
export function useGitStatusSync(): void {
  const session = useSandboxStore((s) => s.session);
  const gitSession = useProjectStore((s) => s.project?.gitSession);
  const refresh = useGitStore((s) => s.refresh);
  const reset = useGitStore((s) => s.reset);

  // Session / git-session changes → (re)load or clear.
  useEffect(() => {
    if (!session) {
      reset();
      return;
    }
    void refresh();
  }, [session, gitSession, refresh, reset]);

  // Refresh when the window regains focus (e.g. after merging a PR elsewhere).
  // The PR-state re-check hits the host CLI, so throttle it to once per minute
  // (task 0110 A7); plain change refreshes still run every focus.
  useEffect(() => {
    if (!session) return;
    let lastPrRefresh = 0;
    const onFocus = () => {
      const now = Date.now();
      const refreshPr = now - lastPrRefresh > PR_REFRESH_THROTTLE_MS;
      if (refreshPr) lastPrRefresh = now;
      void refresh({ silent: true, refreshPr });
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [session, refresh]);

  // Light background poll while a project is connected.
  useEffect(() => {
    if (!session) return;
    const id = window.setInterval(() => void refresh({ silent: true }), POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [session, refresh]);
}
