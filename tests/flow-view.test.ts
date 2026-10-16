import { expect, test } from 'bun:test';
import type { ProjectFlowEdge, ProjectScreen } from '@sber-designer/shared-types';

import {
  migrateHiddenFlowFolder,
  normalizeFlowView,
  toggleFlowEdgeHidden,
  toggleFlowFolderHidden,
  toggleFlowScreenHidden,
  visibleFlowEdges,
  visibleFlowScreens,
} from '../apps/web/src/lib/flow-view';

const dashboard: ProjectScreen = {
  id: 'dashboard',
  name: 'Dashboard',
  kind: 'story',
  storyId: 'screens-dashboard--default',
  folder: 'Core',
};

const detail: ProjectScreen = {
  id: 'detail',
  name: 'Detail',
  kind: 'story',
  storyId: 'screens-detail--default',
  folder: 'Core',
};

const settings: ProjectScreen = {
  id: 'settings',
  name: 'Settings',
  kind: 'story',
  storyId: 'screens-settings--default',
  folder: 'Admin',
};

const dashboardToDetail: ProjectFlowEdge = {
  id: 'edge-dashboard-detail',
  fromScreenId: dashboard.id,
  toScreenId: detail.id,
  trigger: { kind: 'click', label: 'Open' },
};

const detailToSettings: ProjectFlowEdge = {
  id: 'edge-detail-settings',
  fromScreenId: detail.id,
  toScreenId: settings.id,
  trigger: { kind: 'click', label: 'Settings' },
};

test('normalizeFlowView fills designer-facing defaults', () => {
  expect(normalizeFlowView(undefined)).toEqual({
    previewSize: 'compact',
    showConnections: true,
    showDescriptions: false,
    hiddenScreenIds: [],
    hiddenFolderNames: [],
    hiddenEdgeIds: [],
    previewViewport: { width: 1280, height: 720 },
    previewCaptures: [],
  });
});

test('visibleFlowScreens hides individual screens and folders without mutating source screens', () => {
  const screens = [dashboard, detail, settings];
  const view = normalizeFlowView({
    hiddenScreenIds: [detail.id],
    hiddenFolderNames: ['Admin'],
  });

  expect(visibleFlowScreens(screens, view).map((screen) => screen.id)).toEqual([dashboard.id]);
  expect(screens.map((screen) => screen.id)).toEqual([dashboard.id, detail.id, settings.id]);
});

test('visibleFlowEdges hides connections by global switch, edge id, and hidden endpoints', () => {
  const screens = [dashboard, detail, settings];
  const edges = [dashboardToDetail, detailToSettings];

  expect(
    visibleFlowEdges(edges, screens, {
      ...normalizeFlowView({ hiddenEdgeIds: [dashboardToDetail.id] }),
    }).map((edge) => edge.id),
  ).toEqual([detailToSettings.id]);

  expect(
    visibleFlowEdges(edges, screens, normalizeFlowView({ hiddenScreenIds: [settings.id] })).map(
      (edge) => edge.id,
    ),
  ).toEqual([dashboardToDetail.id]);

  expect(visibleFlowEdges(edges, screens, normalizeFlowView({ showConnections: false }))).toEqual(
    [],
  );
});

test('toggle helpers preserve normalized flow view arrays', () => {
  const first = toggleFlowScreenHidden(undefined, dashboard.id);
  expect(first.hiddenScreenIds).toEqual([dashboard.id]);
  expect(toggleFlowScreenHidden(first, dashboard.id).hiddenScreenIds).toEqual([]);

  const folderHidden = toggleFlowFolderHidden(undefined, 'Core');
  expect(folderHidden.hiddenFolderNames).toEqual(['Core']);
  expect(migrateHiddenFlowFolder(folderHidden, 'Core', 'Main').hiddenFolderNames).toEqual(['Main']);

  const edgeHidden = toggleFlowEdgeHidden(undefined, dashboardToDetail.id);
  expect(edgeHidden.hiddenEdgeIds).toEqual([dashboardToDetail.id]);
  expect(toggleFlowEdgeHidden(edgeHidden, dashboardToDetail.id).hiddenEdgeIds).toEqual([]);
});
