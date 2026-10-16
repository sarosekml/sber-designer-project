import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { moveWorkspaceScreenToFolder } from '../services/api/src/screen-folder-rename';

async function seedScreen(workspace: string, folder: string): Promise<void> {
  await mkdir(join(workspace, 'src', 'stories', 'screens', folder), { recursive: true });
  await mkdir(join(workspace, 'src', 'screens', folder), { recursive: true });
  await writeFile(
    join(workspace, 'src', 'stories', 'screens', folder, 'AdministrationCodexImg.stories.tsx'),
    [
      "import type { Meta, StoryObj } from '@storybook/react-vite';",
      `import { AdministrationCodexImg } from '../../../screens/${folder}/AdministrationCodexImg';`,
      '',
      'const meta = {',
      `  title: 'Screens/${folder}/Administration codex img',`,
      '  component: AdministrationCodexImg,',
      '} satisfies Meta<typeof AdministrationCodexImg>;',
      '',
      'export default meta;',
      'type Story = StoryObj<typeof meta>;',
      "export const Default: Story = { name: 'Administration codex img' };",
      '',
    ].join('\n'),
  );
  await writeFile(
    join(workspace, 'src', 'screens', folder, 'AdministrationCodexImg.tsx'),
    'export function AdministrationCodexImg() { return null; }\n',
  );
}

test('moves a generated screen to another folder, rewrites title/import, recomputes id', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-move-'));
  await seedScreen(workspace, '2026-05-31');

  const result = await moveWorkspaceScreenToFolder(workspace, {
    storyFilePath: 'src/stories/screens/2026-05-31/AdministrationCodexImg.stories.tsx',
    implementationFilePath: 'src/screens/2026-05-31/AdministrationCodexImg.tsx',
    toFolder: 'DeepseekV4Flash',
  });

  expect(result.storyFilePath).toBe(
    'src/stories/screens/DeepseekV4Flash/AdministrationCodexImg.stories.tsx',
  );
  expect(result.implementationFilePath).toBe(
    'src/screens/DeepseekV4Flash/AdministrationCodexImg.tsx',
  );
  expect(result.storyId).toBe('screens-deepseekv4flash-administration-codex-img--default');
  expect(result.movedPaths).toEqual([
    {
      from: 'src/stories/screens/2026-05-31/AdministrationCodexImg.stories.tsx',
      to: 'src/stories/screens/DeepseekV4Flash/AdministrationCodexImg.stories.tsx',
    },
    {
      from: 'src/screens/2026-05-31/AdministrationCodexImg.tsx',
      to: 'src/screens/DeepseekV4Flash/AdministrationCodexImg.tsx',
    },
  ]);

  // Old folders are emptied and removed, so Storybook drops the date folder.
  await expect(stat(join(workspace, 'src', 'stories', 'screens', '2026-05-31'))).rejects.toThrow();
  await expect(stat(join(workspace, 'src', 'screens', '2026-05-31'))).rejects.toThrow();
  expect(result.removedEmptyDirs).toEqual([
    'src/stories/screens/2026-05-31',
    'src/screens/2026-05-31',
  ]);

  const story = await readFile(
    join(
      workspace,
      'src',
      'stories',
      'screens',
      'DeepseekV4Flash',
      'AdministrationCodexImg.stories.tsx',
    ),
    'utf8',
  );
  expect(story).toContain("title: 'Screens/DeepseekV4Flash/Administration codex img'");
  expect(story).toContain("from '../../../screens/DeepseekV4Flash/AdministrationCodexImg'");
});

test('keeps a sibling screen folder when only one of several screens moves out', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-move-sibling-'));
  await seedScreen(workspace, 'Misc');
  await writeFile(
    join(workspace, 'src', 'stories', 'screens', 'Misc', 'Other.stories.tsx'),
    'export const Default = {};\n',
  );

  const result = await moveWorkspaceScreenToFolder(workspace, {
    storyFilePath: 'src/stories/screens/Misc/AdministrationCodexImg.stories.tsx',
    implementationFilePath: 'src/screens/Misc/AdministrationCodexImg.tsx',
    toFolder: 'DeepseekV4Flash',
  });

  // The Misc story folder still has Other.stories.tsx, so it must not be removed.
  expect(result.removedEmptyDirs).toEqual(['src/screens/Misc']);
  const remaining = await readdir(join(workspace, 'src', 'stories', 'screens', 'Misc'));
  expect(remaining).toEqual(['Other.stories.tsx']);
});

test('throws when a different screen with the same file name exists in the target folder', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-move-collision-'));
  await seedScreen(workspace, 'Misc');
  // A different screen that happens to produce the same generated file name.
  await mkdir(join(workspace, 'src', 'stories', 'screens', 'DeepseekV4Flash'), { recursive: true });
  await writeFile(
    join(
      workspace,
      'src',
      'stories',
      'screens',
      'DeepseekV4Flash',
      'AdministrationCodexImg.stories.tsx',
    ),
    'export const Default = {};\n',
  );

  await expect(
    moveWorkspaceScreenToFolder(workspace, {
      storyFilePath: 'src/stories/screens/Misc/AdministrationCodexImg.stories.tsx',
      implementationFilePath: 'src/screens/Misc/AdministrationCodexImg.tsx',
      toFolder: 'DeepseekV4Flash',
    }),
  ).rejects.toThrow(/destination already exists/);

  // The source screen is left untouched so the caller can rename and retry.
  await expect(
    stat(
      join(workspace, 'src', 'stories', 'screens', 'Misc', 'AdministrationCodexImg.stories.tsx'),
    ),
  ).resolves.toBeTruthy();
});

test('is idempotent when the story file was already moved (source gone, destination present)', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-move-idempotent-'));
  // Only the destination exists — simulating a prior move whose .sdproj path
  // was not persisted, so a re-sync plans the same move again.
  await seedScreen(workspace, 'DeepseekV4Flash');

  const result = await moveWorkspaceScreenToFolder(workspace, {
    storyFilePath: 'src/stories/screens/Misc/AdministrationCodexImg.stories.tsx',
    implementationFilePath: 'src/screens/Misc/AdministrationCodexImg.tsx',
    toFolder: 'DeepseekV4Flash',
  });

  expect(result.movedPaths).toEqual([]);
  expect(result.storyFilePath).toBe(
    'src/stories/screens/DeepseekV4Flash/AdministrationCodexImg.stories.tsx',
  );
  expect(result.storyId).toBe('screens-deepseekv4flash-administration-codex-img--default');
});

test('is a no-op when the screen is already in the target folder', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-move-noop-'));
  await seedScreen(workspace, 'Payments');

  const result = await moveWorkspaceScreenToFolder(workspace, {
    storyFilePath: 'src/stories/screens/Payments/AdministrationCodexImg.stories.tsx',
    implementationFilePath: 'src/screens/Payments/AdministrationCodexImg.tsx',
    toFolder: 'Payments',
  });

  expect(result.movedPaths).toEqual([]);
  expect(result.updatedFiles).toEqual([]);
  expect(result.storyId).toBe('screens-payments-administration-codex-img--default');
});
