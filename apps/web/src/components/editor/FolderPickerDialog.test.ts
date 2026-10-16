import { expect, test } from 'bun:test';

import { buildFolderPickerDialogStackModel } from './FolderPickerDialog';

test('folder picker uses a nested modal stack above parent dialogs', () => {
  const model = buildFolderPickerDialogStackModel();

  expect(model.modal).toBe(true);
  expect(model.overlayClassName).toContain('z-[69]');
  expect(model.contentClassName).toContain('z-[70]');
  expect(model.contentClassName).toContain('overflow-hidden');
  expect(model.contentClassName).not.toContain('z-50');
});
