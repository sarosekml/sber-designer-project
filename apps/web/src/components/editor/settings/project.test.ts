import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

import { buildComponentDescriptionSettingsModel } from './project';

test('component description settings enable the interview for html-first projects', () => {
  const model = buildComponentDescriptionSettingsModel({
    projectKind: 'html-first',
    describedComponents: 1,
    totalComponents: 4,
  });

  expect(model.title).toBe('Describe components for AI');
  expect(model.badgeLabel).toBe('1 / 4 described');
  expect(model.description).toContain('reusable CSS components');
  expect(model.description).toContain('System-level rules live in Design.md');
  expect(model.showInterviewAction).toBe(true);
});

test('component description settings keep the interview for component projects', () => {
  const model = buildComponentDescriptionSettingsModel({
    projectKind: 'react-vite',
    describedComponents: 2,
    totalComponents: 5,
  });

  expect(model.title).toBe('Describe components for AI');
  expect(model.badgeLabel).toBe('2 / 5 described');
  expect(model.showInterviewAction).toBe(true);
});

test('project settings exposes a persisted project style memory kill-switch', async () => {
  const source = await readFile('apps/web/src/components/editor/settings/project.tsx', 'utf8');

  expect(source).toContain('Project style memory');
  expect(source).toContain('isProjectStyleMemoryEnabled(project)');
  expect(source).toContain('styleMemoryEnabled: enabled');
  expect(source).toContain('Turning this off keeps the project memory files unchanged.');
});

test('project settings exposes the non-canonical HTML restructure entry', async () => {
  const source = await readFile('apps/web/src/components/editor/settings/project.tsx', 'utf8');

  expect(source).toContain('Restructure HTML project');
  expect(source).toContain("htmlDesignSystem?.status === 'non-canonical'");
  expect(source).toContain('startProjectRestructure');
});
