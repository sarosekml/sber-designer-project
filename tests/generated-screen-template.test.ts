import { expect, test } from 'bun:test';

import {
  buildGeneratedScreenMetadata,
  buildStorybookTemplateCopy,
  buildStorybookTemplateImplementation,
  buildUniqueGeneratedScreenName,
  relativeImportPath,
  storyExportNameFromId,
  syncProjectScreensWithStorybook,
} from '../apps/web/src/lib/screen-folders';

test('builds folder metadata for a user-named generated screen without random suffixes', () => {
  const metadata = buildGeneratedScreenMetadata({
    name: 'Deal Page',
    folder: 'Ungrouped',
  });

  expect(metadata.cleanName).toBe('Deal Page');
  expect(metadata.folder).toBe('Ungrouped');
  expect(metadata.filePath).toBe('src/stories/screens/Ungrouped/DealPage.stories.tsx');
  expect(metadata.implementationFilePath).toBe('src/screens/Ungrouped/DealPage.tsx');
  expect(metadata.storyTitle).toBe('Screens/Ungrouped/Deal Page');
  expect(metadata.storyId).toBe('screens-ungrouped-deal-page--default');
});

test('uses Storybook-compatible ids for generated screen names', () => {
  const metadata = buildGeneratedScreenMetadata({
    name: 'Page · Main',
    folder: 'New folder',
  });

  expect(metadata.storyTitle).toBe('Screens/New folder/Page · Main');
  expect(metadata.storyId).toBe('screens-new-folder-page-·-main--default');
});

test('builds sequential readable names for blank generated screens', () => {
  expect(buildUniqueGeneratedScreenName('', [])).toBe('New screen 01');
  expect(buildUniqueGeneratedScreenName('New screen', [])).toBe('New screen 01');
  expect(
    buildUniqueGeneratedScreenName('New screen', [
      { name: 'New screen' },
      { name: 'New screen 01' },
      { name: 'New screen 02' },
    ]),
  ).toBe('New screen 03');
  expect(buildUniqueGeneratedScreenName('Administration-from-img', [])).toBe(
    'Administration-from-img',
  );
  expect(
    buildUniqueGeneratedScreenName('Administration-from-img', [
      { name: 'Administration-from-img' },
    ]),
  ).toBe('Administration-from-img 02');
});

test('derives a Storybook export name from a story id', () => {
  expect(storyExportNameFromId('templates-base-screen--sidebar-shell')).toBe('SidebarShell');
  expect(storyExportNameFromId('screens-demo--deal-page-screen')).toBe('DealPageScreen');
  expect(storyExportNameFromId('button--default')).toBe('Default');
});

test('builds browser-safe relative imports between story files', () => {
  expect(
    relativeImportPath(
      'src/stories/screens/2026-05-12/DealPage.stories.tsx',
      'src/stories/BaseScreenTemplate.stories.tsx',
    ),
  ).toBe('../../BaseScreenTemplate.stories');
});

test('creates a generated story that renders a Storybook template without mutating it', () => {
  const storySource = buildStorybookTemplateCopy({
    screenName: 'Deal Page',
    componentName: 'DealPage',
    storyTitle: 'Screens/2026-05-12/Deal Page',
    sourceStoryId: 'templates-base-screen--sidebar-shell',
    sourceFilePath: 'src/stories/BaseScreenTemplate.stories.tsx',
    targetFilePath: 'src/stories/screens/2026-05-12/DealPage.stories.tsx',
  });
  const implementationSource = buildStorybookTemplateImplementation({
    componentName: 'DealPage',
    sourceStoryId: 'templates-base-screen--sidebar-shell',
    sourceFilePath: 'src/stories/BaseScreenTemplate.stories.tsx',
    targetFilePath: 'src/screens/2026-05-12/DealPage.tsx',
  });

  expect(storySource).toContain("import type { Meta, StoryObj } from '@storybook/react';");
  expect(storySource).toContain("import { DealPage } from '../../../screens/2026-05-12/DealPage';");
  expect(storySource).toContain("title: 'Screens/2026-05-12/Deal Page'");
  expect(storySource).toContain('component: DealPage');
  expect(storySource).toContain("name: 'Deal Page'");
  expect(storySource).not.toContain("from '../pages/DealPage'");

  expect(implementationSource).toContain("import React from 'react';");
  expect(implementationSource).toContain(
    "import * as SourceStories from '../../stories/BaseScreenTemplate.stories';",
  );
  expect(implementationSource).toContain('const sourceStory = SourceStories.SidebarShell');
  expect(implementationSource).toContain('const SourceComponent = sourceMeta.component');
  expect(implementationSource).toContain(
    'return SourceComponent ? <SourceComponent {...sourceArgs} /> : null;',
  );
});

