import { expect, test } from 'bun:test';
import type { ProjectScreen } from '@sber-designer/shared-types';

import {
  assistantRunsProposalRefreshKey,
  buildHtmlDesignSystemDistillationNudge,
  migrateCollapsedScreenFolder,
  normalizeScreensPanelSettings,
  pruneCollapsedScreenFolders,
  shouldShowHtmlDesignSystemApplyAction,
  shouldShowHtmlDesignSystemDistillAction,
  shouldShowDesignSystemReferenceAction,
  toggleCollapsedScreenFolder,
} from './screens-panel-state';

const screen = (id: string, folder?: string): ProjectScreen => ({
  id,
  name: id,
  kind: 'story',
  ...(folder ? { folder } : {}),
});

const page = (id: string, filePath: string): ProjectScreen => ({
  id,
  name: id,
  kind: 'page',
  filePath,
  implementationFilePath: filePath,
});

test('normalizeScreensPanelSettings removes blanks and duplicate folders', () => {
  expect(
    normalizeScreensPanelSettings({
      collapsedFolderNames: [' Archive ', 'Archive', '', '   ', 'Drafts'],
    }),
  ).toEqual({
    collapsedFolderNames: ['Archive', 'Ungrouped', 'Drafts'],
  });
});

test('toggleCollapsedScreenFolder adds and removes normalized folders', () => {
  expect(toggleCollapsedScreenFolder(undefined, ' Archive ')).toEqual({
    collapsedFolderNames: ['Archive'],
  });
  expect(
    toggleCollapsedScreenFolder({ collapsedFolderNames: ['Archive', 'Drafts'] }, 'Archive'),
  ).toEqual({
    collapsedFolderNames: ['Drafts'],
  });
});

test('migrateCollapsedScreenFolder moves collapsed state to a renamed folder', () => {
  expect(
    migrateCollapsedScreenFolder(
      { collapsedFolderNames: ['Archive', 'Drafts'] },
      'Archive',
      'Old flows',
    ),
  ).toEqual({
    collapsedFolderNames: ['Old flows', 'Drafts'],
  });
});

test('pruneCollapsedScreenFolders removes folders missing from project screens', () => {
  expect(
    pruneCollapsedScreenFolders({ collapsedFolderNames: ['Archive', 'Drafts', 'Ungrouped'] }, [
      screen('a', 'Drafts'),
      screen('b'),
    ]),
  ).toEqual({
    collapsedFolderNames: ['Drafts', 'Ungrouped'],
  });
});

test('assistantRunsProposalRefreshKey changes when assistant run lifecycle changes', () => {
  const running = assistantRunsProposalRefreshKey([
    {
      clientRunId: 'run-a',
      sessionId: 'session-a',
      screenId: 'screen-a',
      provider: 'mock',
      model: 'mock',
      status: 'running',
      startedAt: 10,
      updatedAt: 20,
    },
  ]);
  const complete = assistantRunsProposalRefreshKey([
    {
      clientRunId: 'run-a',
      sessionId: 'session-a',
      screenId: 'screen-a',
      provider: 'mock',
      model: 'mock',
      status: 'complete',
      startedAt: 10,
      updatedAt: 30,
    },
  ]);
  const cleared = assistantRunsProposalRefreshKey([]);

  expect(running).not.toBe(complete);
  expect(complete).not.toBe(cleared);
});

test('both project profiles keep style-contract reference extraction available', () => {
  expect(shouldShowDesignSystemReferenceAction('html-first')).toBe(true);
  expect(shouldShowDesignSystemReferenceAction('react-vite')).toBe(true);
  expect(shouldShowDesignSystemReferenceAction(null)).toBe(false);
});

test('html-first distillation nudge appears once after two pages in bootstrap mode', () => {
  const screens = [
    page('index', 'index.html'),
    page('design-system', 'pages/design-system.html'),
    page('deals', 'pages/deals.html'),
    page('request', 'pages/request.html'),
  ];
  const model = buildHtmlDesignSystemDistillationNudge({
    projectKind: 'html-first',
    screens,
    htmlDesignSystemStatus: 'bootstrap',
    proposalCount: 0,
  });

  expect(model.visible).toBe(true);
  expect(model.pageCount).toBe(2);
  expect(model.primaryLabel).toBe('Distill design system');
  expect(model.message).toContain('2 HTML pages');

  expect(
    buildHtmlDesignSystemDistillationNudge({
      projectKind: 'html-first',
      screens,
      htmlDesignSystemStatus: 'bootstrap',
      proposalCount: 0,
      dismissedKey: model.dismissKey,
    }).visible,
  ).toBe(false);
});

test('html-first distillation nudge stays quiet when connected, too early, or proposal exists', () => {
  const screens = [page('deals', 'pages/deals.html'), page('request', 'pages/request.html')];

  expect(
    buildHtmlDesignSystemDistillationNudge({
      projectKind: 'html-first',
      screens,
      htmlDesignSystemStatus: 'connected',
      proposalCount: 0,
    }).visible,
  ).toBe(false);
  expect(
    buildHtmlDesignSystemDistillationNudge({
      projectKind: 'html-first',
      screens: [screens[0]!],
      htmlDesignSystemStatus: 'bootstrap',
      proposalCount: 0,
    }).visible,
  ).toBe(false);
  expect(
    buildHtmlDesignSystemDistillationNudge({
      projectKind: 'html-first',
      screens,
      htmlDesignSystemStatus: 'bootstrap',
      proposalCount: 1,
    }).visible,
  ).toBe(false);
});

test('html-first distillation action is available from the panel when pages exist', () => {
  expect(
    shouldShowHtmlDesignSystemDistillAction('html-first', [page('deals', 'pages/deals.html')]),
  ).toBe(true);
  expect(
    shouldShowHtmlDesignSystemDistillAction(
      'html-first',
      [page('deals', 'pages/deals.html')],
      'connected',
    ),
  ).toBe(false);
  expect(shouldShowHtmlDesignSystemDistillAction('html-first', [page('index', 'index.html')])).toBe(
    false,
  );
  expect(
    shouldShowHtmlDesignSystemDistillAction('react-vite', [page('deals', 'pages/deals.html')]),
  ).toBe(false);
});

test('html-first apply design-system action appears only after a design system is connected', () => {
  const screens = [page('deals', 'pages/deals.html'), page('request', 'pages/request.html')];

  expect(shouldShowHtmlDesignSystemApplyAction('html-first', screens, 'connected')).toBe(true);
  expect(shouldShowHtmlDesignSystemApplyAction('html-first', screens, 'bootstrap')).toBe(false);
  expect(
    shouldShowHtmlDesignSystemApplyAction('html-first', [page('index', 'index.html')], 'connected'),
  ).toBe(false);
  expect(shouldShowHtmlDesignSystemApplyAction('react-vite', screens, 'connected')).toBe(false);
});

test('html-first apply design-system action accepts htm and uppercase html pages', () => {
  const screens = [page('deals', 'pages/deals.htm'), page('request', 'pages/REQUEST.HTML')];

  expect(shouldShowHtmlDesignSystemApplyAction('html-first', screens, 'connected')).toBe(true);
});
