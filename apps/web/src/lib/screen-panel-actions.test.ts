import { expect, test } from 'bun:test';
import type { ProjectScreen } from '@sber-designer/shared-types';

import {
  applyFileRenamePlansToScreens,
  applyFolderRenamePlansToScreens,
  applyFolderPushPlansToScreens,
  catalogStories,
  describeScreenMoveError,
  insertScreenAfter,
  isGeneratedScreenStoryFile,
  storySourceFilePath,
  withProjectScreenCreationFolder,
  withScreenFolder,
  withScreenRenameResult,
} from './screen-panel-actions';

const screen = (overrides: Partial<ProjectScreen> & { id: string }): ProjectScreen => ({
  name: overrides.id,
  kind: 'story',
  ...overrides,
});

test('insertScreenAfter places the screen right after the anchor', () => {
  const list = [screen({ id: 'a' }), screen({ id: 'b' })];
  const next = insertScreenAfter(list, 'a', screen({ id: 'x' }));
  expect(next.map((s) => s.id)).toEqual(['a', 'x', 'b']);
});

test('insertScreenAfter appends when the anchor is missing', () => {
  const list = [screen({ id: 'a' })];
  const next = insertScreenAfter(list, 'missing', screen({ id: 'x' }));
  expect(next.map((s) => s.id)).toEqual(['a', 'x']);
});

test('withScreenFolder normalizes the folder name', () => {
  expect(withScreenFolder(screen({ id: 'a' }), '  Payments ').folder).toBe('Payments');
  expect(withScreenFolder(screen({ id: 'a' }), '   ').folder).toBe('Ungrouped');
});

test('withProjectScreenCreationFolder stores the normalized last folder', () => {
  const project = withProjectScreenCreationFolder({ screenCreation: undefined }, ' Risk ');
  expect(project.screenCreation?.lastFolder).toBe('Risk');
});

test('applyFolderPushPlansToScreens rewrites folder, paths and storyId per plan', () => {
  const diverged = screen({
    id: 'moved',
    storyId: 'screens-2026-05-31-administration--default',
    filePath: 'src/stories/screens/2026-05-31/Administration.stories.tsx',
    implementationFilePath: 'src/screens/2026-05-31/Administration.tsx',
    folder: 'DeepseekV4Flash',
  });
  const untouched = screen({ id: 'other', folder: 'Payments' });
  const next = applyFolderPushPlansToScreens(
    [diverged, untouched],
    [{ screenId: 'moved', toFolder: 'DeepseekV4Flash' }],
  );
  expect(next[0]).toEqual({
    ...diverged,
    storyId: 'screens-deepseekv4flash-administration--default',
    filePath: 'src/stories/screens/DeepseekV4Flash/Administration.stories.tsx',
    implementationFilePath: 'src/screens/DeepseekV4Flash/Administration.tsx',
  });
  expect(next[1]).toBe(untouched);
});

test('applyFolderRenamePlansToScreens rewrites generated paths even when the panel folder already changed', () => {
  const diverged = screen({
    id: 'moved',
    storyId: 'screens-old-folder-checkout--default',
    filePath: 'src/stories/screens/Old Folder/Checkout.stories.tsx',
    implementationFilePath: 'src/screens/Old Folder/Checkout.tsx',
    folder: 'New Folder',
  });
  const untouched = screen({ id: 'other', folder: 'Marketing' });

  const next = applyFolderRenamePlansToScreens(
    [diverged, untouched],
    [{ from: 'Old Folder', to: 'New Folder' }],
  );

  expect(next[0]).toEqual({
    ...diverged,
    storyId: 'screens-new-folder-checkout--default',
    filePath: 'src/stories/screens/New Folder/Checkout.stories.tsx',
    implementationFilePath: 'src/screens/New Folder/Checkout.tsx',
  });
  expect(next[1]).toBe(untouched);
});