test('repairs generated screen story ids by matching Storybook file paths', () => {
  const result = syncProjectScreensWithStorybook(
    [
      {
        id: 'screen-old-generated',
        name: 'Page · Main',
        kind: 'story',
        storyId: 'screens-2026-05-14-page-main-mp5x9l6q--default',
        filePath: 'src/stories/screens/2026-05-14/PageMainmp5x9l6q.stories.tsx',
        folder: '2026-05-14',
      },
    ],
    {
      source: 'storybook',
      generatedAt: 1,
      components: [
        {
          id: 'screens-2026-05-14-page-·-main-mp5x9l6q',
          title: 'Screens/2026-05-14/Page · Main mp5x9l6q',
          shortName: 'Page · Main mp5x9l6q',
          filePath: 'src/stories/screens/2026-05-14/PageMainmp5x9l6q.stories.tsx',
          stories: [
            {
              id: 'screens-2026-05-14-page-·-main-mp5x9l6q--default',
              name: 'Page · Main',
              previewUrl: '#',
            },
          ],
        },
      ],
    },
  );

  expect(result.changed).toBe(true);
  expect(result.added).toBe(0);
  expect(result.repaired).toBe(1);
  expect(result.screens).toHaveLength(1);
  expect(result.screens[0]?.storyId).toBe('screens-2026-05-14-page-·-main-mp5x9l6q--default');
});

test('syncs project screen folders from Storybook screen stories', () => {
  const result = syncProjectScreensWithStorybook(
    [
      {
        id: 'screen-deal',
        name: 'Deal Page',
        kind: 'story',
        storyId: 'screens-demo--deal-page',
        folder: '2026-05-10',
      },
      {
        id: 'screen-template',
        name: 'Base Screen',
        kind: 'story',
        storyId: 'templates-base-screen--sidebar-shell',
      },
    ],
    {
      source: 'storybook',
      generatedAt: 1,
      components: [
        {
          id: 'screens-demo',
          title: 'Screens/Demo',
          shortName: 'Demo',
          filePath: 'src/stories/Screens.stories.tsx',
          stories: [{ id: 'screens-demo--deal-page', name: 'Deal Page', previewUrl: '#' }],
        },
        {
          id: 'screens-2026-05-10-generated',
          title: 'Screens/2026-05-10/Generated Dashboard Usage Layer QA',
          shortName: 'Generated Dashboard Usage Layer QA',
          filePath: 'src/stories/screens/2026-05-10/Generated.stories.tsx',
          stories: [
            {
              id: 'screens-2026-05-10-generated-dashboard-usage-layer-qa--default',
              name: 'Default',
              previewUrl: '#',
            },
          ],
        },
        {
          id: 'templates-base-screen',
          title: 'Templates/Base Screen',
          shortName: 'Base Screen',
          filePath: 'src/stories/BaseScreenTemplate.stories.tsx',
          stories: [
            {
              id: 'templates-base-screen--sidebar-shell',
              name: 'Sidebar Shell',
              previewUrl: '#',
            },
          ],
        },
      ],
    },
  );

  expect(result.changed).toBe(true);
  expect(result.moved).toBe(1);
  expect(result.added).toBe(1);
  expect(result.screens.find((screen) => screen.id === 'screen-deal')?.folder).toBe('Demo');
  expect(result.screens.find((screen) => screen.id === 'screen-template')?.folder).toBeUndefined();
  expect(
    result.screens.find(
      (screen) =>
        screen.storyId === 'screens-2026-05-10-generated-dashboard-usage-layer-qa--default',
    ),
  ).toMatchObject({
    name: 'Generated Dashboard Usage Layer QA',
    filePath: 'src/stories/screens/2026-05-10/Generated.stories.tsx',
    folder: '2026-05-10',
  });
});
