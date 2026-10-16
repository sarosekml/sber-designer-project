import { expect, test } from 'bun:test';
import type { ProjectScreen } from '@sber-designer/shared-types';

import {
  buildDuplicateScreenName,
  buildGeneratedScreenDuplicate,
  buildStorybookScreenDuplicate,
  extractScreenComponentExportName,
} from '../apps/web/src/lib/screen-duplicate';

const generatedScreen: ProjectScreen = {
  id: 'screen-assets',
  name: 'Assets',
  kind: 'story',
  storyId: 'screens-2026-05-22-assets--default',
  filePath: 'src/stories/screens/2026-05-22/Assets.stories.tsx',
  implementationFilePath: 'src/screens/2026-05-22/Assets.tsx',
  folder: 'Portfolio',
  description: 'Main assets view',
  thumbnail: '/previews/assets.png',
  position: { x: 100, y: 200 },
};

const pinnedStorybookScreen: ProjectScreen = {
  id: 'screen-source-story',
  name: 'Source Story',
  kind: 'story',
  storyId: 'screens-source--default',
  filePath: 'src/components/Source.stories.tsx',
  folder: 'Portfolio',
  description: 'Pinned source story',
  thumbnail: '/previews/source.png',
  position: { x: 10, y: 20 },
};

test('buildDuplicateScreenName creates readable unique copy names', () => {
  expect(
    buildDuplicateScreenName('Assets', [
      generatedScreen,
      { ...generatedScreen, id: 'screen-assets-copy', name: 'Assets Copy' },
    ]),
  ).toBe('Assets Copy 2');

  expect(buildDuplicateScreenName('Assets Copy', [generatedScreen])).toBe('Assets Copy');
});

test('extractScreenComponentExportName reads common generated screen exports', () => {
  expect(extractScreenComponentExportName('export function AssetsScreen() { return null; }')).toBe(
    'AssetsScreen',
  );
  expect(extractScreenComponentExportName('export const AssetsScreen = () => null;')).toBe(
    'AssetsScreen',
  );
  expect(extractScreenComponentExportName('const Local = 1;')).toBeNull();
});

test('buildGeneratedScreenDuplicate keeps metadata but creates independent paths and offset position', () => {
  const duplicate = buildGeneratedScreenDuplicate({
    original: generatedScreen,
    screens: [generatedScreen],
    implementationContents: 'export function AssetsScreen() { return null; }',
    now: new Date('2026-05-22T10:00:00Z'),
    unique: 'abc123',
  });

  expect(duplicate.screen).toMatchObject({
    id: 'screen-abc123-assets-copy',
    name: 'Assets Copy',
    kind: 'story',
    folder: 'Portfolio',
    description: 'Main assets view',
    thumbnail: '/previews/assets.png',
    position: { x: 140, y: 240 },
  });
  expect(duplicate.screen.storyId).not.toBe(generatedScreen.storyId);
  expect(duplicate.screen.filePath).not.toBe(generatedScreen.filePath);
  expect(duplicate.screen.implementationFilePath).not.toBe(generatedScreen.implementationFilePath);
  expect(duplicate.files.map((file) => file.path)).toEqual([
    duplicate.screen.implementationFilePath,
    duplicate.screen.filePath,
  ]);
  expect(duplicate.files[0]?.contents).toContain('export function AssetsScreen');
  expect(duplicate.files[1]?.contents).toContain('import { AssetsScreen }');
});

test('buildStorybookScreenDuplicate materializes pinned Storybook stories into owned generated screens', () => {
  const duplicate = buildStorybookScreenDuplicate({
    original: pinnedStorybookScreen,
    screens: [pinnedStorybookScreen],
    sourceStoryFilePath: 'src/components/Source.stories.tsx',
    now: new Date('2026-05-22T10:00:00Z'),
    unique: 'story456',
  });

  expect(duplicate.screen).toMatchObject({
    id: 'screen-story456-source-story-copy',
    name: 'Source Story Copy',
    kind: 'story',
    folder: 'Portfolio',
    description: 'Pinned source story',
    thumbnail: '/previews/source.png',
    position: { x: 50, y: 60 },
  });
  expect(duplicate.screen.storyId).not.toBe(pinnedStorybookScreen.storyId);
  expect(duplicate.screen.filePath).toContain('src/stories/screens/');
  expect(duplicate.screen.implementationFilePath).toContain('src/screens/');
  expect(duplicate.files[0]?.contents).toContain('SourceStories');
  expect(duplicate.files[1]?.contents).toContain('SourceStoryCopy');
});
