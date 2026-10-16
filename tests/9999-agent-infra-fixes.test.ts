import { mkdir, mkdtemp, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  describeStorybookIndexError,
  STORYBOOK_STORY_READINESS_DELAYS_MS,
  waitForStorybookStoryIndexed,
} from '../services/api/src/agent-runtimes/storybook-render-probe';
import { isSelfReferentialPreviewUrl } from '../services/api/src/routes/preview';
import { invalidateStorybookCache } from '../services/api/src/storybook-cache';

// LIVE-1: a renamed story file strands Storybook's cache → index 500. The
// builder caches must be removed — but NOT `<cacheKey>/public`, which the
// running dev-server serves `iframe.html` from on disk (deleting it bricks
// every screen with `Cannot GET /iframe.html` until a sandbox restart; see
// tests/storybook-cache.test.ts).
test('invalidateStorybookCache removes stale builder caches on rename', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-sbcache-'));
  const builderCacheDir = join(root, 'node_modules/.cache/storybook/default/dev-server');
  await mkdir(builderCacheDir, { recursive: true });
  await writeFile(join(builderCacheDir, 'stories-screens-New-folder-NewScreen03.pack'), 'x');
  const liveOutputDir = join(root, 'node_modules/.cache/storybook/abc/public');
  await mkdir(liveOutputDir, { recursive: true });
  await writeFile(join(liveOutputDir, 'iframe.html'), '<!doctype html>');

  expect(await invalidateStorybookCache(root)).toBe(true);
  const builderCacheExists = await stat(join(root, 'node_modules/.cache/storybook/default'))
    .then(() => true)
    .catch(() => false);
  expect(builderCacheExists).toBe(false);
  const liveOutputExists = await stat(join(liveOutputDir, 'iframe.html'))
    .then(() => true)
    .catch(() => false);
  expect(liveOutputExists).toBe(true);
});

test('invalidateStorybookCache is a safe no-op when there is no cache', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-sbcache-empty-'));
  expect(await invalidateStorybookCache(root)).toBe(true);
});

// LIVE-2: canvasUrl must be a sandbox origin, never the proxy URL itself.
test('isSelfReferentialPreviewUrl detects proxy URLs vs sandbox origins', () => {
  expect(
    isSelfReferentialPreviewUrl('http://localhost:3000/api/preview/iframe.html?id=x--default'),
  ).toBe(true);
  expect(isSelfReferentialPreviewUrl('http://localhost:3000/api/preview')).toBe(true);
  expect(isSelfReferentialPreviewUrl('http://localhost:53691')).toBe(false);
  expect(isSelfReferentialPreviewUrl('http://localhost:53691/iframe.html?id=x--default')).toBe(
    false,
  );
  expect(isSelfReferentialPreviewUrl('not a url')).toBe(false);
});

// LIVE-1 surfacing: a 500 from a missing story file is named, not "HTTP 500".
test('describeStorybookIndexError names the missing story file on a 500', () => {
  const body =
    "Unable to index ./src/stories/screens/New folder/NewScreen03.stories.tsx:\n  Error: ENOENT: no such file or directory, open '/x/New folder/NewScreen03.stories.tsx'";
  const reason = describeStorybookIndexError(500, body);
  expect(reason).toContain('New folder/NewScreen03.stories.tsx');
  expect(reason).toMatch(/Restart Storybook/i);
  expect(describeStorybookIndexError(404, '')).toBe('Storybook index returned HTTP 404.');
});

test('waitForStorybookStoryIndexed accepts sandbox origin canvasUrl', async () => {
  const requested: string[] = [];
  const result = await waitForStorybookStoryIndexed({
    canvasUrl: 'http://localhost:6100',
    storyId: 'screens-admin--default',
    delaysMs: [0],
    fetchImpl: async (url) => {
      requested.push(String(url));
      return new Response(
        JSON.stringify({
          entries: {
            'screens-admin--default': { id: 'screens-admin--default', type: 'story' },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });

  expect(result.status).toBe('indexed');
  expect(requested[0]).toContain('http://localhost:6100/index.json');
});

test('default Storybook readiness backoff gives new stories enough time to index', () => {
  const totalWaitMs = STORYBOOK_STORY_READINESS_DELAYS_MS.reduce((sum, delay) => sum + delay, 0);
  expect(totalWaitMs).toBeGreaterThanOrEqual(15_000);
  expect(STORYBOOK_STORY_READINESS_DELAYS_MS[0]).toBe(0);
});
