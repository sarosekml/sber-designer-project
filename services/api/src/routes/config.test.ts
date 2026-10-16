import { expect, test } from 'bun:test';
import { BUILTIN_DEFAULTS } from '@sber-designer/llm-gateway';

import { DEFAULT_SYSTEM_SETTINGS } from '../auth/types';
import { createConfigRouter } from './config';

test('config exposes and updates user-wide generation pipeline preferences', async () => {
  const updates: unknown[] = [];
  const coverUpdates: boolean[] = [];
  const router = createConfigRouter({
    loadConfig: async () => BUILTIN_DEFAULTS,
    readSystemSettings: async () => DEFAULT_SYSTEM_SETTINGS,
    authMode: () => 'local',
    readUserSettings: async () => ({
      version: 1,
      generationPipeline: {
        generationDefaults: { directionPicker: true, wireframe: false, designJury: false },
      },
      generativeThumbnailEnabled: false,
    }),
    updateUserGenerativeThumbnail: async (_identity, enabled) => {
      coverUpdates.push(enabled);
      return { version: 1, generativeThumbnailEnabled: enabled };
    },
    updateUserGenerationPipeline: async (_identity, generationPipeline) => {
      updates.push(generationPipeline);
      return { version: 1, generationPipeline };
    },
  });

  const initialResponse = await router.request('/');
  const initial = (await initialResponse.json()) as {
    preferences: {
      generationPipeline: { generationDefaults: { directionPicker: boolean } };
      generativeThumbnailEnabled: boolean;
    };
  };
  expect(initial.preferences.generationPipeline.generationDefaults.directionPicker).toBe(true);
  expect(initial.preferences.generativeThumbnailEnabled).toBe(false);

  const updateResponse = await router.request('/generation-pipeline', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      generationDefaults: { directionPicker: false, wireframe: true, designJury: true },
    }),
  });
  expect(updateResponse.status).toBe(200);
  expect(updates).toEqual([
    { generationDefaults: { directionPicker: false, wireframe: true, designJury: true } },
  ]);

  const coverUpdateResponse = await router.request('/generative-thumbnail', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: true }),
  });
  expect(coverUpdateResponse.status).toBe(200);
  expect(await coverUpdateResponse.json()).toEqual({ enabled: true });
  expect(coverUpdates).toEqual([true]);
});

test('config exposes an opaque server configRevision for result invalidation (review R4)', async () => {
  const router = createConfigRouter({
    loadConfig: async () => BUILTIN_DEFAULTS,
    readSystemSettings: async () => DEFAULT_SYSTEM_SETTINGS,
    authMode: () => 'local',
    readUserSettings: async () => ({ version: 1 }),
  });
  const response = await router.request('/');
  const body = (await response.json()) as { configRevision?: string; provider?: unknown };
  expect(typeof body.configRevision).toBe('string');
  expect(body.configRevision).toMatch(/^[0-9a-f]{16}$/u);
  // The revision is a whole-config hash — no provider option values leak.
  expect(JSON.stringify(body)).not.toContain('apiKey');
});
