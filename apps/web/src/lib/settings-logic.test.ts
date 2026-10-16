import { expect, test } from 'bun:test';

import {
  ASSET_PACK_SOURCE_HINT,
  DEFAULT_ICON_SOURCE_NAME,
  ICON_SOURCE_HINT,
  ASSET_PACK_OUTSIDE_WORKSPACE_WARNING,
  SETTINGS_SECTION_IDS,
  SYSTEM_SETTINGS_SECTION_IDS,
  resolveIconSourceMode,
  resolveAssetFolderPickerInitialPath,
  resolveAssetPackSourceWarning,
  resolveInitialAssetsPathState,
  resolveInitialIconSourceState,
  resolveInitialAssetPackState,
  resolveNextExternalAssetSources,
  resolveNextAssetPackSettings,
  normalizeEnabledProviderIds,
  parseActiveModelSelectValue,
  resolveActiveAfterProviderEnablement,
} from './settings-logic';

test('settings sections start with General and expose global harness settings', () => {
  expect(SETTINGS_SECTION_IDS[0]).toBe('general');
  expect(SETTINGS_SECTION_IDS).toContain('generation');
  expect(SETTINGS_SECTION_IDS.indexOf('generation')).toBeGreaterThan(
    SETTINGS_SECTION_IDS.indexOf('agent'),
  );
  expect(SETTINGS_SECTION_IDS.indexOf('generation')).toBeLessThan(
    SETTINGS_SECTION_IDS.indexOf('project'),
  );
});

test('home system settings include the global harness and exclude project sections', () => {
  expect(SYSTEM_SETTINGS_SECTION_IDS).toEqual([
    'general',
    'llm',
    'agent',
    'generation',
    'mcp',
    'about',
  ]);
  expect(SYSTEM_SETTINGS_SECTION_IDS).toContain('generation');
  expect(SYSTEM_SETTINGS_SECTION_IDS).not.toContain('project');
  expect(SYSTEM_SETTINGS_SECTION_IDS).not.toContain('indexing');
  expect(SYSTEM_SETTINGS_SECTION_IDS).not.toContain('git');
  expect(SYSTEM_SETTINGS_SECTION_IDS).not.toContain('tasks');
});

test('provider enablement normalization allows disabling every API provider', () => {
  expect(normalizeEnabledProviderIds([], ['providerA', 'providerB'])).toEqual([]);
  expect(normalizeEnabledProviderIds(['providerA', 'missing', 'providerA'], ['providerA'])).toEqual(
    ['providerA'],
  );
});

test('provider fallback waits until enabled providers are hydrated', () => {
  expect(
    resolveActiveAfterProviderEnablement({
      active: { provider: 'providerB', model: 'providerA/text-model' },
      configLoaded: false,
      enabledProviderIds: [],
      enabledProvidersReady: true,
      models: [],
    }),
  ).toBeUndefined();

  expect(
    resolveActiveAfterProviderEnablement({
      active: { provider: 'providerB', model: 'providerA/text-model' },
      configLoaded: true,
      enabledProviderIds: [],
      enabledProvidersReady: false,
      models: [],
    }),
  ).toBeUndefined();

  expect(
    resolveActiveAfterProviderEnablement({
      active: { provider: 'providerB', model: 'providerA/text-model' },
      configLoaded: true,
      enabledProviderIds: [],
      enabledProvidersReady: true,
      models: [],
    }),
  ).toBe(null);
});

test('active model select value preserves model ids containing separators', () => {
  expect(parseActiveModelSelectValue('claude-code-runtime::sonnet')).toEqual({
    provider: 'claude-code-runtime',
    model: 'sonnet',
  });
  expect(parseActiveModelSelectValue('opencode-runtime::openrouter/deepseek:v4')).toEqual({
    provider: 'opencode-runtime',
    model: 'openrouter/deepseek:v4',
  });
  expect(parseActiveModelSelectValue('__no-active-model__')).toBe(null);
  expect(parseActiveModelSelectValue('broken')).toBe(null);
});

test('asset pack import copy explains local-only source folders', () => {
  expect(ASSET_PACK_SOURCE_HINT).toContain('Workspace folders are indexed in place');
  expect(ASSET_PACK_SOURCE_HINT).toContain('external folders are indexed as references');
});

test('icon source copy explains workspace and external indexing modes', () => {
  expect(ICON_SOURCE_HINT).toContain('Workspace folders are indexed in place');
  expect(ICON_SOURCE_HINT).toContain('external folders are indexed as references');
});

test('icon source mode follows whether the folder is inside the workspace', () => {
  expect(resolveIconSourceMode('/Users/me/project/src/shared/icons', '/Users/me/project')).toBe(
    'workspace',
  );
  expect(resolveIconSourceMode('/Users/me/icons', '/Users/me/project')).toBe('external');
  expect(resolveIconSourceMode('icons', '/Users/me/project')).toBe(null);
});

test('icon source settings preserve external paths but add workspace-relative paths in project', () => {
  expect(
    resolveNextExternalAssetSources({
      previous: undefined,
      sourcePath: '/Users/me/project/src/shared/icons',
      workspacePath: '/Users/me/project',
      families: ['icons', 'illustrations'],
      now: 1,
    }),
  ).toEqual({
    icons: [
      {
        id: 'source-icons-settings',
        name: 'Icons',
        kind: 'local-folder',
        mode: 'workspace',
        families: ['icons', 'illustrations'],
        localPath: '/Users/me/project/src/shared/icons',
        workspacePath: 'src/shared/icons',
        updatedAt: 1,
      },
    ],
  });

  expect(
    resolveNextExternalAssetSources({
      previous: undefined,
      sourcePath: '/Users/me/icon-packs/core',
      workspacePath: '/Users/me/project',
      now: 2,
    }),
  ).toEqual({
    icons: [
      {
        id: 'source-icons-settings',
        name: 'Core',
        kind: 'local-folder',
        mode: 'external',
        families: ['icons', 'illustrations'],
        localPath: '/Users/me/icon-packs/core',
        updatedAt: 2,
      },
    ],
  });
});

