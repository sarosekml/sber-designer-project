import { expect, test } from 'bun:test';

import { buildEmptyScreensStateModel } from './EmptyScreensState';

test('html-first empty state offers static page starts without Storybook copy', () => {
  const model = buildEmptyScreensStateModel({
    projectKind: 'html-first',
    sessionStatus: 'ready',
    catalogLoading: false,
    catalogError: null,
    storyCount: 0,
  });

  expect(model.message).toContain('Create a static page');
  expect(model.message).not.toContain('Storybook');
  expect(model.primaryLabel).toBe('Create page');
  expect(model.secondaryLabels).toEqual([
    'Add design system',
    'Extract from reference',
    'Start greybox',
    'Generate prototype',
  ]);
  expect(model.secondaryActions).toEqual([
    { id: 'add-design-system', label: 'Add design system', action: 'open-flow' },
    {
      id: 'extract-reference',
      label: 'Extract from reference',
      action: 'prepare-assistant-prompt',
    },
    { id: 'start-greybox', label: 'Start greybox', action: 'open-greybox-flow' },
    { id: 'generate-prototype', label: 'Generate prototype', action: 'open-prototype-flow' },
  ]);
  expect(model.addDesignSystemAction).toBe('open-flow');
  expect(model.extractReferenceAction).toBe('prepare-assistant-prompt');
  expect(model.startGreyboxAction).toBe('open-greybox-flow');
  expect(model.generatePrototypeAction).toBe('open-prototype-flow');
});
