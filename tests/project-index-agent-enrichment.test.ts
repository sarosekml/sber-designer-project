import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { CANONICAL_DESIGN_INDEX_PATHS } from '../packages/design-indexer/src';
import { generateProjectDesignIndexFiles } from '../services/api/src/design-index';
import { enrichProjectIndex } from '../services/api/src/project-index/agent-enrichment';

test('agent enrichment writes validated model output only to index artifacts', async () => {
  const root = await createWorkspaceWithIndex();

  const result = await enrichProjectIndex(root, {
    projectName: 'Enriched CRM',
    gateway: {
      active: { provider: 'test', model: 'indexer' },
      chat: async () => ({
        text: JSON.stringify({
          agentNotes: [
            {
              targetType: 'component',
              targetId: 'components-data-table',
              intent: 'usage',
              note: 'Prefer DataTable for operational approval queues.',
            },
          ],
          diagnostics: [
            {
              level: 'info',
              filePath: CANONICAL_DESIGN_INDEX_PATHS.agentNotes,
              message: 'Agent enrichment added queue guidance.',
            },
          ],
          promptSummaryAppendix: 'Use compact table density for approval queues.',
        }),
      }),
    },
  });

  expect(result.status).toBe('applied');
  expect(result.changedFiles).toEqual([
    CANONICAL_DESIGN_INDEX_PATHS.agentNotes,
    CANONICAL_DESIGN_INDEX_PATHS.diagnostics,
    CANONICAL_DESIGN_INDEX_PATHS.promptSummary,
  ]);

  const notes = await readJsonl(join(root, CANONICAL_DESIGN_INDEX_PATHS.agentNotes));
  expect(notes).toContainEqual(
    expect.objectContaining({
      source: 'agent',
      targetId: 'components-data-table',
      note: 'Prefer DataTable for operational approval queues.',
    }),
  );

  const diagnostics = await readJson(join(root, CANONICAL_DESIGN_INDEX_PATHS.diagnostics));
  expect(diagnostics.diagnostics).toContainEqual(
    expect.objectContaining({
      message: 'Agent enrichment added queue guidance.',
    }),
  );

  const promptSummary = await readFile(
    join(root, CANONICAL_DESIGN_INDEX_PATHS.promptSummary),
    'utf8',
  );
  expect(promptSummary).toContain('Use compact table density for approval queues.');
});

test('agent enrichment validates JSON schema before writing artifacts', async () => {
  const root = await createWorkspaceWithIndex();
  const before = await readFile(join(root, CANONICAL_DESIGN_INDEX_PATHS.agentNotes), 'utf8');

  const result = await enrichProjectIndex(root, {
    projectName: 'Invalid CRM',
    gateway: {
      active: { provider: 'test', model: 'indexer' },
      chat: async () => ({
        text: JSON.stringify({
          agentNotes: [{ targetType: 'component', note: 'missing target intent' }],
        }),
      }),
    },
  });

  expect(result.status).toBe('skipped');
  expect(result.changedFiles).toEqual([]);
  expect(result.diagnostics[0]?.message).toContain('schema');
  expect(await readFile(join(root, CANONICAL_DESIGN_INDEX_PATHS.agentNotes), 'utf8')).toBe(before);
});

test('agent enrichment seeds minimal component guidance without an LLM gateway', async () => {
  const root = await createWorkspaceWithSeedableComponents();

  const result = await enrichProjectIndex(root, {
    projectName: 'Seeded UI Kit',
    gateway: null,
  });

  expect(result.status).toBe('applied');
  expect(result.changedFiles).toEqual([CANONICAL_DESIGN_INDEX_PATHS.agentNotes]);

  const notes = await readJsonl(join(root, CANONICAL_DESIGN_INDEX_PATHS.agentNotes));
  expect(notes).toContainEqual(
    expect.objectContaining({
      id: 'agent-seed-breadcrumb-molecules-breadcrumbs',
      targetId: 'molecules-breadcrumbs',
      source: 'agent',
      intent: 'usage',
    }),
  );
  expect(notes).toContainEqual(
    expect.objectContaining({
      id: 'agent-seed-page-header-molecules-pagebar',
      targetId: 'molecules-pagebar',
      source: 'agent',
    }),
  );
  expect(notes).toContainEqual(
    expect.objectContaining({
      id: 'agent-seed-section-header-atoms-header-dashboardgroupheader',
      targetId: 'atoms-header-dashboardgroupheader',
      source: 'agent',
    }),
  );
  expect(notes).toContainEqual(
    expect.objectContaining({
      id: 'agent-seed-content-panel-molecules-tiles-tile',
      targetId: 'molecules-tiles-tile',
      source: 'agent',
    }),
  );

  const second = await enrichProjectIndex(root, {
    projectName: 'Seeded UI Kit',
    gateway: null,
  });
  const notesAfterSecondRun = await readJsonl(join(root, CANONICAL_DESIGN_INDEX_PATHS.agentNotes));
  expect(second.status).toBe('skipped');
  expect(notesAfterSecondRun).toHaveLength(notes.length);
});

async function createWorkspaceWithIndex(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-project-index-enrich-'));
  await mkdir(join(root, 'src', 'components'), { recursive: true });
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ dependencies: { react: '^19.0.0' } }, null, 2),
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'DataTable.tsx'),
    'export function DataTable() { return <table />; }',
    'utf8',
  );
  await generateProjectDesignIndexFiles(root, {
    projectName: 'Enriched CRM',
    catalog: {
      source: 'static',
      generatedAt: Date.now(),
      components: [
        {
          id: 'components-data-table',
          title: 'Components/DataTable',
          shortName: 'DataTable',
          filePath: 'src/components/DataTable.tsx',
          stories: [],
        },
      ],
    },
  });
  return root;
}

async function createWorkspaceWithSeedableComponents(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-project-index-seed-'));
  await mkdir(join(root, 'src', 'components'), { recursive: true });
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ dependencies: { react: '^19.0.0' } }, null, 2),
    'utf8',
  );
  const components = [
    ['BreadCrumbs', 'Molecules/BreadCrumbs', 'molecules-breadcrumbs'],
    ['PageBar', 'Molecules/PageBar', 'molecules-pagebar'],
    [
      'DashboardGroupHeader',
      'Atoms/Header/DashboardGroupHeader',
      'atoms-header-dashboardgroupheader',
    ],
    ['Tile', 'Molecules/Tiles/Tile', 'molecules-tiles-tile'],
  ] as const;
  for (const [shortName] of components) {
    await writeFile(
      join(root, 'src', 'components', `${shortName}.tsx`),
      `export function ${shortName}() { return null; }`,
      'utf8',
    );
  }
  await generateProjectDesignIndexFiles(root, {
    projectName: 'Seeded UI Kit',
    catalog: {
      source: 'static',
      generatedAt: Date.now(),
      components: components.map(([shortName, title, id]) => ({
        id,
        title,
        shortName,
        filePath: `src/components/${shortName}.tsx`,
        stories: [{ id: `${id}--default`, name: 'Default' }],
      })),
    },
  });
  return root;
}

async function readJson(path: string): Promise<any> {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readJsonl(path: string): Promise<any[]> {
  const contents = await readFile(path, 'utf8');
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