test('icon source state starts from saved project preferences', () => {
  expect(
    resolveInitialIconSourceState({
      icons: [
        {
          id: 'source-icons',
          name: 'Core icons',
          kind: 'local-folder',
          mode: 'external',
          families: ['illustrations'],
          localPath: '/Users/me/icons',
        },
      ],
    }),
  ).toEqual({
    sourcePath: '/Users/me/icons',
    name: 'Core icons',
    mode: 'external',
    kinds: ['illustrations'],
  });

  expect(resolveInitialIconSourceState(undefined)).toEqual({
    sourcePath: '',
    name: DEFAULT_ICON_SOURCE_NAME,
    mode: null,
    kinds: ['icons', 'illustrations'],
  });
});

test('single assets path state prefers saved indexed source before old import preferences', () => {
  expect(
    resolveInitialAssetsPathState({
      assetPacks: { localSourcePath: '/Users/me/project/old-pack', kinds: ['icons'] },
      externalAssetSources: {
        icons: [
          {
            id: 'source-icons',
            name: 'External icons',
            kind: 'local-folder',
            mode: 'external',
            families: ['icons', 'illustrations'],
            localPath: '/Users/me/icons',
          },
        ],
      },
    }),
  ).toEqual({
    sourcePath: '/Users/me/icons',
    kinds: ['icons', 'illustrations'],
    mode: 'external',
  });

  expect(
    resolveInitialAssetsPathState({
      assetPacks: undefined,
      externalAssetSources: {
        icons: [
          {
            id: 'source-icons',
            name: 'External illustrations',
            kind: 'local-folder',
            mode: 'external',
            families: ['illustrations'],
            localPath: '/Users/me/illustrations',
          },
        ],
      },
    }),
  ).toEqual({
    sourcePath: '/Users/me/illustrations',
    kinds: ['illustrations'],
    mode: 'external',
  });
});

test('asset pack source warns when the folder is outside the connected project', () => {
  expect(resolveAssetPackSourceWarning('/Users/me/project/icons-pack', '/Users/me/project')).toBe(
    null,
  );
  expect(
    resolveAssetPackSourceWarning('/Users/me/project/src/assets/icons', '/Users/me/project'),
  ).toBe(null);
  expect(resolveAssetPackSourceWarning('/Users/me/project', '/Users/me/project')).toBe(null);

  const warning = resolveAssetPackSourceWarning('/Users/me/assets/icons-pack', '/Users/me/project');
  expect(warning).toBe(ASSET_PACK_OUTSIDE_WORKSPACE_WARNING);
  expect(warning).toContain('Import copies files into src/assets');
  expect(warning).toContain('External folders can still be saved and indexed');
});

test('asset folder picker starts from the typed path before the workspace path', () => {
  expect(resolveAssetFolderPickerInitialPath('/Users/me/assets', '/Users/me/project')).toBe(
    '/Users/me/assets',
  );
  expect(resolveAssetFolderPickerInitialPath('  ', '/Users/me/project')).toBe('/Users/me/project');
  expect(
    resolveAssetFolderPickerInitialPath('https://example.com/icons', '/Users/me/project'),
  ).toBe('/Users/me/project');
  expect(resolveAssetFolderPickerInitialPath('', undefined)).toBeUndefined();
});

test('asset pack state starts from saved project preferences', () => {
  expect(
    resolveInitialAssetPackState({
      localSourcePath: '/Users/me/project/icons-pack',
      kinds: ['icons'],
      updatedAt: 1,
    }),
  ).toEqual({
    sourcePath: '/Users/me/project/icons-pack',
    kinds: ['icons'],
  });

  expect(resolveInitialAssetPackState(undefined)).toEqual({
    sourcePath: '',
    kinds: ['icons', 'illustrations'],
  });
});

test('asset pack settings never persist source folders outside the connected project', () => {
  expect(
    resolveNextAssetPackSettings({
      previous: undefined,
      sourcePath: '/Users/me/assets/icons-pack',
      workspacePath: '/Users/me/project',
      kinds: ['icons', 'illustrations'],
      now: 1,
    }),
  ).toBeUndefined();

  expect(
    resolveNextAssetPackSettings({
      previous: { localSourcePath: '/Users/me/project/icons-pack', kinds: ['icons'], updatedAt: 1 },
      sourcePath: '/Users/me/assets/icons-pack',
      workspacePath: '/Users/me/project',
      kinds: ['icons'],
      now: 2,
    }),
  ).toEqual({
    localSourcePath: '/Users/me/project/icons-pack',
    kinds: ['icons'],
    updatedAt: 2,
  });

  expect(
    resolveNextAssetPackSettings({
      previous: undefined,
      sourcePath: '/Users/me/project/icons-pack',
      workspacePath: '/Users/me/project',
      kinds: ['icons'],
      now: 3,
    }),
  ).toEqual({
    localSourcePath: '/Users/me/project/icons-pack',
    kinds: ['icons'],
    updatedAt: 3,
  });
});
