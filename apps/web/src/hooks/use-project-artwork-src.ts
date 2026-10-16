import { useEffect, useState } from 'react';

import { fetchProjectArtworkBlob, isProjectArtworkUrl } from '@/lib/api/project';

interface ResolvedArtwork {
  source: string;
  objectUrl: string | null;
}

/**
 * Resolve project artwork through the authenticated API client.
 *
 * A plain <img> cannot attach the OIDC bearer token. Fetching the bytes first
 * also keeps the local and password profiles on the same code path; the
 * resulting object URL is revoked whenever the card changes or unmounts.
 */
export function useProjectArtworkSrc(source: string | null): string | null {
  const [resolved, setResolved] = useState<ResolvedArtwork | null>(null);
  const needsAuthenticatedFetch = Boolean(source && isProjectArtworkUrl(source));

  useEffect(() => {
    if (!source || !needsAuthenticatedFetch) {
      setResolved(null);
      return;
    }

    const controller = new AbortController();
    let objectUrl: string | null = null;
    void fetchProjectArtworkBlob(source, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setResolved({ source, objectUrl });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResolved({ source, objectUrl: null });
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [needsAuthenticatedFetch, source]);

  if (!source) return null;
  if (!needsAuthenticatedFetch) return source;
  return resolved?.source === source ? resolved.objectUrl : null;
}
