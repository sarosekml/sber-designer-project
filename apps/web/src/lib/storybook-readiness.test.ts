import { afterEach, expect, test } from 'bun:test';
import type { ComponentCatalog } from '@sber-designer/shared-types';

import { ensureStorybookStoryReady } from './storybook-readiness';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function catalogWithStory(storyId?: string): ComponentCatalog {
  return {
    source: 'storybook',
    generatedAt: Date.now(),
    previewUrl: 'http://localhost:6006',
    components: [
      {
        id: 'screens-dcm2',
        title: 'Screens/2026-06-06/DCM2',
        shortName: 'DCM2',
        filePath: 'src/stories/screens/2026-06-06/DCM2.stories.tsx',
        stories: storyId
          ? [
              {
                id: storyId,
                name: 'Default',
                previewUrl: `http://localhost:6006/iframe.html?id=${storyId}`,
              },
            ]
          : [],
      },
    ],
  };
}

test('ensureStorybookStoryReady waits for catalog again after forced restart', async () => {
  const storyId = 'screens-2026-06-06-dcm2--default';
  const catalogs = [catalogWithStory(), catalogWithStory(storyId)];
  const seenCatalogs: ComponentCatalog[] = [];
  let fetchCount = 0;
  let restartCount = 0;

  globalThis.fetch = (async () => {
    const catalog = catalogs[Math.min(fetchCount, catalogs.length - 1)];
    fetchCount += 1;
    return new Response(JSON.stringify(catalog), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  const status = await ensureStorybookStoryReady({
    storyId,
    previewUrl: 'http://localhost:6006',
    workspacePath: '/workspace',
    delaysMs: [0],
    setCatalog: (catalog) => seenCatalogs.push(catalog),
    createSession: async () => {
      restartCount += 1;
    },
  });

  expect(status).toBe('restarted');
  expect(restartCount).toBe(1);
  expect(fetchCount).toBe(2);
  expect(seenCatalogs.at(-1)?.components[0]?.stories[0]?.id).toBe(storyId);
});
