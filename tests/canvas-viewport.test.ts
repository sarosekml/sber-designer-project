import { expect, test } from 'bun:test';

import {
  CANVAS_VIEWPORT_PRESETS,
  canvasViewportWidth,
  DEFAULT_CANVAS_VIEWPORT_PRESET_ID,
} from '../apps/web/src/lib/canvas-viewport';
import { useEditorStore } from '../apps/web/src/stores/editor-store';

test('canvas viewport defaults to a fluid 100% workspace', () => {
  expect(DEFAULT_CANVAS_VIEWPORT_PRESET_ID).toBe('fluid');
  expect(canvasViewportWidth('fluid')).toBeNull();
});

test('canvas viewport presets expose fixed CSS pixel widths', () => {
  expect(canvasViewportWidth('full-hd')).toBe(1920);
  expect(canvasViewportWidth('desktop-1280')).toBe(1280);
  expect(canvasViewportWidth('iphone')).toBe(440);
});

test('canvas viewport preset order matches the editor dropdown', () => {
  expect(CANVAS_VIEWPORT_PRESETS.map((preset) => preset.id)).toEqual([
    'fluid',
    'full-hd',
    'desktop-1600',
    'desktop-1440',
    'desktop-1280',
    'tablet-960',
    'mobile-640',
    'iphone',
  ]);
});

test('editor store keeps viewport preset in memory only', () => {
  expect(useEditorStore.getState().canvasViewportPresetId).toBe('fluid');

  useEditorStore.getState().setCanvasViewportPresetId('desktop-1280');

  expect(useEditorStore.getState().canvasViewportPresetId).toBe('desktop-1280');
});
