import { expect, test } from 'bun:test';

import {
  buildFlowPreviewCaptureRecord,
  flowPreviewCapturePath,
  normalizeCaptureScreenId,
} from '../services/api/src/flow-preview-capture';

test('flow preview capture paths stay inside the managed preview directory', () => {
  expect(normalizeCaptureScreenId('screen-dashboard')).toBe('screen-dashboard');
  expect(flowPreviewCapturePath('screen-dashboard')).toBe(
    '.sber-designer/previews/screens/screen-dashboard.png',
  );

  expect(() => normalizeCaptureScreenId('../secret')).toThrow('Invalid screen id');
});

test('buildFlowPreviewCaptureRecord stores metadata needed for stale checks', () => {
  expect(
    buildFlowPreviewCaptureRecord({
      screenId: 'screen-dashboard',
      viewport: { width: 1280, height: 720 },
      capturedAt: 42,
      sourceFingerprint: 'fingerprint-1',
    }),
  ).toEqual({
    screenId: 'screen-dashboard',
    imagePath: '.sber-designer/previews/screens/screen-dashboard.png',
    viewport: { width: 1280, height: 720 },
    capturedAt: 42,
    sourceFingerprint: 'fingerprint-1',
  });
});
