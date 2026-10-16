import { expect, test } from 'bun:test';
import type { ComponentCatalog, ProjectScreen } from '@sber-designer/shared-types';

import {
  buildGeneratedScreenMetadata,
  listScreenCreationFolders,
  moveProjectScreenToFolder,
  planProjectScreenFolderPushes,
  planStorybookScreenFolderRenames,
  renameProjectScreenNameReferences,
  renameProjectScreenFolderReferences,
  resolveScreenCreationFolder,
} from './screen-folders';

test('lists Ungrouped as the only creation folder for an empty project', () => {
  expect(listScreenCreationFolders([])).toEqual(['Ungrouped']);
});

test('lists Ungrouped once before existing folders in Screens panel order', () => {
  const screens: ProjectScreen[] = [
    {
      id: 'legacy',
      name: 'Legacy folderless',
      kind: 'story',
    },
    {
      id: 'explicit-ungrouped',
      name: 'Explicit ungrouped',
      kind: 'story',
      folder: 'Ungrouped',
    },
    {
      id: 'payments',
      name: 'Payments',
      kind: 'story',
      folder: 'Payments',
    },
    {
      id: 'risk',
      name: 'Risk',
      kind: 'story',
      folder: 'Risk',
    },
  ];

  expect(listScreenCreationFolders(screens)).toEqual(['Ungrouped', 'Payments', 'Risk']);
});

test('resolves first screen creation into Ungrouped or New folder without existing folders', () => {
  expect(
    resolveScreenCreationFolder({
      selectedValue: 'Ungrouped',
      existingFolders: listScreenCreationFolders([]),
    }),
  ).toBe('Ungrouped');

  expect(
    resolveScreenCreationFolder({
      selectedValue: '__new-folder__',
      existingFolders: listScreenCreationFolders([]),
    }),
  ).toBe('New folder');
});

test('resolves New folder to a unique readable name', () => {
  expect(
    resolveScreenCreationFolder({
      selectedValue: '__new-folder__',
      existingFolders: ['Ungrouped', 'New folder'],
    }),
  ).toBe('New folder 2');
});

test('falls back to the last valid folder or Ungrouped for stale selections', () => {
  expect(
    resolveScreenCreationFolder({
      selectedValue: 'Missing',
      existingFolders: ['Ungrouped', 'Payments'],
      fallbackFolder: 'Payments',
    }),
  ).toBe('Payments');

  expect(
    resolveScreenCreationFolder({
      selectedValue: 'Missing',
      existingFolders: ['Ungrouped', 'Payments'],
      fallbackFolder: 'Deleted',
    }),
  ).toBe('Ungrouped');
});

test('builds generated screen metadata in the physical Ungrouped folder', () => {
  expect(buildGeneratedScreenMetadata({ name: 'Risk', folder: 'Ungrouped' })).toEqual({
    cleanName: 'Risk',
    componentName: 'Risk',
    exportName: 'Default',
    filePath: 'src/stories/screens/Ungrouped/Risk.stories.tsx',
    folder: 'Ungrouped',
    implementationFilePath: 'src/screens/Ungrouped/Risk.tsx',
    screenSlug: 'risk',
    storyId: 'screens-ungrouped-risk--default',
    storyTitle: 'Screens/Ungrouped/Risk',
  });
});

test('builds first New folder metadata without requiring existing Storybook screens', () => {
  expect(buildGeneratedScreenMetadata({ name: 'Risk', folder: 'New folder' })).toMatchObject({
    filePath: 'src/stories/screens/New folder/Risk.stories.tsx',
    folder: 'New folder',
    implementationFilePath: 'src/screens/New folder/Risk.tsx',
    storyId: 'screens-new-folder-risk--default',
    storyTitle: 'Screens/New folder/Risk',
  });
});

test('plans filesystem rename when Storybook title moves a screen folder', () => {
  const screens: ProjectScreen[] = [
    {
      id: 'screen-risk',
      name: 'Risk metrics',
      kind: 'story',
      storyId: 'screens-2026-05-29-risk-metrics--default',
      filePath: 'src/stories/screens/2026-05-29/RiskMetrics.stories.tsx',
      implementationFilePath: 'src/screens/2026-05-29/RiskMetrics.tsx',
      folder: '2026-05-29',
    },
  ];
  const catalog = storybookCatalog({
    title: 'Screens/Payments/Risk metrics',
    filePath: 'src/stories/screens/2026-05-29/RiskMetrics.stories.tsx',
    storyId: 'screens-payments-risk-metrics--default',
  });

  expect(planStorybookScreenFolderRenames(screens, catalog)).toEqual([
    {
      from: '2026-05-29',
      to: 'Payments',
      reason: 'storybook-title',
    },
  ]);
});

test('plans Storybook retitle when filesystem folder moves first', () => {
  const screens: ProjectScreen[] = [
    {
      id: 'screen-risk',
      name: 'Risk metrics',
      kind: 'story',
      storyId: 'screens-2026-05-29-risk-metrics--default',
      filePath: 'src/stories/screens/2026-05-29/RiskMetrics.stories.tsx',
      implementationFilePath: 'src/screens/2026-05-29/RiskMetrics.tsx',
      folder: '2026-05-29',
    },
  ];
  const catalog = storybookCatalog({
    title: 'Screens/2026-05-29/Risk metrics',
    filePath: 'src/stories/screens/Payments/RiskMetrics.stories.tsx',
    storyId: 'screens-2026-05-29-risk-metrics--default',
  });

  expect(planStorybookScreenFolderRenames(screens, catalog)).toEqual([
    {
      from: '2026-05-29',
      to: 'Payments',
      reason: 'filesystem-path',
    },
  ]);
});

