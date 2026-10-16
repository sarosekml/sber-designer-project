import { expect, test } from 'bun:test';

import { injectPreviewBridge } from '../services/api/src/routes/preview';

test('preview bridge answers Mark-layer snapshot requests', () => {
  const html = injectPreviewBridge('<html><body><main></main></body></html>');

  expect(html).toContain('sber-designer:snapshot');
  expect(html).toContain('sber-designer:snapshot-result');
  expect(html).toContain('captureViewportSnapshot');
  // Uniform bitmaps are reported as errors, not shipped as blank frames.
  expect(html).toContain('empty-render');
});

test('preview bridge rasterizes through inlined html-to-image with a fallback', () => {
  const html = injectPreviewBridge('<html><body><main></main></body></html>');

  // The MIT html-to-image UMD bundle is inlined by the proxy (no CDN — the
  // editor must work in protected deployments) and is the primary renderer.
  expect(html).toContain('data-sd-rasterizer');
  expect(html).toContain('htmlToImage');
  expect(html).toContain('captureViaHtmlToImage');
  // The hand-rolled foreignObject serializer stays as the fallback path.
  expect(html).toContain('captureViaForeignObject');
  expect(html).toContain('foreignObject');
  expect(html).toContain('snapshotInlineStyles');
});

test('preview bridge forwards Mark-layer scroll deltas to the page', () => {
  const html = injectPreviewBridge('<html><body><main></main></body></html>');

  expect(html).toContain('sber-designer:scroll-by');
  expect(html).toContain('window.scrollBy');
});

test('snapshot handlers stay inside the single injected bridge script', () => {
  const html = injectPreviewBridge('<html><body><main></main></body></html>');

  expect(html.match(/__SBER_DESIGNER_SELECTION_BRIDGE__/g)?.length).toBe(2);
  expect(injectPreviewBridge(html)).toBe(html);
});
