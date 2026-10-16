import { afterEach, expect, test } from 'bun:test';

import { setClientAuthMode } from './http';
import { fetchProjectArtworkBlob, isProjectArtworkUrl } from './project';

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  setClientAuthMode(null);
});

test('project artwork detection is scoped to the configured API endpoints', () => {
  expect(isProjectArtworkUrl('/api/projects/project-1/cover')).toBe(true);
  expect(isProjectArtworkUrl('http://localhost:3000/api/projects/project-1/thumbnail?v=1')).toBe(
    true,
  );
  expect(isProjectArtworkUrl('/api/projects/project-1')).toBe(false);
  expect(isProjectArtworkUrl('https://example.com/api/projects/project-1/cover')).toBe(false);
});

test('project artwork fetch attaches the OIDC bearer token before creating an image URL', async () => {
  (globalThis as { window?: unknown }).window = {
    localStorage: { getItem: (key: string) => (key === 'sd-oidc-token' ? 'cover-token' : null) },
  };
  setClientAuthMode('oidc');

  let requestInit: RequestInit | undefined;
  const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestInit = init;
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'image/webp' },
    });
  }) as typeof fetch;

  const blob = await fetchProjectArtworkBlob(
    'http://localhost:3000/api/projects/project-1/cover',
    undefined,
    fetcher,
  );

  expect(blob.type).toBe('image/webp');
  expect(requestInit?.credentials).toBe('include');
  expect((requestInit?.headers as Record<string, string>)?.authorization).toBe(
    'Bearer cover-token',
  );
});
