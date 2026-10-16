import { expect, test } from 'bun:test';
import type { SberDesignerProject } from '@sber-designer/shared-types';

import { shouldAdoptFetchedProject, shouldMirrorSessionWorkspacePath } from './project-adoption';

function project(workspacePath: string, name = 'Project'): SberDesignerProject {
  return { version: 1, name, workspacePath, screens: [], flow: [] };
}

test('adopts fetched project when the page has none yet', () => {
  expect(shouldAdoptFetchedProject(null, project('/repos/a'))).toBe(true);
  expect(shouldAdoptFetchedProject(undefined, project('/repos/a'))).toBe(true);
});

test('adopts fetched project when the page project has no workspace yet', () => {
  expect(shouldAdoptFetchedProject(project(''), project('/repos/a'))).toBe(true);
});

test('adopts fetched project for the same workspace', () => {
  expect(shouldAdoptFetchedProject(project('/repos/a'), project('/repos/a', 'Renamed'))).toBe(true);
});

test('rejects fetched project from another workspace', () => {
  // 2026-06-12 corruption: a stale ibp-ui-kit page adopted the newly
  // active demo project and autosaved it into ibp-ui-kit's sdproj.
  expect(shouldAdoptFetchedProject(project('/repos/ibp-ui-kit'), project('/repos/demo'))).toBe(
    false,
  );
});

test('mirrors the session workspace path only into a path-less project', () => {
  expect(shouldMirrorSessionWorkspacePath(project(''), '/repos/a')).toBe(true);
});

test('does not mirror when the project already names a workspace', () => {
  expect(shouldMirrorSessionWorkspacePath(project('/repos/a'), '/repos/a')).toBe(false);
  expect(shouldMirrorSessionWorkspacePath(project('/repos/demo'), '/repos/ibp-ui-kit')).toBe(false);
});

test('does not mirror without a project or session path', () => {
  expect(shouldMirrorSessionWorkspacePath(null, '/repos/a')).toBe(false);
  expect(shouldMirrorSessionWorkspacePath(project(''), null)).toBe(false);
  expect(shouldMirrorSessionWorkspacePath(project(''), '')).toBe(false);
});
