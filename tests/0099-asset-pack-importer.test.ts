import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { ASSET_PACK_OUTSIDE_WORKSPACE_ERROR } from '../services/api/src/assets/asset-pack-importer';
import { importAssetPack } from '../services/api/src/assets/asset-pack-importer';

test('asset pack importer copies safe local assets and generates Storybook galleries', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-asset-workspace-'));
  const source = join(workspace, 'icons-pack');
  await mkdir(join(source, 'icons'), { recursive: true });
  await mkdir(join(source, 'illustrations'), { recursive: true });
  await mkdir(join(workspace, '.storybook'), { recursive: true });
  await writeFile(
    join(workspace, '.storybook', 'main.ts'),
    "export default { stories: ['../src/**/*.stories.@(ts|tsx)'] };",
    'utf8',
  );
  await writeFile(
    join(source, 'icons', 'Payment Warning.svg'),
    '<svg viewBox="0 0 16 16"><path d="M8 1l7 14H1z"/></svg>',
    'utf8',
  );
  await writeFile(join(source, 'illustrations', 'Empty Payments.png'), 'fake-png', 'utf8');
  await writeFile(join(source, 'ignore.exe'), 'nope', 'utf8');

  const result = await importAssetPack({
    workspaceRoot: workspace,
    sourcePath: source,
    packName: 'Payments assets',
    kinds: ['icons', 'illustrations'],
    overwrite: false,
  });

  expect(result.imported).toBe(2);
  expect(result.skipped).toContainEqual(
    expect.objectContaining({ filePath: 'ignore.exe', reason: 'unsupported_extension' }),
  );
  expect(result.changedFiles).toContain('src/assets/icons/payment-warning.svg');
  expect(result.changedFiles).toContain('src/assets/illustrations/empty-payments.png');
  expect(result.changedFiles).toContain('src/stories/assets/Icons.stories.tsx');
  expect(result.changedFiles).toContain('src/stories/assets/Illustrations.stories.tsx');
  expect(result.changedFiles).toContain('.sber-designer/assets/imported-packs.json');

  await expect(
    stat(join(workspace, 'src', 'assets', 'icons', 'payment-warning.svg')),
  ).resolves.toBeTruthy();
  await expect(
    stat(join(workspace, 'src', 'assets', 'illustrations', 'empty-payments.png')),
  ).resolves.toBeTruthy();

  const iconsStory = await readFile(
    join(workspace, 'src', 'stories', 'assets', 'Icons.stories.tsx'),
    'utf8',
  );
  expect(iconsStory).toContain("title: 'Assets/Icons'");
  expect(iconsStory).toContain(
    "import paymentWarningUrl from '../../assets/icons/payment-warning.svg';",
  );

  const indexFile = await readFile(join(workspace, 'src', 'assets', 'index.ts'), 'utf8');
  expect(indexFile).toContain(
    "export { default as paymentWarningUrl } from './icons/payment-warning.svg';",
  );
  expect(indexFile).toContain(
    "export { default as emptyPaymentsUrl } from './illustrations/empty-payments.png';",
  );

  const packs = JSON.parse(
    await readFile(join(workspace, '.sber-designer', 'assets', 'imported-packs.json'), 'utf8'),
  ) as {
    packs: {
      name: string;
      assetCount: number;
      sourceLabel: string;
      assets?: { filePath: string; importName: string }[];
    }[];
  };
  expect(packs.packs).toContainEqual(
    expect.objectContaining({
      name: 'Payments assets',
      assetCount: 2,
      sourceLabel: source.split('/').at(-1),
    }),
  );
  expect(packs.packs[0]?.assets).toContainEqual(
    expect.objectContaining({
      filePath: 'src/assets/icons/payment-warning.svg',
      importName: 'paymentWarningUrl',
    }),
  );
});

test('asset pack importer refuses source folders outside the workspace', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-asset-workspace-'));
  const source = await mkdtemp(join(tmpdir(), 'sd-asset-source-'));
  await mkdir(join(source, 'icons'), { recursive: true });
  await writeFile(
    join(source, 'icons', 'External Warning.svg'),
    '<svg viewBox="0 0 16 16"><path d="M8 1l7 14H1z"/></svg>',
    'utf8',
  );

  await expect(
    importAssetPack({
      workspaceRoot: workspace,
      sourcePath: source,
      packName: 'External assets',
      kinds: ['icons'],
      overwrite: false,
    }),
  ).rejects.toThrow(ASSET_PACK_OUTSIDE_WORKSPACE_ERROR);
});
