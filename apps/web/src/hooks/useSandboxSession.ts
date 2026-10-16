import { useCallback, useEffect } from 'react';

import { apiBaseUrl, authHeaders, safeJson, withSignal } from '@/lib/api-client';
import { useSandboxStore, type SandboxSessionInfo } from '@/stores/sandbox-store';

/**
 * Talks to services/sandbox **through services/api** (`/api/sandbox/*`).
 * Phase 1.8 closed the direct browser-to-controller channel so every
 * outgoing request goes through one auth-bounded edge. ADR-0009.
 *
 * Exposes:
 *   - createSession(workspacePath) → POST /api/sandbox/sessions
 *   - stopSession()                → DELETE /api/sandbox/sessions/:id
 * Polls GET /api/sandbox/sessions/:id every 1s while a session is
 * "starting"; polling stops once the session reaches a terminal state.
 */

const SANDBOX_PROXY = `${apiBaseUrl}/api/sandbox/sessions`;
const pendingSessions = new Map<string, Promise<SandboxSessionInfo | null>>();

export function useSandboxSession() {
  const session = useSandboxStore((s) => s.session);
  const setSession = useSandboxStore((s) => s.setSession);
  const setLastError = useSandboxStore((s) => s.setLastError);

  const createSession = useCallback(
    async (workspacePath: string, options: { force?: boolean } = {}) => {
      const existing = useSandboxStore.getState().session;
      if (options.force && existing?.workspacePath === workspacePath) {
        try {
          const response = await fetch(
            `${SANDBOX_PROXY}/${existing.id}`,
            withSignal({ method: 'DELETE', headers: authHeaders() }),
          );
          if (!response.ok) await safeJson(response);
        } catch {
          // Best-effort restart: still try to create a fresh session below.
        }
        setSession(null);
      }
      if (
        !options.force &&
        existing?.workspacePath === workspacePath &&
        (existing.status === 'starting' || existing.status === 'ready')
      ) {
        return existing;
      }
      const pending = options.force ? null : pendingSessions.get(workspacePath);
      if (pending) return pending;

      setLastError(null);
      const task = (async () => {
        const res = await fetch(
          SANDBOX_PROXY,
          withSignal({
            method: 'POST',
            headers: { 'content-type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ workspacePath }),
          }),
        );
        if (!res.ok) {
          const detail = await safeJson(res);
          const msg = detail?.detail ?? detail?.error ?? `HTTP ${res.status}`;
          setLastError(`Failed to create session: ${msg}`);
          return null;
        }
        const info = (await res.json()) as SandboxSessionInfo;
        setSession(info);
        return info;
      })();
      pendingSessions.set(workspacePath, task);
      try {
        return await task;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setLastError(`Cannot reach api at ${apiBaseUrl}. Is services/api running? ${msg}`);
        return null;
      } finally {
        pendingSessions.delete(workspacePath);
      }
    },
    [setSession, setLastError],
  );

  const stopSession = useCallback(async () => {
    const current = useSandboxStore.getState().session;
    if (!current) return;
    try {
      const response = await fetch(
        `${SANDBOX_PROXY}/${current.id}`,
        withSignal({ method: 'DELETE', headers: authHeaders() }),
      );
      if (!response.ok) await safeJson(response);
    } catch {
      // best-effort
    }
    setSession(null);
  }, [setSession]);

  // Poll until ready/failed/stopped.
  useEffect(() => {
    if (!session || session.status !== 'starting') return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(
          `${SANDBOX_PROXY}/${session.id}`,
          withSignal({ headers: authHeaders() }),
        );
        if (!res.ok) {
          await safeJson(res);
          return;
        }
        const next = (await res.json()) as SandboxSessionInfo;
        if (!cancelled) setSession(next);
      } catch {
        // network blip — try again on next interval.
      }
    };
    const handle = window.setInterval(tick, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [session, setSession]);

  return { session, createSession, stopSession };
}
