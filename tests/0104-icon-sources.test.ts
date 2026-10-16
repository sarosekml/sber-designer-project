import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { CANONICAL_DESIGN_INDEX_PATHS } from '../packages/design-indexer/src';
import { ALL_TOOLS } from '../services/api/src/agent/toolset';
import { generateProjectDesignIndexFiles } from '../services/api/src/design-index';
import type { ToolContext } from '../services/api/src/agent/types';

test('indexed workspace icon sources are used in place without duplication', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-0104-workspace-icons-'));
  const iconRoot = join(root, 'src', 'shared', 'icons');
  await mkdir(iconRoot, { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { react: '^19' } }));
  await writeFile(
    join(iconRoot, 'loan-warning.svg'),
    '<svg viewBox="0 0 16 16"><path d="M8 1l7 14H1z"/></svg>',
    'utf8',
  );
  await writeFile(
    join(iconRoot, 'BrandGlyph.tsx'),
    'export function BrandGlyph() { return <svg viewBox="0 0 16 16" />; }\n',
    'utf8',
  );
  await writeProject(root, {
    externalAssetSources: {
      icons: [
        {
          id: 'source-project-icons',
          name: 'Project shared icons',
          kind: 'local-folder',
          mode: 'workspace',
          families: ['icons'],
          localPath: iconRoot,
          workspacePath: 'src/shared/icons',
          updatedAt: 1,
        },
      ],
    },
  });

  await generateProjectDesignIndexFiles(root, {
    projectName: 'Workspace icons',
    catalog: null,
  });

  const assets = (await readJsonl(join(root, CANONICAL_DESIGN_INDEX_PATHS.assets))) as {
    id: string;
    kind: string;
    name: string;
    filePath: string;
  }[];
  expect(assets).toContainEqual(
    expect.objectContaining({
      kind: 'icon',
      name: 'Loan warning',
      filePath: 'src/shared/icons/loan-warning.svg',
    }),
  );
  await expectMissing(join(root, 'src', 'sber-designer-assets', 'icons', 'loan-warning.svg'));

  const candidates = (await readJsonl(join(root, CANONICAL_DESIGN_INDEX_PATHS.iconCandidates))) as {
    name: string;
    source: string;
    filePath?: string;
    validFor: string[];
  }[];
  expect(candidates).toContainEqual(
    expect.objectContaining({
      name: 'Loan warning',
      source: 'project-asset',
      filePath: 'src/shared/icons/loan-warning.svg',
      validFor: ['asset-import'],
    }),
  );
  expect(candidates).toContainEqual(
    expect.objectContaining({
      name: 'BrandGlyph',
      source: 'project-file',
      filePath: 'src/shared/icons/BrandGlyph.tsx',
      validFor: ['project-file-import'],
    }),
  );

  const indexedIcon = (await findTool('get_indexed_icon').handler(
    { idOrName: 'loan warning' },
    toolContext(root),
  )) as {
    source: string;
    icon: { filePath: string };
    usage?: { requiresMaterialization?: boolean };
  };
  expect(indexedIcon.source).toBe('project-asset');
  expect(indexedIcon.icon.filePath).toBe('src/shared/icons/loan-warning.svg');
  expect(indexedIcon.usage?.requiresMaterialization).toBeUndefined();
});

test('external icon sources are indexed as portable references and materialized on demand', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-0104-external-icons-project-'));
  const externalRoot = await mkdtemp(join(tmpdir(), 'sd-0104-external-icons-source-'));
  await mkdir(join(externalRoot, 'banking'), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { react: '^19' } }));
  await writeFile(
    join(externalRoot, 'banking', 'risk-alert.svg'),
    '<svg viewBox="0 0 16 16"><path d="M8 1l7 14H1z"/></svg>',
    'utf8',
  );
  await writeProject(root, {
    externalAssetSources: {
      icons: [
        {
          id: 'source-banking-icons',
          name: 'Banking icon pack',
          kind: 'local-folder',
          mode: 'external',
          families: ['icons'],
          localPath: externalRoot,
          updatedAt: 1,
        },
      ],
    },
  });

  await generateProjectDesignIndexFiles(root, {
    projectName: 'External icons',
    catalog: null,
  });

  const externalIconsPath = join(root, CANONICAL_DESIGN_INDEX_PATHS.externalIcons);
  const externalIconsText = await readFile(externalIconsPath, 'utf8');
  expect(externalIconsText).not.toContain(externalRoot);
  const externalIcons = (await readJsonl(externalIconsPath)) as {
    id: string;
    name: string;
    source: string;
    sourceId: string;
    sourceRelPath: string;
  }[];
  expect(externalIcons).toContainEqual(
    expect.objectContaining({
      name: 'Risk alert',
      source: 'external-icon-reference',
      sourceId: 'source-banking-icons',
      sourceRelPath: 'banking/risk-alert.svg',
    }),
  );

  const candidates = (await readJsonl(join(root, CANONICAL_DESIGN_INDEX_PATHS.iconCandidates))) as {
    id: string;
    name: string;
    source: string;
    validFor: string[];
  }[];
  const candidate = candidates.find((item) => item.source === 'external-icon-reference');
  expect(candidate).toMatchObject({
    name: 'Risk alert',
    source: 'external-icon-reference',
    validFor: ['materialize-asset'],
  });

  const beforeMaterialize = (await findTool('get_indexed_icon').handler(
    { idOrName: 'risk alert' },
    toolContext(root),
  )) as {
    source: string;
    icon: { source: string };
    usage?: { requiresMaterialization?: boolean; tool?: string };
  };
  expect(beforeMaterialize.source).toBe('external-icon-reference');
  expect(beforeMaterialize.usage).toMatchObject({
    requiresMaterialization: true,
    tool: 'materialize_indexed_icon',
  });

  const materialized = (await findTool('materialize_indexed_icon').handler(
    { iconId: candidate?.id },
    toolContext(root),
  )) as { asset: { filePath: string; importName: string; importSource: string } };
  expect(materialized.asset).toMatchObject({
    filePath: 'src/sber-designer-assets/icons/risk-alert.svg',
    importName: 'riskAlertUrl',
    importSource: '@/sber-designer-assets',
  });
  expect(await exists(join(root, 'src', 'sber-designer-assets', 'icons', 'risk-alert.svg'))).toBe(
    true,
  );
  expect(await readFile(join(root, 'src', 'sber-designer-assets', 'index.ts'), 'utf8')).toContain(
    "export { default as riskAlertUrl } from './icons/risk-alert.svg';",
  );

  const afterMaterialize = (await findTool('get_indexed_icon').handler(
    { idOrName: 'risk alert' },
    toolContext(root),
  )) as { source: string; icon: { filePath: string } };
  expect(afterMaterialize.source).toBe('project-asset');
  expect(afterMaterialize.icon.filePath).toBe('src/sber-designer-assets/icons/risk-alert.svg');
});

async function writeProject(root: string, patch: Record<string, unknown>): Promise<void> {
  await mkdir(join(root, '.sber-designer'), { recursive: true });
  await writeFile(
    join(root, '.sber-designer', 'project.sdproj'),
    JSON.stringify(
      {
        version: 1,
        name: '0104 icon source project',
        workspacePath: root,
        screens: [],
        flow: [],
        ...patch,
      },
      null,
      2,
    ),
    'utf8',
  );
}

function findTool(name: string) {
  const tool = ALL_TOOLS.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}

function toolContext(workspacePath: string): ToolContext {
  return {
    user: 'test-user',
    projectName: '0104 icons',
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

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function expectMissing(path: string): Promise<void> {
  expect(await exists(path)).toBe(false);
}
