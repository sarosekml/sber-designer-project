import { expect, test } from 'bun:test';
import {
  HTML_DESIGN_SYSTEM_IMPORT_MAX_FILE_BYTES,
  HTML_DESIGN_SYSTEM_IMPORT_MAX_FILES,
} from '@sber-designer/shared-types';

import { buildImportDesignSystemDialogState } from './ImportDesignSystemFilesDialog';

test('design-system import dialog enforces count, per-file, and total limits', () => {
  expect(buildImportDesignSystemDialogState([], false)).toMatchObject({
    canSubmit: false,
    error: null,
    totalBytes: 0,
  });
  expect(
    buildImportDesignSystemDialogState([{ name: 'cards.html', size: 1024 }], false),
  ).toMatchObject({ canSubmit: true, error: null, totalBytes: 1024 });
  expect(
    buildImportDesignSystemDialogState(
      Array.from({ length: HTML_DESIGN_SYSTEM_IMPORT_MAX_FILES + 1 }, (_, index) => ({
        name: `file-${index}.html`,
        size: 1,
      })),
      false,
    ).error,
  ).toContain('at most');
  expect(
    buildImportDesignSystemDialogState(
      [{ name: 'hero.png', size: HTML_DESIGN_SYSTEM_IMPORT_MAX_FILE_BYTES + 1 }],
      false,
    ).error,
  ).toContain('10 MB');
  expect(
    buildImportDesignSystemDialogState(
      Array.from({ length: 6 }, (_, index) => ({
        name: `${index}.png`,
        size: 9 * 1024 * 1024,
      })),
      false,
    ).error,
  ).toContain('50 MB');
});
