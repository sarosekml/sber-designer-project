import { expect, test } from 'bun:test';

import {
  buildAddDesignSystemDialogState,
  buildRebuildPreviewMessage,
} from './AddDesignSystemDialog';

test('add design system dialog allows saving a partial source set', () => {
  const state = buildAddDesignSystemDialogState({
    workspacePath: '/work/demo',
    submitting: false,
    draft: {
      designMd: '# Design\n',
      tokensCss: '',
      componentsCss: '',
      designSystemHtml: '',
    },
  });

  expect(state.canSubmit).toBe(true);
  expect(state.hasAnySource).toBe(true);
  expect(state.missingRequired).toEqual(['tokensCss', 'componentsCss']);
});

test('add design system dialog blocks an empty source set', () => {
  const state = buildAddDesignSystemDialogState({
    workspacePath: '/work/demo',
    submitting: false,
    draft: {
      designMd: '',
      tokensCss: '',
      componentsCss: '',
      designSystemHtml: '',
    },
  });

  expect(state.canSubmit).toBe(false);
  expect(state.hasAnySource).toBe(false);
});

test('rebuild preview message reports restored description sections', () => {
  expect(
    buildRebuildPreviewMessage({
      tokenCount: 3,
      componentClassCount: 2,
      descriptionSections: {
        keepDescriptions: true,
        restored: 2,
        changedFiles: ['design-system/index.html'],
        diagnostics: [],
        layerCount: 2,
      },
    }),
  ).toBe(
    'Rebuilt design-system/index.html from 3 tokens and 2 component classes. Restored 2 Description for AI sections.',
  );
});

test('rebuild preview message reports clean rebuild when descriptions are disabled', () => {
  expect(
    buildRebuildPreviewMessage({
      tokenCount: 3,
      componentClassCount: 2,
      descriptionSections: {
        keepDescriptions: false,
        restored: 0,
        changedFiles: [],
        diagnostics: [],
        layerCount: 0,
      },
    }),
  ).toBe(
    'Rebuilt design-system/index.html from 3 tokens and 2 component classes without Description for AI sections.',
  );
});
