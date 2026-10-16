import { expect, test } from 'bun:test';

import { injectPreviewBridge } from '../services/api/src/routes/preview';

test('preview bridge includes live inspect selection and preview style protocol', () => {
  const html = injectPreviewBridge('<html><body><main></main></body></html>');

  expect(html).toContain('data-sd-inspect-id');
  expect(html).toContain('data-sber-designer-inspect-preview');
  expect(html).toContain('computedStyleSnapshot');
  expect(html).toContain('isUsableTestId');
  expect(html).toContain('name === "data-testid" && !isUsableTestId(value)');
  expect(html).toContain('sber-designer:preview-style');
  expect(html).toContain('sber-designer:preview-style-applied');
  expect(html).toContain('sber-designer:reset-preview-style');
});

test('preview bridge uses an override stylesheet rather than inline style mutation', () => {
  const html = injectPreviewBridge('<html><body><main></main></body></html>');

  expect(html).toContain('inspectOverrideStyles');
  expect(html).toContain('!important');
  expect(html).not.toContain('element.style.setProperty');
});
