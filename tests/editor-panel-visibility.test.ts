import { expect, test } from 'bun:test';

import {
  areAllEditorPanelsHidden,
  setAllEditorPanelsHidden,
} from '../apps/web/src/lib/editor-panel-visibility';

test('hide all covers screens, assistant, and components panels', () => {
  const visible = { screensHidden: false, assistantHidden: true, componentsHidden: false };

  expect(areAllEditorPanelsHidden(visible)).toBe(false);
  expect(setAllEditorPanelsHidden(visible, true)).toEqual({
    screensHidden: true,
    assistantHidden: true,
    componentsHidden: true,
  });
  expect(setAllEditorPanelsHidden(visible, false)).toEqual({
    screensHidden: false,
    assistantHidden: false,
    componentsHidden: false,
  });
});
