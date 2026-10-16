import { expect, test } from 'bun:test';
import {
  DEFAULT_HTML_DESIGN_SYSTEM_PRESET_ID,
  HTML_DESIGN_SYSTEM_PRESETS,
} from '@sber-designer/shared-types';

import { buildNewProjectKindCopy, buildNewProjectPathModeModel } from './ConnectRepoDialog';

test('new project copy is mode-specific for react and html-first projects', () => {
  expect(buildNewProjectKindCopy('react-vite')).toMatchInlineSnapshot(`
    {
      "description": "Scaffold a React + Vite app for component-driven screens.",
      "footer": "First run can take ~30-60 s while dependencies install. Watch the steps list above.",
      "optionDetail": "Scaffold a React + Vite app for component-driven screens.",
      "toggleLabel": "Initialise Storybook 8 (recommended for component catalog indexing).",
    }
  `);

  const htmlCopy = buildNewProjectKindCopy('html-first');
  expect(htmlCopy).toMatchInlineSnapshot(`
    {
      "description": "Create a static HTML project with editable pages, Design.md, and CSS sources.",
      "footer": "HTML-first projects use the static preview immediately; no dependency install is required.",
      "optionDetail": "Create static HTML pages with Design.md and CSS sources.",
      "toggleLabel": "Create starter files: index.html, Design.md, tokens.css, components.css.",
    }
  `);
  expect(Object.values(htmlCopy).join(' ')).not.toMatch(/React|Vite|TypeScript|Storybook/);
});

test('HTML-first new project exposes the shared B3 preset registry', () => {
  expect(DEFAULT_HTML_DESIGN_SYSTEM_PRESET_ID).toBe('dense-enterprise');
  expect(HTML_DESIGN_SYSTEM_PRESETS.map((preset) => preset.id)).toEqual([
    'dense-enterprise',
    'calm-document',
    'dashboard-first',
  ]);
});

test('new project path mode defaults to direct writes and guards duplicate nesting', () => {
  expect(
    buildNewProjectPathModeModel({
      parentDir: '/tmp/projects/demo-project',
      name: 'Demo Project',
      createProjectSubfolder: false,
    }),
  ).toEqual({
    createProjectSubfolder: false,
    duplicateNestedPath: false,
    finalWorkspacePath: '/tmp/projects/demo-project',
    folderHint: 'Project files will be written directly into this folder.',
    modeHint: 'The selected folder must be empty except for system files.',
    subfolderLabel: 'Create subfolder',
  });
  expect(
    buildNewProjectPathModeModel({
      parentDir: '/tmp/projects/demo-project',
      name: 'Demo Project',
      createProjectSubfolder: false,
    }).subfolderLabel,
  ).not.toBe('Create subfolder named after project.');

  expect(
    buildNewProjectPathModeModel({
      parentDir: '/tmp/projects/demo-project',
      name: 'Demo Project',
      createProjectSubfolder: true,
    }),
  ).toMatchObject({
    createProjectSubfolder: true,
    duplicateNestedPath: true,
    finalWorkspacePath: '/tmp/projects/demo-project/demo-project',
    folderHint: 'A named subfolder will be created inside this folder.',
    modeHint: 'The selected folder is treated as a parent directory.',
    subfolderLabel: 'Create subfolder',
  });
});
