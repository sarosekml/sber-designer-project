import { create } from 'zustand';

/**
 * Tracks the current sandbox session — the dev-server spawned by
 * services/sandbox for the project we're currently editing.
 *
 * Only one active session at a time. Phase 2 may allow multiple
 * (compare two pages side by side).
 */

export interface SandboxSessionInfo {
  id: string;
  workspacePath: string;
  port: number;
  status: 'starting' | 'ready' | 'failed' | 'stopped';
  previewUrl: string | null;
  errorMessage: string | null;
  logsTail?: string[];
  diagnostics?: {
    reason:
      | 'binary_missing'
      | 'dependencies_missing'
      | 'package_install_blocked'
      | 'script_failed'
      | 'ready_timeout';
    severity: 'warning' | 'error';
    message: string;
    command: string;
    evidence: string[];
    suggestedAction: string;
    registry?: string;
  } | null;
  startedAt: number;
  readyAt: number | null;
}

interface SandboxStoreState {
  /** Current session, or null when no project is connected. */
  session: SandboxSessionInfo | null;
  setSession: (session: SandboxSessionInfo | null) => void;

  /** Last error from the controller, surfaced in the Connect dialog. */
  lastError: string | null;
  setLastError: (error: string | null) => void;
}

export const useSandboxStore = create<SandboxStoreState>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
  lastError: null,
  setLastError: (lastError) => set({ lastError }),
}));
