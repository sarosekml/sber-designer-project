/**
 * 0132.0 — surface transport regression. A screen's `surface` must survive
 * every `.sdproj` round-trip and projection, `page` must serialize exactly as
 * before the field existed (old readers unaffected), and `modal` must persist.
 */
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'bun:test';
import { screenSurface } from '@sber-designer/shared-types';

import {
  ProjectSchema,
  canonicalizeScreenSurfaceForSave,
  loadProjectForWorkspace,
  saveProject,
} from '../services/api/src/project-store';
import { compactActiveScreen } from '../services/api/src/agent/run-record/store';
import { buildScreenGenerationInfo } from '../services/api/src/routes/screen-info';

test('ScreenSchema accepts an optional modal surface', () => {
  const parsed = ProjectSchema.parse({
    version: 1,
    name: 'Surface schema project',
    workspacePath: '/workspace',
    screens: [
      { id: 'screen-page', name: 'List', kind: 'page', filePath: 'pages/list.html' },
      {
        id: 'screen-modal',
        name: 'Delete confirm',
        kind: 'page',
        surface: 'modal',
        filePath: 'pages/delete-confirm.html',
      },
    ],
    flow: [],
  });

  expect(screenSurface(parsed.screens[0])).toBe('page');
  expect(screenSurface(parsed.screens[1])).toBe('modal');
});

test('old .sdproj without surface loads as a page (additive/ignorable field)', () => {
  const parsed = ProjectSchema.parse({
    version: 1,
    name: 'Legacy project',
    workspacePath: '/workspace',
    screens: [{ id: 'screen-a', name: 'Screen A', kind: 'story', storyId: 'screens-a--default' }],
    flow: [],
  });
  expect(parsed.screens[0]?.surface).toBeUndefined();
  expect(screenSurface(parsed.screens[0])).toBe('page');
});

test('canonicalizeScreenSurfaceForSave keeps modal explicit and drops page', () => {
  expect(
    canonicalizeScreenSurfaceForSave({ id: 'm', name: 'M', kind: 'page', surface: 'modal' }),
  ).toHaveProperty('surface', 'modal');
  expect(
    canonicalizeScreenSurfaceForSave({ id: 'p', name: 'P', kind: 'page', surface: 'page' }),
  ).not.toHaveProperty('surface');
  expect(canonicalizeScreenSurfaceForSave({ id: 'n', name: 'N', kind: 'page' })).not.toHaveProperty(
    'surface',
  );
});

test('save/load round-trips a modal on disk and never writes surface for a page', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-modal-surface-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  await saveProject({
    version: 1,
    name: 'Modal round-trip project',
    workspacePath: workspace,
    screens: [
      { id: 'screen-list', name: 'List', kind: 'page', filePath: 'pages/list.html' },
      // A redundant `surface: 'page'` from a caller must be stripped on write.
      {
        id: 'screen-detail',
        name: 'Detail',
        kind: 'page',
        surface: 'page',
        filePath: 'pages/detail.html',
      },
      {
        id: 'screen-modal',
        name: 'Delete confirm',
        kind: 'page',
        surface: 'modal',
        filePath: 'pages/delete-confirm.html',
      },
    ],
    flow: [],
  });

  const raw = await readFile(join(workspace, '.sber-designer', 'project.sdproj'), 'utf8');
  const onDisk = JSON.parse(raw) as {
    screens: { id: string; surface?: string }[];
  };
  const bySurface = Object.fromEntries(onDisk.screens.map((s) => [s.id, s.surface]));
  expect(bySurface['screen-list']).toBeUndefined();
  expect(bySurface['screen-detail']).toBeUndefined();
  expect(bySurface['screen-modal']).toBe('modal');

  const loaded = await loadProjectForWorkspace(workspace);
  expect(screenSurface(loaded.screens.find((s) => s.id === 'screen-modal'))).toBe('modal');
  expect(screenSurface(loaded.screens.find((s) => s.id === 'screen-detail'))).toBe('page');
});

test('compact run-record active-screen projection carries a modal surface', () => {
  expect(
    compactActiveScreen({ id: 's', name: 'Delete confirm', kind: 'page', surface: 'modal' }),
  ).toMatchObject({ surface: 'modal' });
  expect(compactActiveScreen({ id: 's', name: 'List', kind: 'page' })).not.toHaveProperty(
    'surface',
  );
});

test('generation-info projection carries the modal surface explicitly', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-modal-geninfo-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const info = await buildScreenGenerationInfo({
    workspacePath: workspace,
    screen: {
      id: 'screen-modal',
      name: 'Delete confirm',
      kind: 'page',
      surface: 'modal',
      filePath: 'pages/delete-confirm.html',
    },
  });
  expect(info.screen.surface).toBe('modal');
});
