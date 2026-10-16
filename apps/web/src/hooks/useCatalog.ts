import { useCallback, useEffect } from 'react';

import { ApiError, fetchCatalog } from '@/lib/api-client';
import { useCatalogStore } from '@/stores/catalog-store';
import { useSandboxStore } from '@/stores/sandbox-store';

/**
 * Loads (and reloads) the component catalog whenever the active sandbox
 * session reaches `ready`. The api caches /index.json fetches with a
 * 30s TTL (Phase 1.5); pass `refresh: true` from the UI to bypass.
 *
 * No catalog without a connected project: the panel shows an empty-state
 * helper instead. Phase 1.5 also adds invalidate-on-canvasUrl-change on
 * the api side, so a fresh sandbox session always gets a fresh catalog.
 */
export function useCatalog(): { refresh: () => Promise<void> } {
  const session = useSandboxStore((s) => s.session);
  const previewUrl = session?.status === 'ready' ? session.previewUrl : null;

  const setCatalog = useCatalogStore((s) => s.setCatalog);
  const setLoading = useCatalogStore((s) => s.setLoading);
  const setError = useCatalogStore((s) => s.setError);
  const setRefresh = useCatalogStore((s) => s.setRefresh);

  const load = useCallback(
    async (refresh: boolean, signal?: AbortSignal) => {
      if (!previewUrl) return;
      setLoading(true);
      try {
        const catalog = await fetchCatalog({ previewUrl, refresh }, signal);
        setCatalog(catalog);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message =
          err instanceof ApiError
            ? `${err.code ?? 'error'}: ${err.message}`
            : err instanceof Error
              ? err.message
              : String(err);
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [previewUrl, setCatalog, setError, setLoading],
  );

  useEffect(() => {
    if (!previewUrl) {
      setCatalog(null);
      setError(null);
      return;
    }
    const ac = new AbortController();
    void load(false, ac.signal);
    return () => {
      ac.abort();
    };
  }, [previewUrl, setCatalog, setError, load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  // Publish refresh into the store so any view (e.g. ContextPanel) can
  // call it without re-running this hook.
  useEffect(() => {
    setRefresh(previewUrl ? refresh : null);
    return () => setRefresh(null);
  }, [previewUrl, refresh, setRefresh]);

  return { refresh };
}
