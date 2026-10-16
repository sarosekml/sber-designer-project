import { mkdir, mkdtemp, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { invalidateStorybookCache } from '../services/api/src/storybook-cache';

async function exists(path: string): Promise<boolean> {
  return stat(path)
    .then(() => true)
    .catch(() => false);
}

// A rename must purge stale builder/index caches (task 9999 LIVE-1) WITHOUT
// touching `<cacheKey>/public` — the running dev-server serves `iframe.html`
// from that directory on disk, and html-webpack-plugin never re-emits it, so
// deleting it bricks every screen with `Cannot GET /iframe.html` until the
// sandbox is restarted.
test('invalidateStorybookCache purges builder caches but spares the live dev output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-sbcache-'));
  const cache = join(root, 'node_modules/.cache/storybook');
  await mkdir(join(cache, 'default/dev-server'), { recursive: true });
  await writeFile(join(cache, 'default/dev-server/0.pack'), 'stale');
  await mkdir(join(cache, 'a1b2c3/public'), { recursive: true });
  await writeFile(join(cache, 'a1b2c3/public/iframe.html'), '<!doctype html>');
  await writeFile(join(cache, 'a1b2c3/public/main.iframe.bundle.js'), 'bundle');
  await mkdir(join(cache, 'a1b2c3/out'), { recursive: true });
  await writeFile(join(cache, 'a1b2c3/out/stats.json'), '{}');
  await writeFile(join(cache, 'stray-file'), 'x');

  expect(await invalidateStorybookCache(root)).toBe(true);

  expect(await exists(join(cache, 'default'))).toBe(false);
  expect(await exists(join(cache, 'a1b2c3/out'))).toBe(false);
  expect(await exists(join(cache, 'stray-file'))).toBe(false);
  expect(await exists(join(cache, 'a1b2c3/public/iframe.html'))).toBe(true);
  expect(await exists(join(cache, 'a1b2c3/public/main.iframe.bundle.js'))).toBe(true);
});

test('invalidateStorybookCache is a safe no-op when there is no cache dir', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-sbcache-empty-'));
  expect(await invalidateStorybookCache(root)).toBe(true);
});

test('invalidateStorybookCache handles a cache with only live output dirs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-sbcache-public-'));
  const cache = join(root, 'node_modules/.cache/storybook');
  await mkdir(join(cache, 'a1b2c3/public'), { recursive: true });
  await writeFile(join(cache, 'a1b2c3/public/iframe.html'), '<!doctype html>');

  expect(await invalidateStorybookCache(root)).toBe(true);
  expect(await exists(join(cache, 'a1b2c3/public/iframe.html'))).toBe(true);
});