test('renames project screen folder references used by canvas and save state', () => {
  expect(
    renameProjectScreenFolderReferences(
      {
        id: 'screen-risk',
        name: 'Risk metrics',
        kind: 'story',
        storyId: 'screens-2026-05-29-risk-metrics--default',
        filePath: 'src/stories/screens/2026-05-29/RiskMetrics.stories.tsx',
        implementationFilePath: 'src/screens/2026-05-29/RiskMetrics.tsx',
        folder: '2026-05-29',
      },
      '2026-05-29',
      'Payments',
    ),
  ).toMatchObject({
    storyId: 'screens-payments-risk-metrics--default',
    filePath: 'src/stories/screens/Payments/RiskMetrics.stories.tsx',
    implementationFilePath: 'src/screens/Payments/RiskMetrics.tsx',
    folder: 'Payments',
  });
});

test('renames project screen file references from the display name', () => {
  expect(
    renameProjectScreenNameReferences(
      {
        id: 'screen-risk',
        name: 'New screen',
        kind: 'story',
        storyId: 'screens-2026-05-29-new-screen-mpfcd493--default',
        filePath: 'src/stories/screens/2026-05-29/NewScreenmpfcd493.stories.tsx',
        implementationFilePath: 'src/screens/2026-05-29/NewScreenmpfcd493.tsx',
        folder: '2026-05-29',
      },
      'Risk metrics',
    ),
  ).toMatchObject({
    name: 'Risk metrics',
    storyId: 'screens-2026-05-29-risk-metrics--default',
    filePath: 'src/stories/screens/2026-05-29/RiskMetrics.stories.tsx',
    implementationFilePath: 'src/screens/2026-05-29/RiskMetrics.tsx',
  });
});

test('moveProjectScreenToFolder rewrites folder, paths and storyId from the on-disk folder', () => {
  const screen: ProjectScreen = {
    id: 's1',
    name: 'Administration codex img',
    kind: 'story',
    storyId: 'screens-2026-05-31-administration-codex-img--default',
    filePath: 'src/stories/screens/2026-05-31/AdministrationCodexImg.stories.tsx',
    implementationFilePath: 'src/screens/2026-05-31/AdministrationCodexImg.tsx',
    folder: '2026-05-31',
  };

  expect(moveProjectScreenToFolder(screen, 'DeepseekV4Flash')).toEqual({
    id: 's1',
    name: 'Administration codex img',
    kind: 'story',
    storyId: 'screens-deepseekv4flash-administration-codex-img--default',
    filePath: 'src/stories/screens/DeepseekV4Flash/AdministrationCodexImg.stories.tsx',
    implementationFilePath: 'src/screens/DeepseekV4Flash/AdministrationCodexImg.tsx',
    folder: 'DeepseekV4Flash',
  });
});

test('planProjectScreenFolderPushes finds generated screens whose folder diverged from disk', () => {
  const screens: ProjectScreen[] = [
    // Diverged: panel folder changed by a metadata-only move, files still on date path.
    {
      id: 'moved',
      name: 'Administration codex img',
      kind: 'story',
      storyId: 'screens-2026-05-31-administration-codex-img--default',
      filePath: 'src/stories/screens/2026-05-31/AdministrationCodexImg.stories.tsx',
      implementationFilePath: 'src/screens/2026-05-31/AdministrationCodexImg.tsx',
      folder: 'DeepseekV4Flash',
    },
    // Consistent: panel folder matches the on-disk folder.
    {
      id: 'consistent',
      name: 'Risk',
      kind: 'story',
      filePath: 'src/stories/screens/Payments/Risk.stories.tsx',
      folder: 'Payments',
    },
    // Pinned original story (no generated path): folder is panel-only, never pushed.
    {
      id: 'pinned',
      name: 'Button',
      kind: 'story',
      storyId: 'atoms-button--primary',
      folder: 'DeepseekV4Flash',
    },
  ];

  expect(planProjectScreenFolderPushes(screens)).toEqual([
    {
      screenId: 'moved',
      storyFilePath: 'src/stories/screens/2026-05-31/AdministrationCodexImg.stories.tsx',
      implementationFilePath: 'src/screens/2026-05-31/AdministrationCodexImg.tsx',
      fromFolder: '2026-05-31',
      toFolder: 'DeepseekV4Flash',
    },
  ]);
});

function storybookCatalog(input: {
  title: string;
  filePath: string;
  storyId: string;
}): ComponentCatalog {
  return {
    source: 'storybook',
    generatedAt: 1,
    previewUrl: 'http://localhost:6006',
    components: [
      {
        id: 'screen',
        title: input.title,
        shortName: 'Risk metrics',
        filePath: input.filePath,
        stories: [
          {
            id: input.storyId,
            name: 'Default',
            previewUrl: 'http://localhost:6006/iframe.html',
          },
        ],
      },
    ],
  };
}
