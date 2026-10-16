import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  renameWorkspaceScreen,
  renameWorkspaceScreenFolder,
} from '../services/api/src/screen-folder-rename';

test('renames generated screen folders on disk and rewrites Storybook title/import paths', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-folder-rename-'));
  await mkdir(join(workspace, 'src', 'stories', 'screens', '2026-05-29'), { recursive: true });
  await mkdir(join(workspace, 'src', 'screens', '2026-05-29'), { recursive: true });
  await writeFile(
    join(workspace, 'src', 'stories', 'screens', '2026-05-29', 'RiskMetrics.stories.tsx'),
    [
      "import type { Meta, StoryObj } from '@storybook/react-vite';",
      "import { RiskMetrics } from '../../../screens/2026-05-29/RiskMetrics';",
      '',
      'const meta = {',
      "  title: 'Screens/2026-05-29/Risk metrics',",
      '  component: RiskMetrics,',
      '} satisfies Meta<typeof RiskMetrics>;',
      '',
      'export default meta;',
      'type Story = StoryObj<typeof meta>;',
      'export const Default: Story = {};',
      '',
    ].join('\n'),
  );
  await writeFile(
    join(workspace, 'src', 'screens', '2026-05-29', 'RiskMetrics.tsx'),
    'export function RiskMetrics() { return null; }\n',
  );

  const result = await renameWorkspaceScreenFolder(workspace, {
    from: '2026-05-29',
    to: 'Payments',
  });

  expect(result.movedPaths).toEqual([
    {
      from: 'src/stories/screens/2026-05-29',
      to: 'src/stories/screens/Payments',
    },
    {
      from: 'src/screens/2026-05-29',
      to: 'src/screens/Payments',
    },
  ]);
  await expect(stat(join(workspace, 'src', 'stories', 'screens', '2026-05-29'))).rejects.toThrow();
  await expect(stat(join(workspace, 'src', 'screens', '2026-05-29'))).rejects.toThrow();
  await expect(
    stat(join(workspace, 'src', 'stories', 'screens', 'Payments')),
  ).resolves.toBeTruthy();
  await expect(stat(join(workspace, 'src', 'screens', 'Payments'))).resolves.toBeTruthy();

  const story = await readFile(
    join(workspace, 'src', 'stories', 'screens', 'Payments', 'RiskMetrics.stories.tsx'),
    'utf8',
  );
  expect(story).toContain("title: 'Screens/Payments/Risk metrics'");
  expect(story).toContain("from '../../../screens/Payments/RiskMetrics'");
});

test('retitles an already-moved filesystem folder so Storybook follows the path rename', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-folder-retitle-'));
  await mkdir(join(workspace, 'src', 'stories', 'screens', 'Payments'), { recursive: true });
  await writeFile(
    join(workspace, 'src', 'stories', 'screens', 'Payments', 'RiskMetrics.stories.tsx'),
    [
      "import type { Meta, StoryObj } from '@storybook/react-vite';",
      "import { RiskMetrics } from '../../../screens/2026-05-29/RiskMetrics';",
      '',
      'const meta = {',
      "  title: 'Screens/2026-05-29/Risk metrics',",
      '  component: RiskMetrics,',
      '} satisfies Meta<typeof RiskMetrics>;',
      '',
      'export default meta;',
      'type Story = StoryObj<typeof meta>;',
      'export const Default: Story = {};',
      '',
    ].join('\n'),
  );

  const result = await renameWorkspaceScreenFolder(workspace, {
    from: '2026-05-29',
    to: 'Payments',
  });

  expect(result.movedPaths).toEqual([]);
  expect(result.updatedFiles).toEqual(['src/stories/screens/Payments/RiskMetrics.stories.tsx']);
  const story = await readFile(
    join(workspace, 'src', 'stories', 'screens', 'Payments', 'RiskMetrics.stories.tsx'),
    'utf8',
  );
  expect(story).toContain("title: 'Screens/Payments/Risk metrics'");
  expect(story).toContain("from '../../../screens/Payments/RiskMetrics'");
});

