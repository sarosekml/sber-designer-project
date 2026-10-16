import { expect, test } from 'bun:test';

import { modalCanvasFrameStyle } from './modal-preview';

test('standalone modal canvas follows the managed dimensions', () => {
  expect(
    modalCanvasFrameStyle({
      status: 'ok',
      values: { width: '50%', height: '70vh', longContent: 'scroll' },
      rect: { width: 500, height: 600 },
    }),
  ).toEqual({
    width: '50%',
    height: '70vh',
    maxWidth: '100%',
    maxHeight: '100%',
  });
});

test('standalone grow/auto canvas follows the measured modal height', () => {
  expect(
    modalCanvasFrameStyle({
      status: 'ok',
      values: { width: '420px', height: 'auto', longContent: 'grow' },
      rect: { width: 420.2, height: 311.1 },
    }),
  ).toEqual({
    width: '420px',
    height: '312px',
    maxWidth: '100%',
    maxHeight: '100%',
  });
});
