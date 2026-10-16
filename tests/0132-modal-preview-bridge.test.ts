import { expect, test } from 'bun:test';

import { injectPreviewBridge } from '../services/api/src/routes/preview';

test('preview bridge exposes managed modal read, preview, reset, and standalone actions', () => {
  const html = injectPreviewBridge('<html><body><main></main></body></html>');

  expect(html).toContain('sber-designer:modal-contract');
  expect(html).toContain('sber-designer:modal-contract-result');
  expect(html).toContain('modalPreviewBaseline');
  expect(html).toContain('data.action === "preview"');
  expect(html).toContain('data.action === "reset"');
  expect(html).toContain('data.action === "standalone"');
  expect(html).toContain('sber-designer-standalone-modal-preview');
});

test('preview bridge carries reused-modal preference, Escape, and initial focus', () => {
  const html = injectPreviewBridge('<html><body><main></main></body></html>');

  expect(html).toContain('flowRuntimePreferToScreenId');
  expect(html).toContain('edge.toScreenId === flowRuntimePreferToScreenId');
  expect(html).toContain('sber-designer:flow-runtime-escape');
  expect(html).toContain('data.focusModal === true');
});
