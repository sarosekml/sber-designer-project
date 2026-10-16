import { expect, test } from 'bun:test';

import { buildExtractReferenceDialogState } from './ExtractReferenceDialog';

test('extract reference dialog requires a source before create', () => {
  expect(
    buildExtractReferenceDialogState({
      sourceKind: 'attachment',
      files: [],
      referenceUrl: '',
      submitting: false,
    }),
  ).toMatchObject({
    canSubmit: false,
    sourceReady: false,
  });
});

test('extract reference dialog accepts a selected file source', () => {
  expect(
    buildExtractReferenceDialogState({
      sourceKind: 'attachment',
      files: [new File(['body'], 'reference.png', { type: 'image/png' })],
      referenceUrl: '',
      submitting: false,
    }),
  ).toMatchObject({
    canSubmit: true,
    sourceReady: true,
  });
});

test('extract reference dialog accepts a Pixso URL source', () => {
  expect(
    buildExtractReferenceDialogState({
      sourceKind: 'pixso',
      files: [],
      referenceUrl: 'https://pixso.example/file/abc',
      submitting: false,
    }),
  ).toMatchObject({
    canSubmit: true,
    sourceReady: true,
  });
});

test('extract reference dialog accepts a generic web URL source', () => {
  expect(
    buildExtractReferenceDialogState({
      sourceKind: 'url',
      files: [],
      referenceUrl: 'https://example.com/reference',
      submitting: false,
    }),
  ).toMatchObject({
    canSubmit: true,
    sourceReady: true,
  });
});
