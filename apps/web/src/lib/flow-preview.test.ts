import { expect, test } from 'bun:test';
import type { ProjectScreen } from '@sber-designer/shared-types';

import { flowScreenPreviewFingerprint } from './flow-preview';

const base: ProjectScreen = {
  id: 'screen-a',
  name: 'Delete confirm',
  kind: 'page',
  filePath: 'pages/delete-confirm.html',
};

test('preview fingerprint changes when a screen is converted page↔modal', () => {
  const asPage = flowScreenPreviewFingerprint(base);
  const asModal = flowScreenPreviewFingerprint({ ...base, surface: 'modal' });
  expect(asPage).not.toBe(asModal);
});

test('absent surface fingerprints identically to explicit page', () => {
  const absent = flowScreenPreviewFingerprint(base);
  const explicitPage = flowScreenPreviewFingerprint({ ...base, surface: 'page' });
  expect(absent).toBe(explicitPage);
});
