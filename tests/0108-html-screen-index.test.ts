import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { probeStaticHtmlRender } from '../services/api/src/agent-runtimes/static-html-render-probe';
import { bootstrapProject } from '../services/api/src/scaffolder';
import { buildSystemPrompt } from '../services/api/src/prompt-builder';
import { loadProjectForWorkspace, saveProject } from '../services/api/src/project-store';
import { patchState, resetState } from '../services/api/src/state-store';

test('html-first project save syncs Screens Index links on create, rename, and delete', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'sd-html-index-sync-'));
  const result = await bootstrapProject({
    parentDir: parent,
    name: 'Index Sync',
    projectKind: 'html-first',
    createStarterFiles: true,
  });
  const project = await loadProjectForWorkspace(result.workspacePath, 'Index Sync');

  const withPages = await saveProject({
    ...project,
    screens: [
      ...project.screens,
      {
        id: 'design-system',
        name: 'Design System',
        kind: 'page',
        filePath: 'pages/design-system.html',
        implementationFilePath: 'pages/design-system.html',
        description: 'Reference page for tokens and components.',
      },
      {
        id: 'deal-page',
        name: 'Corporate request 1344',
        kind: 'page',
        filePath: 'pages/deal-page.html',
        implementationFilePath: 'pages/deal-page.html',
        description: 'Detailed request workspace generated from a Markdown brief.',
      },
    ],
  });

  let indexHtml = await readFile(join(result.workspacePath, 'index.html'), 'utf8');
  expect(indexHtml).toContain('href="./pages/design-system.html"');
  expect(indexHtml).toContain('Reference page for tokens and components.');
  expect(indexHtml).toContain('href="./pages/deal-page.html"');
  expect(indexHtml).toContain('Corporate request 1344');
  expect(indexHtml).not.toContain('href="./index.html"');

  const renamed = await saveProject({
    ...withPages,
    screens: withPages.screens.map((screen) =>
      screen.id === 'deal-page'
        ? {
            ...screen,
            name: 'Deal Details',
            description: 'Renamed request workspace.',
          }
        : screen,
    ),
  });

  indexHtml = await readFile(join(result.workspacePath, 'index.html'), 'utf8');
  expect(indexHtml).toContain('Deal Details');
  expect(indexHtml).toContain('Renamed request workspace.');
  expect(indexHtml).not.toContain('Corporate request 1344');

  await saveProject({
    ...renamed,
    screens: renamed.screens.filter((screen) => screen.id !== 'design-system'),
  });

  indexHtml = await readFile(join(result.workspacePath, 'index.html'), 'utf8');
  expect(indexHtml).not.toContain('pages/design-system.html');
  expect(indexHtml).toContain('pages/deal-page.html');

  const health = await probeStaticHtmlRender({
    url: 'http://static.local/index.html',
    fetchImpl: async () => new Response(indexHtml, { status: 200 }),
  });
  expect(health.status).toBe('ok');
});

test('html-first project save survives Screens Index sync failures', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-html-index-failure-'));
  await mkdir(join(workspace, 'index.html'), { recursive: true });

  const saved = await saveProject({
    version: 1,
    name: 'Index Failure',
    projectKind: 'html-first',
    workspacePath: workspace,
    screens: [
      {
        id: 'dashboard',
        name: 'Dashboard',
        kind: 'page',
        filePath: 'pages/dashboard.html',
        implementationFilePath: 'pages/dashboard.html',
      },
    ],
    flow: [],
  });

  expect(saved.name).toBe('Index Failure');
  const reloaded = await loadProjectForWorkspace(workspace, 'Index Failure');
  expect(reloaded.screens.map((screen) => screen.id)).toContain('dashboard');
});

test('html-first Screens Index sync preserves custom content outside the managed block', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'sd-html-index-custom-'));
  const result = await bootstrapProject({
    parentDir: parent,
    name: 'Custom Index',
    projectKind: 'html-first',
    createStarterFiles: true,
  });
  const project = await loadProjectForWorkspace(result.workspacePath, 'Custom Index');
  const indexPath = join(result.workspacePath, 'index.html');
  const original = await readFile(indexPath, 'utf8');
  await writeFile(
    indexPath,
    original.replace(
      '</main>',
      '<section id="custom-note">Keep this project note.</section>\n    </main>',
    ),
    'utf8',
  );

  await saveProject({
    ...project,
    screens: [
      ...project.screens,
      {
        id: 'dashboard',
        name: 'Dashboard',
        kind: 'page',
        filePath: 'pages/dashboard.html',
        implementationFilePath: 'pages/dashboard.html',
        description: 'Main operational dashboard.',
      },
    ],
  });

  const indexHtml = await readFile(indexPath, 'utf8');
  expect(indexHtml).toContain('id="custom-note"');
  expect(indexHtml).toContain('Keep this project note.');
  expect(indexHtml).toContain('href="./pages/dashboard.html"');
  expect(indexHtml).toContain('Main operational dashboard.');
});

test('html-first system prompt keeps generated screens out of index.html by default', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'sd-html-index-prompt-'));
  const result = await bootstrapProject({
    parentDir: parent,
    name: 'Prompt Index',
    projectKind: 'html-first',
    createStarterFiles: true,
  });
  await loadProjectForWorkspace(result.workspacePath, 'Prompt Index');

  resetState();
  patchState({
    mode: 'interact',
    workspacePath: result.workspacePath,
    activeScreen: {
      id: 'dashboard',
      name: 'Dashboard',
      kind: 'page',
      filePath: 'pages/dashboard.html',
      implementationFilePath: 'pages/dashboard.html',
    },
  });

  const prompt = await buildSystemPrompt();

  expect(prompt.text).toContain('## HTML/CSS Project Profile Contract');
  expect(prompt.text).toContain(
    '`../design-system/tokens.css` and `../design-system/components.css`',
  );
  expect(prompt.text).toContain('Reference-backed content from the attached image.');
  expect(prompt.text).toContain('Do not leave placeholder assets');
  expect(prompt.text).toContain('htmlScreenIndexContract');
  expect(prompt.text).toContain('`index.html` is the managed Screens Index/project home');
  expect(prompt.text).toContain('create or edit `pages/<slug>.html`');
  expect(prompt.text).not.toContain('production React UI');
  expect(prompt.text).not.toContain('generatedScreenConvention: keep Storybook files');
});
