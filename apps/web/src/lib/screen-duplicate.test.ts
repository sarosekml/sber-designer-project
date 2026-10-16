import { expect, test } from 'bun:test';
import type { ProjectScreen } from '@sber-designer/shared-types';

import { buildGeneratedScreenDuplicate } from './screen-duplicate';

const modalOriginal: ProjectScreen = {
  id: 'screen-modal',
  name: 'Delete confirm',
  kind: 'page',
  surface: 'modal',
  filePath: 'src/screens/delete-confirm/DeleteConfirm.stories.tsx',
  implementationFilePath: 'src/screens/delete-confirm/DeleteConfirm.tsx',
  folder: 'Dialogs',
  template: { id: 'modal-confirm', source: 'built-in' },
};

test('duplicating a modal keeps its surface and template ref (Р-21)', () => {
  const plan = buildGeneratedScreenDuplicate({
    original: modalOriginal,
    screens: [modalOriginal],
    implementationContents: 'export function DeleteConfirm() { return null; }',
    unique: 'copy1',
  });

  expect(plan.screen.surface).toBe('modal');
  expect(plan.screen.template).toEqual({ id: 'modal-confirm', source: 'built-in' });
});

test('duplicating a page screen leaves surface absent', () => {
  const pageOriginal: ProjectScreen = { ...modalOriginal, surface: undefined, template: undefined };
  const plan = buildGeneratedScreenDuplicate({
    original: pageOriginal,
    screens: [pageOriginal],
    implementationContents: 'export function DeleteConfirm() { return null; }',
    unique: 'copy1',
  });

  expect(plan.screen.surface).toBeUndefined();
  expect(plan.screen.template).toBeUndefined();
});
