import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { DESIGN_INDEX_PATHS } from '../packages/design-indexer/src';
import {
  PROJECT_PROFILE_ANSWERS_PATH,
  loadProjectDesignSystemBrowser,
  saveProjectSetupAnswers,
} from '../services/api/src/design-system-browser';
import {
  addProjectComponentNote,
  deleteProjectComponentNote,
  generateProjectDesignIndexFiles,
  updateProjectComponentNote,
} from '../services/api/src/design-index';

test('loads Design System Browser records and derives setup questions from the project index', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-design-system-browser-'));
  await mkdir(join(workspace, '.sber-designer', 'design-index'), { recursive: true });

  await writeJson(workspace, DESIGN_INDEX_PATHS.projectProfile, {
    packageManager: 'bun',
    frameworks: ['react', 'vite'],
    sourceRoots: ['src'],
    styling: ['tailwind'],
    aliases: { '@/*': ['src/*'] },
    packageScripts: {
      dev: 'vite --host 0.0.0.0',
      test: 'bun test',
    },
  });
  await writeJsonl(workspace, DESIGN_INDEX_PATHS.components, [
    {
      id: 'component-data-table',
      title: 'Data/Table',
      shortName: 'DataTable',
      filePath: 'src/components/DataTable.tsx',
      storyCount: 1,
      stories: [{ id: 'data-table--default', name: 'Default' }],
      tags: ['table'],
      groupIds: ['tables'],
      noteCount: 1,
      confidence: 'high',
    },
  ]);
  await writeJson(workspace, DESIGN_INDEX_PATHS.tokens, {
    tokens: [
      {
        id: 'color-primary',
        name: '--color-primary',
        value: '#1473e6',
        source: 'css',
        filePath: 'src/styles/tokens.css',
        kind: 'color',
      },
    ],
  });
  await writeJson(workspace, DESIGN_INDEX_PATHS.routes, {
    routes: [{ id: 'route-home', routePath: '/', filePath: 'src/App.tsx', source: 'file-system' }],
  });
  await writeJsonl(workspace, DESIGN_INDEX_PATHS.agentNotes, [
    {
      id: 'note-1',
      targetType: 'component',
      targetId: 'component-data-table',
      note: 'Prefer DataTable for dense financial list screens.',
      intent: 'prefer',
      source: 'component-note',
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: 'legacy-note-1',
      componentId: 'component-data-table',
      note: 'Legacy component note should still normalize.',
      intent: 'usage',
      createdAt: 2,
      updatedAt: 2,
    },
  ]);

  const browser = await loadProjectDesignSystemBrowser(workspace);

  expect(browser.projectProfile).toMatchObject({
    packageManager: 'bun',
    frameworks: ['react', 'vite'],
  });
  expect(browser.components).toHaveLength(1);
  expect(browser.components[0]).toMatchObject({
    id: 'component-data-table',
    shortName: 'DataTable',
    noteCount: 1,
  });
  expect(browser.tokens).toHaveLength(1);
  expect(browser.routes).toHaveLength(1);
  expect(browser.agentNotes).toHaveLength(2);
  expect(browser.agentNotes.find((note) => note.id === 'legacy-note-1')).toMatchObject({
    targetType: 'component',
    targetId: 'component-data-table',
    source: 'component-note',
  });
  expect(browser.setupQuestions).toContainEqual(
    expect.objectContaining({
      id: 'storybook.availability',
      status: 'missing',
    }),
  );
  expect(browser.setupQuestions).toContainEqual(
    expect.objectContaining({
      id: 'commands.typecheck',
      status: 'missing',
    }),
  );
});

test('saves shared setup answers and overlays them onto detected profile questions', async () => {
  const workspace = await createIndexedWorkspace();

  const result = await saveProjectSetupAnswers(workspace, [
    { id: 'commands.typecheck', answer: 'bun run typecheck' },
  ]);
  const question = result.browser.setupQuestions.find((item) => item.id === 'commands.typecheck');

  expect(result.changedFiles).toEqual([PROJECT_PROFILE_ANSWERS_PATH]);
  expect(question).toMatchObject({
    id: 'commands.typecheck',
    answer: 'bun run typecheck',
    confirmedAnswer: 'bun run typecheck',
    detectedAnswer: null,
    status: 'confirmed',
  });
});

test('component note add/update/delete preserves canonical agent notes', async () => {
  const workspace = await createIndexedWorkspace();
  await writeJsonl(workspace, DESIGN_INDEX_PATHS.agentNotes, [
    {
      id: 'note-existing',
      targetType: 'component',
      targetId: 'component-data-table',
      note: 'Prefer DataTable for dense financial list screens.',
      intent: 'prefer',
      source: 'component-note',
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: 'note-project',
      targetType: 'project',
      note: 'Use compact operational layouts.',
      intent: 'usage',
      source: 'manual',
      createdAt: 1,
      updatedAt: 1,
    },
  ]);

  const added = await addProjectComponentNote(workspace, {
    componentId: 'component-data-table',
    note: 'Use sticky table controls for long data pages.',
    intent: 'usage',
  });
  await generateProjectDesignIndexFiles(workspace, {
    projectName: 'Fixture',
    catalog: null,
  });
  let browser = await loadProjectDesignSystemBrowser(workspace);
  expect(browser.agentNotes.map((note) => note.id).sort()).toEqual(
    [added.note.id, 'note-existing', 'note-project'].sort(),
  );

  await updateProjectComponentNote(workspace, {
    id: added.note.id,
    note: 'Prefer sticky table controls for long data pages.',
    intent: 'prefer',
  });
  browser = await loadProjectDesignSystemBrowser(workspace);
  expect(browser.agentNotes.find((note) => note.id === added.note.id)).toMatchObject({
    note: 'Prefer sticky table controls for long data pages.',
    intent: 'prefer',
  });

  await deleteProjectComponentNote(workspace, added.note.id);
  browser = await loadProjectDesignSystemBrowser(workspace);
  expect(browser.agentNotes.map((note) => note.id).sort()).toEqual([
    'note-existing',
    'note-project',
  ]);
});

async function createIndexedWorkspace() {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-design-system-browser-'));
  await mkdir(join(workspace, '.sber-designer', 'design-index'), { recursive: true });
  await writeJson(workspace, DESIGN_INDEX_PATHS.projectProfile, {
    packageManager: 'bun',
    frameworks: ['react', 'vite'],
    sourceRoots: ['src'],
    styling: ['tailwind'],
    aliases: { '@/*': ['src/*'] },
    packageScripts: {
      dev: 'vite --host 0.0.0.0',
      test: 'bun test',
    },
  });
  return workspace;
}

async function writeJson(workspace: string, filePath: string, value: unknown) {
  await writeFile(join(workspace, filePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeJsonl(workspace: string, filePath: string, records: unknown[]) {
  await writeFile(
    join(workspace, filePath),
    records.map((record) => JSON.stringify(record)).join('\n') + '\n',
    'utf8',
  );
}
