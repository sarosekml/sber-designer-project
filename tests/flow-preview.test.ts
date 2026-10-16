import { expect, test } from 'bun:test';
import type { ProjectScreen } from '@sber-designer/shared-types';

import {
  absoluteFlowPreviewUrl,
  currentFlowPreviewCapture,
  flowPreviewImageSrc,
  flowScreenPreviewFingerprint,
} from '../apps/web/src/lib/flow-preview';
import { livePreviewScreenIds } from '../apps/web/src/lib/flow-preview-visibility';
import { normalizeFlowView } from '../apps/web/src/lib/flow-view';

const dashboard: ProjectScreen = {
  id: 'screen-dashboard',
  name: 'Dashboard',
  kind: 'story',
  storyId: 'screens-dashboard--default',
  filePath: 'src/stories/screens/Dashboard.stories.tsx',
  implementationFilePath: 'src/screens/Dashboard.tsx',
  description: 'Designer notes do not make the screenshot stale.',
};

test('flowScreenPreviewFingerprint tracks render source fields but ignores notes', () => {
  const first = flowScreenPreviewFingerprint(dashboard);
  const withNewNotes = flowScreenPreviewFingerprint({
    ...dashboard,
    description: 'Different notes',
  });
  const withNewStory = flowScreenPreviewFingerprint({
    ...dashboard,
    storyId: 'screens-dashboard--empty',
  });

  expect(withNewNotes).toBe(first);
  expect(withNewStory).not.toBe(first);
});

test('currentFlowPreviewCapture returns fresh cached capture and marks stale metadata', () => {
  const freshFingerprint = flowScreenPreviewFingerprint(dashboard);
  const view = normalizeFlowView({
    previewCaptures: [
      {
        screenId: dashboard.id,
        imagePath: '.sber-designer/previews/screens/screen-dashboard.png',
        viewport: { width: 1280, height: 720 },
        capturedAt: 10,
        sourceFingerprint: freshFingerprint,
      },
      {
        screenId: 'screen-other',
        imagePath: '.sber-designer/previews/screens/screen-other.png',
        viewport: { width: 1280, height: 720 },
        capturedAt: 11,
        sourceFingerprint: 'other',
      },
    ],
  });

  expect(currentFlowPreviewCapture(view, dashboard)).toMatchObject({
    capture: {
      imagePath: '.sber-designer/previews/screens/screen-dashboard.png',
      sourceFingerprint: freshFingerprint,
    },
    stale: false,
  });

  expect(
    currentFlowPreviewCapture(view, { ...dashboard, storyId: 'screens-dashboard--empty' }),
  ).toMatchObject({ stale: true });
});

test('flowPreviewImageSrc serves workspace capture paths through the API route', () => {
  expect(flowPreviewImageSrc('.sber-designer/previews/screens/screen-dashboard.png', 123)).toBe(
    'http://localhost:3000/api/flow/previews/screens/screen-dashboard.png?v=123',
  );

  expect(flowPreviewImageSrc('data:image/png;base64,AA==')).toBe('data:image/png;base64,AA==');
});

test('absoluteFlowPreviewUrl makes relative fallback previews valid for capture API', () => {
  expect(absoluteFlowPreviewUrl('/demo-target/index.html', 'http://localhost:5175')).toBe(
    'http://localhost:5175/demo-target/index.html',
  );
  expect(absoluteFlowPreviewUrl('http://localhost:3000/api/preview/iframe.html')).toBe(
    'http://localhost:3000/api/preview/iframe.html',
  );
});

test('livePreviewScreenIds mounts only frames intersecting viewport and allows initial unknown viewport', () => {
  const nodes = [
    { id: 'a', x: 0, y: 0, width: 420, height: 304 },
    { id: 'b', x: 1200, y: 0, width: 420, height: 304 },
  ];

  expect(
    livePreviewScreenIds(nodes, {
      x: 0,
      y: 0,
      zoom: 1,
      width: 800,
      height: 600,
      buffer: 80,
    }),
  ).toEqual(new Set(['a']));

  expect(
    livePreviewScreenIds(nodes, {
      x: 0,
      y: 0,
      zoom: 1,
      width: 0,
      height: 0,
      buffer: 80,
    }),
  ).toEqual(new Set(['a', 'b']));
});
