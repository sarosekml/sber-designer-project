import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'bun:test';

import { scanProjectProfile } from '@sber-designer/design-indexer';

import { bootstrapProject, ensureScaffoldGitignore } from '../services/api/src/scaffolder';
import { ProjectSchema } from '../services/api/src/project-store';
import { prepareSandboxSessionRequest } from '../services/api/src/routes/sandbox';

test('project schema accepts explicit html-first project kind', () => {
  const parsed = ProjectSchema.parse({
    version: 1,
    name: 'Static site',
    workspacePath: '/workspace/static-site',
    projectKind: 'html-first',
    screens: [],
    flow: [],
  });

  expect(parsed.projectKind).toBe('html-first');
});

test('html-first scaffold writes project metadata and optional starter files without package scripts', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'sd-html-first-parent-'));

  const result = await bootstrapProject({
    parentDir: parent,
    name: 'Landing Prototype',
    projectKind: 'html-first',
    createStarterFiles: true,
  });

  const projectFile = JSON.parse(
    await readFile(join(result.workspacePath, '.sber-designer/project.sdproj'), 'utf8'),
  );
  expect(projectFile).toMatchObject({
    version: 1,
    name: 'landing-prototype',
    projectKind: 'html-first',
    workspacePath: result.workspacePath,
    screens: [
      {
        id: 'index',
        name: 'Index',
        kind: 'page',
        filePath: 'index.html',
        implementationFilePath: 'index.html',
      },
    ],
    flow: [],
  });
  const indexHtml = await readFile(join(result.workspacePath, 'index.html'), 'utf8');
  expect(indexHtml).toContain('data-sd-screen-root');
  expect(indexHtml).toContain('data-sd-managed-screen-index');
  expect(indexHtml).toContain('Screens Index');
  expect(indexHtml).not.toContain('Create static pages, connect a design system');
  const designMd = await readFile(join(result.workspacePath, 'design-system', 'Design.md'), 'utf8');
  expect(designMd).toContain('## 1. Visual Theme & Atmosphere');
  expect(designMd).toContain('## 4. Component Stylings');
  expect(designMd).toContain('## 9. Agent Prompt Guide');
  expect(indexHtml).toContain('./design-system/tokens.css');
  expect(indexHtml).toContain('./design-system/components.css');
  expect(
    await readFile(join(result.workspacePath, 'design-system', 'index.html'), 'utf8'),
  ).toContain('data-sd-managed-design-system-preview');
  expect(
    await readFile(join(result.workspacePath, 'design-system', 'refs', 'README.md'), 'utf8'),
  ).toContain('Design system references');
  expect(
    await readFile(
      join(result.workspacePath, 'design-system', 'refs', 'starter-components.html'),
      'utf8',
    ),
  ).toContain('button--primary');
  expect(await readFile(join(result.workspacePath, '.gitignore'), 'utf8')).toContain(
    '.sber-designer/runs/',
  );
  await expect(stat(join(result.workspacePath, 'package.json'))).rejects.toThrow();
  expect(result.steps.map((step) => step.name)).toEqual([
    'create-html-first',
    'starter-files',
    'git-init',
  ]);
});

test('html-first scaffold can write directly into the selected empty folder', async () => {
  const target = await mkdtemp(join(tmpdir(), 'sd-html-first-direct-'));

  const result = await bootstrapProject({
    parentDir: target,
    name: 'Direct Static',
    projectKind: 'html-first',
    createStarterFiles: true,
    createProjectSubfolder: false,
  });

  expect(result.workspacePath).toBe(resolve(target));
  const projectFile = JSON.parse(
    await readFile(join(target, '.sber-designer/project.sdproj'), 'utf8'),
  );
  expect(projectFile).toMatchObject({
    name: 'direct-static',
    workspacePath: resolve(target),
    projectKind: 'html-first',
  });
  expect(await readFile(join(target, 'index.html'), 'utf8')).toContain('data-sd-screen-root');
  await expect(stat(join(target, 'direct-static', 'index.html'))).rejects.toThrow();
});

test('html-first direct scaffold refuses to overwrite a non-empty selected folder', async () => {
  const target = await mkdtemp(join(tmpdir(), 'sd-html-first-direct-non-empty-'));
  await writeFile(join(target, 'existing.txt'), 'keep me', 'utf8');

  await expect(
    bootstrapProject({
      parentDir: target,
      name: 'Direct Static',
      projectKind: 'html-first',
      createStarterFiles: true,
      createProjectSubfolder: false,
    }),
  ).rejects.toThrow(/non-empty selected folder/);
});

test('html-first project metadata makes profile and sandbox request use static html', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'sd-html-first-empty-parent-'));
  const result = await bootstrapProject({
    parentDir: parent,
    name: 'Blank Static',
    projectKind: 'html-first',
    createStarterFiles: false,
  });

  const profile = await scanProjectProfile(result.workspacePath);
  expect(profile).toMatchObject({
    kind: 'html-css',
    componentModel: 'css-catalog',
    renderProbe: 'static-html',
  });

  const request = await prepareSandboxSessionRequest(
    JSON.stringify({ workspacePath: result.workspacePath }),
  );
  expect(JSON.parse(request)).toMatchObject({
    workspacePath: result.workspacePath,
    command: 'static-html',
    args: [],
  });
});

test('React scaffold gitignore keeps project truth and ignores only run evidence', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-react-gitignore-'));
  const gitignorePath = join(workspace, '.gitignore');
  await writeFile(gitignorePath, 'node_modules\ndist\n', 'utf8');

  await ensureScaffoldGitignore(workspace);
  await ensureScaffoldGitignore(workspace);

  const gitignore = await readFile(gitignorePath, 'utf8');
  expect(gitignore).toBe('node_modules\ndist\n.sber-designer/runs/\n');
  expect(gitignore).not.toContain('project.sdproj');
  expect(gitignore).not.toContain('Design.md');
});
