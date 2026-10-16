import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import {
  localStorageIdentity,
  readUserSettings,
  updateUserGenerativeThumbnail,
  updateUserGenerationPipeline,
} from './user-storage';

const previousUsersRoot = process.env.SBER_DESIGNER_USERS_ROOT;
const temporaryRoots: string[] = [];

afterEach(async () => {
  if (previousUsersRoot === undefined) delete process.env.SBER_DESIGNER_USERS_ROOT;
  else process.env.SBER_DESIGNER_USERS_ROOT = previousUsersRoot;
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true })));
});

test('local mode persists generation pipeline preferences outside project files', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'sber-designer-user-settings-'));
  temporaryRoots.push(root);
  process.env.SBER_DESIGNER_USERS_ROOT = root;
  const identity = localStorageIdentity();

  await updateUserGenerationPipeline(identity, {
    generationDefaults: { directionPicker: true, wireframe: false, designJury: true },
  });
  await updateUserGenerationPipeline(identity, {
    screenReadiness: {
      enabled: true,
      profile: 'standard',
      categories: {
        sourceIntegrity: true,
        renderHealth: true,
        designSystemFit: true,
        dataHonesty: true,
        operationalUxStates: true,
        accessibilityBasics: true,
        responsiveVisualSanity: false,
        designModeCompatibility: false,
      },
    },
  });
  await updateUserGenerativeThumbnail(identity, false);

  const settings = await readUserSettings(identity);
  expect(settings.generationPipeline?.generationDefaults).toEqual({
    directionPicker: true,
    wireframe: false,
    designJury: true,
  });
  expect(settings.generationPipeline?.screenReadiness?.profile).toBe('standard');
  expect(settings.generativeThumbnailEnabled).toBe(false);
  expect(settings.activeWorkspace).toBeUndefined();
});