test('renames generated screen story and implementation files from the screen name', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-file-rename-'));
  await mkdir(join(workspace, 'src', 'stories', 'screens', '2026-05-29'), { recursive: true });
  await mkdir(join(workspace, 'src', 'screens', '2026-05-29'), { recursive: true });
  await writeFile(
    join(workspace, 'src', 'stories', 'screens', '2026-05-29', 'NewScreenmpfcd493.stories.tsx'),
    [
      "import type { Meta, StoryObj } from '@storybook/react-vite';",
      "import { NewScreenmpfcd493 } from '../../../screens/2026-05-29/NewScreenmpfcd493';",
      '',
      'const meta = {',
      "  title: 'Screens/2026-05-29/New screen mpfcd493',",
      '  component: NewScreenmpfcd493,',
      '} satisfies Meta<typeof NewScreenmpfcd493>;',
      '',
      'export default meta;',
      'type Story = StoryObj<typeof meta>;',
      'export const Default: Story = {',
      "  name: 'New screen',",
      '};',
      '',
    ].join('\n'),
  );
  await writeFile(
    join(workspace, 'src', 'screens', '2026-05-29', 'NewScreenmpfcd493.tsx'),
    'export function NewScreenmpfcd493() { return null; }\n',
  );

  const result = await renameWorkspaceScreen(workspace, {
    storyFilePath: 'src/stories/screens/2026-05-29/NewScreenmpfcd493.stories.tsx',
    implementationFilePath: 'src/screens/2026-05-29/NewScreenmpfcd493.tsx',
    toName: 'Risk metrics',
  });

  expect(result.storyFilePath).toBe('src/stories/screens/2026-05-29/RiskMetrics.stories.tsx');
  expect(result.implementationFilePath).toBe('src/screens/2026-05-29/RiskMetrics.tsx');
  expect(result.storyId).toBe('screens-2026-05-29-risk-metrics--default');
  expect(result.movedPaths).toEqual([
    {
      from: 'src/stories/screens/2026-05-29/NewScreenmpfcd493.stories.tsx',
      to: 'src/stories/screens/2026-05-29/RiskMetrics.stories.tsx',
    },
    {
      from: 'src/screens/2026-05-29/NewScreenmpfcd493.tsx',
      to: 'src/screens/2026-05-29/RiskMetrics.tsx',
    },
  ]);

  const story = await readFile(
    join(workspace, 'src', 'stories', 'screens', '2026-05-29', 'RiskMetrics.stories.tsx'),
    'utf8',
  );
  const implementation = await readFile(
    join(workspace, 'src', 'screens', '2026-05-29', 'RiskMetrics.tsx'),
    'utf8',
  );
  expect(story).toContain("import { RiskMetrics } from '../../../screens/2026-05-29/RiskMetrics'");
  expect(story).toContain("title: 'Screens/2026-05-29/Risk metrics'");
  expect(story).toContain('component: RiskMetrics');
  expect(story).toContain("name: 'Risk metrics'");
  expect(implementation).toContain('export function RiskMetrics()');
});

test('retitles an already-renamed story file and moves the implementation file', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-file-retitle-'));
  await mkdir(join(workspace, 'src', 'stories', 'screens', 'Payments'), { recursive: true });
  await mkdir(join(workspace, 'src', 'screens', 'Payments'), { recursive: true });
  await writeFile(
    join(workspace, 'src', 'stories', 'screens', 'Payments', 'RiskMetrics.stories.tsx'),
    [
      "import type { Meta, StoryObj } from '../../../screens/Payments/RiskMetrics';",
      "import { NewScreenmpfcd493 } from '../../../screens/Payments/NewScreenmpfcd493';",
      '',
      'const meta = {',
      "  title: 'Screens/Payments/New screen mpfcd493',",
      '  component: NewScreenmpfcd493,',
      '} satisfies Meta<typeof NewScreenmpfcd493>;',
      '',
      'export default meta;',
      'type Story = StoryObj<typeof meta>;',
      'export const Default: Story = {};',
      '',
    ].join('\n'),
  );
  await writeFile(
    join(workspace, 'src', 'screens', 'Payments', 'NewScreenmpfcd493.tsx'),
    'export const NewScreenmpfcd493 = () => null;\n',
  );

  const result = await renameWorkspaceScreen(workspace, {
    storyFilePath: 'src/stories/screens/Payments/RiskMetrics.stories.tsx',
    implementationFilePath: 'src/screens/Payments/NewScreenmpfcd493.tsx',
    toName: 'Risk metrics',
  });

  expect(result.movedPaths).toEqual([
    {
      from: 'src/screens/Payments/NewScreenmpfcd493.tsx',
      to: 'src/screens/Payments/RiskMetrics.tsx',
    },
  ]);
  const story = await readFile(
    join(workspace, 'src', 'stories', 'screens', 'Payments', 'RiskMetrics.stories.tsx'),
    'utf8',
  );
  const implementation = await readFile(
    join(workspace, 'src', 'screens', 'Payments', 'RiskMetrics.tsx'),
    'utf8',
  );
  expect(story).toContain("import type { Meta, StoryObj } from '@storybook/react'");
  expect(story).toContain("import { RiskMetrics } from '../../../screens/Payments/RiskMetrics'");
  expect(story).toContain("title: 'Screens/Payments/Risk metrics'");
  expect(implementation).toContain('export const RiskMetrics = () => null;');
});
