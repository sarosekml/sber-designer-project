import { expect, test } from 'bun:test';

import { shouldRenderCanvasIframe } from '../apps/web/src/lib/canvas-loading';

test('hides the canvas iframe while a project sandbox is not ready', () => {
  expect(shouldRenderCanvasIframe(null)).toBe(true);
  expect(shouldRenderCanvasIframe(undefined)).toBe(true);
  expect(shouldRenderCanvasIframe('ready')).toBe(true);

  expect(shouldRenderCanvasIframe('starting')).toBe(false);
  expect(shouldRenderCanvasIframe('failed')).toBe(false);
  expect(shouldRenderCanvasIframe('stopped')).toBe(false);
});