test('applyFileRenamePlansToScreens renames generated story and implementation files', () => {
  const generated = screen({
    id: 'checkout',
    name: 'Checkout',
    storyId: 'screens-flows-checkout--default',
    filePath: 'src/stories/screens/Flows/Checkout.stories.tsx',
    implementationFilePath: 'src/screens/Flows/Checkout.tsx',
    folder: 'Flows',
  });

  const next = applyFileRenamePlansToScreens(
    [generated],
    [{ screenId: 'checkout', toName: 'Checkout Success' }],
  );

  expect(next[0]).toEqual({
    ...generated,
    name: 'Checkout Success',
    storyId: 'screens-flows-checkout-success--default',
    filePath: 'src/stories/screens/Flows/CheckoutSuccess.stories.tsx',
    implementationFilePath: 'src/screens/Flows/CheckoutSuccess.tsx',
  });
});

test('withScreenRenameResult stores file paths and story id returned by the API', () => {
  expect(
    withScreenRenameResult(screen({ id: 'checkout', name: 'Checkout' }), {
      storyId: 'screens-flows-checkout-copy--default',
      storyFilePath: 'src/stories/screens/Flows/CheckoutCopy.stories.tsx',
      implementationFilePath: 'src/screens/Flows/CheckoutCopy.tsx',
    }),
  ).toEqual({
    id: 'checkout',
    kind: 'story',
    name: 'Checkout',
    storyId: 'screens-flows-checkout-copy--default',
    filePath: 'src/stories/screens/Flows/CheckoutCopy.stories.tsx',
    implementationFilePath: 'src/screens/Flows/CheckoutCopy.tsx',
  });
});

test('storySourceFilePath prefers the catalog source and fails loudly without a story source', () => {
  const stories = catalogStories({
    source: 'storybook',
    generatedAt: 1,
    previewUrl: 'http://localhost:6006',
    components: [
      {
        id: 'c1',
        title: 'Flows/Checkout',
        shortName: 'Checkout',
        filePath: 'src/components/Checkout.stories.tsx',
        stories: [{ id: 'flows-checkout--default', name: 'Default', previewUrl: 'u1' }],
      },
    ],
  });

  expect(
    storySourceFilePath(
      stories,
      screen({
        id: 'checkout',
        storyId: 'flows-checkout--default',
        filePath: 'src/legacy/Checkout.stories.tsx',
      }),
    ),
  ).toBe('src/components/Checkout.stories.tsx');
  expect(() => storySourceFilePath([], screen({ id: 'missing' }))).toThrow(
    'Could not duplicate this Storybook screen because its source story is missing.',
  );
});

test('isGeneratedScreenStoryFile detects generated screen story wrappers', () => {
  expect(isGeneratedScreenStoryFile('src/stories/screens/Flows/Checkout.stories.tsx')).toBe(true);
  expect(isGeneratedScreenStoryFile('src\\stories\\screens\\Flows\\Checkout.stories.ts')).toBe(
    true,
  );
  expect(isGeneratedScreenStoryFile('src/components/Checkout.stories.tsx')).toBe(false);
});

test('describeScreenMoveError turns destination collisions into an actionable message', () => {
  const friendly = describeScreenMoveError(
    new Error('Cannot rename a to b: destination already exists.'),
    'New screen 02',
    'DeepseekV4Flash',
  );
  expect(friendly).toBe(
    'Cannot move New screen 02 to DeepseekV4Flash: a screen with the same file name already exists there. Rename one of them first.',
  );
  expect(describeScreenMoveError(new Error('disk on fire'), 'X', 'Y')).toBe('disk on fire');
});

test('catalogStories flattens components into per-story entries', () => {
  expect(catalogStories(null)).toEqual([]);
  const catalog = {
    source: 'storybook' as const,
    generatedAt: 1,
    previewUrl: 'http://localhost:6006',
    components: [
      {
        id: 'c1',
        title: 'Atoms/Button',
        shortName: 'Button',
        filePath: 'src/Button.stories.tsx',
        stories: [
          { id: 's1', name: 'Primary', previewUrl: 'u1' },
          { id: 's2', name: 'Ghost', previewUrl: 'u2' },
        ],
      },
    ],
  };
  const entries = catalogStories(catalog);
  expect(entries.map((e) => e.story.id)).toEqual(['s1', 's2']);
  expect(entries[0]?.component.id).toBe('c1');
});
