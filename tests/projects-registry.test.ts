import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  detectProjectType,
  readProjectsRegistry,
  removeProject,
} from '../services/api/src/projects-registry';

afterEach(() => {
  delete process.env.SBER_DESIGNER_PROJECTS_REGISTRY_PATH;
  delete process.env.SBER_DESIGNER_PROJECT_THUMBNAILS_DIR;
});

test('removeProject detaches legacy demo entries without deleting workspace metadata', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sber-designer-registry-'));
  const workspacePath = join(root, 'demo-project');
  const projectDir = join(workspacePath, '.sber-designer');
  const projectPath = join(projectDir, 'project.sdproj');
  const registryPath = join(root, 'projects.json');

  await mkdir(projectDir, { recursive: true });
  await writeFile(
    projectPath,
    JSON.stringify({
      version: 1,
      name: 'Demo project',
      workspacePath,
      screens: [],
      flow: [],
    }),
  );
  await writeFile(
    registryPath,
    JSON.stringify({
      version: 1,
      projects: [
        {
          id: 'demo-investment-crm',
          name: 'Demo project',
          workspacePath,
          lastOpenedAt: 2,
          createdAt: 1,
          isDemo: true,
        },
      ],
    }),
  );

  process.env.SBER_DESIGNER_PROJECTS_REGISTRY_PATH = registryPath;
  process.env.SBER_DESIGNER_PROJECT_THUMBNAILS_DIR = join(root, 'thumbnails');

  await expect(removeProject('demo-investment-crm')).resolves.toBe(true);
  await expect(readProjectsRegistry()).resolves.toEqual({ version: 1, projects: [] });
  await expect(readFile(projectPath, 'utf8')).resolves.toContain('Demo project');
});

test('detectProjectType distinguishes Storybook, HTML-first, and plain React projects', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sber-designer-project-types-'));
  const storybook = join(root, 'storybook');
  const html = join(root, 'html');
  const react = join(root, 'react');

  await Promise.all([
    mkdir(join(storybook, '.storybook'), { recursive: true }),
    mkdir(join(html, '.sber-designer'), { recursive: true }),
    mkdir(react, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(
      join(storybook, 'package.json'),
      JSON.stringify({ dependencies: { react: '^19.0.0', storybook: '^8.0.0' } }),
    ),
    writeFile(
      join(html, '.sber-designer', 'project.sdproj'),
      JSON.stringify({
        version: 1,
        name: 'HTML project',
        workspacePath: html,
        projectKind: 'html-first',
        screens: [],
        flow: [],
      }),
    ),
    writeFile(join(react, 'package.json'), JSON.stringify({ dependencies: { react: '^19.0.0' } })),
  ]);

  await expect(detectProjectType(storybook)).resolves.toBe('storybook');
  await expect(detectProjectType(html)).resolves.toBe('html');
  await expect(detectProjectType(react)).resolves.toBe('react');
});
