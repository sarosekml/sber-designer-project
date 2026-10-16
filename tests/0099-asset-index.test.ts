import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { CANONICAL_DESIGN_INDEX_PATHS } from '../packages/design-indexer/src';
import { ALL_TOOLS } from '../services/api/src/agent/toolset';
import type { ToolContext } from '../services/api/src/agent/types';
import { generateProjectDesignIndexFiles } from '../services/api/src/design-index';

test('project index records imported icons and illustrations as searchable assets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-asset-index-'));
  await mkdir(join(root, 'src', 'assets', 'icons'), { recursive: true });
  await mkdir(join(root, 'src', 'assets', 'illustrations'), { recursive: true });
  await mkdir(join(root, '.sber-designer', 'assets'), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { react: '^19' } }));
  await writeFile(
    join(root, 'src', 'assets', 'icons', 'payment-warning.svg'),
    '<svg viewBox="0 0 16 16"><path d="M8 1l7 14H1z"/></svg>',
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'assets', 'illustrations', 'empty-payments.png'),
    'fake-png',
    'utf8',
  );
  await writeFile(
    join(root, '.sber-designer', 'assets', 'imported-packs.json'),
    JSON.stringify(
      {
        version: 1,
        packs: [
          {
            id: 'pack-payments',
            name: 'Payments assets',
            importedAt: 1779321600000,
            sourceKind: 'local-folder',
            sourceLabel: 'payments-assets',
            assetCount: 2,
            contentHash: 'sha256:test',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  const result = await generateProjectDesignIndexFiles(root, {
    projectName: 'Payments',
    catalog: null,
  });

  expect(result.changedFiles).toContain(CANONICAL_DESIGN_INDEX_PATHS.assets);

  const manifest = JSON.parse(
    await readFile(join(root, CANONICAL_DESIGN_INDEX_PATHS.manifest), 'utf8'),
  ) as {
    counts: { assets: number; illustrations: number };
  };
  expect(manifest.counts.assets).toBe(2);
  expect(manifest.counts.illustrations).toBe(1);

  const assets = (await readJsonl(join(root, CANONICAL_DESIGN_INDEX_PATHS.assets))) as {
    id: string;
    kind: string;
    name: string;
    filePath: string;
    usageMode: string;
    packId?: string;
  }[];
  expect(assets).toContainEqual(
    expect.objectContaining({
      id: 'asset-icon-payment-warning',
      kind: 'icon',
      name: 'Payment warning',
      filePath: 'src/assets/icons/payment-warning.svg',
      usageMode: 'asset-url',
      packId: 'pack-payments',
    }),
  );
  expect(assets).toContainEqual(
    expect.objectContaining({
      id: 'asset-illustration-empty-payments',
      kind: 'illustration',
      filePath: 'src/assets/illustrations/empty-payments.png',
    }),
  );

  const search = (await findTool('search_project_index').handler(
    { query: 'empty payments', types: ['asset'], limit: 5 },
    toolContext(root),
  )) as { results: { type: string; id: string; title: string; filePath: string }[] };
  expect(search.results).toContainEqual(
    expect.objectContaining({
      type: 'asset',
      id: 'asset-illustration-empty-payments',
      title: 'Empty payments',
      filePath: 'src/assets/illustrations/empty-payments.png',
    }),
  );

  const exact = (await findTool('get_indexed_asset').handler(
    { idOrName: 'payment-warning' },
    toolContext(root),
  )) as { asset: { id: string; importSource?: string; importName?: string } };
  expect(exact.asset).toMatchObject({
    id: 'asset-icon-payment-warning',
    importSource: '@/assets',
    importName: 'paymentWarningUrl',
  });
});

function findTool(name: string) {
  const tool = ALL_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}

function toolContext(workspacePath: string): ToolContext {
  return {
    user: 'test-user',
    projectName: 'Payments',
    activeScreen: null,
    workspacePath,
    canvasUrl: null,
  };
}

async function readJsonl(path: string): Promise<unknown[]> {
  return (await readFile(path, 'utf8'))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown);
}
