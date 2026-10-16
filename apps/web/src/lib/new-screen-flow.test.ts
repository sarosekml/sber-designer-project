import { expect, test } from 'bun:test';
import type { ScreenTemplate } from '@sber-designer/shared-types';

import {
  filterTemplatesForSurface,
  isTemplateCompatibleWithSurface,
  resolveTemplateModalLongContent,
  selectScreenTemplateByKey,
} from './new-screen-flow';

const template = (id: string, surface?: 'page' | 'modal'): ScreenTemplate => ({
  id,
  name: id,
  description: id,
  source: 'built-in',
  content: '',
  ...(surface ? { surface } : {}),
});

const templates: ScreenTemplate[] = [
  template('dashboard'),
  template('form'),
  template('modal-form', 'modal'),
  template('modal-confirm', 'modal'),
];

test('filterTemplatesForSurface splits page and modal templates (0132)', () => {
  expect(filterTemplatesForSurface(templates, 'page').map((t) => t.id)).toEqual([
    'dashboard',
    'form',
  ]);
  expect(filterTemplatesForSurface(templates, 'modal').map((t) => t.id)).toEqual([
    'modal-form',
    'modal-confirm',
  ]);
});

test('isTemplateCompatibleWithSurface treats an absent surface as page', () => {
  expect(isTemplateCompatibleWithSurface(template('form'), 'page')).toBe(true);
  expect(isTemplateCompatibleWithSurface(template('form'), 'modal')).toBe(false);
  expect(isTemplateCompatibleWithSurface(template('modal-form', 'modal'), 'modal')).toBe(true);
});

test('selectScreenTemplateByKey still resolves modal templates by key', () => {
  expect(selectScreenTemplateByKey(templates, 'built-in:modal-confirm')?.surface).toBe('modal');
});

test('project modal grow default applies until the user overrides it', () => {
  const projectModal: ScreenTemplate = {
    ...template('project-modal', 'modal'),
    source: 'project',
    modalDefaults: { width: '640px', height: 'auto', longContent: 'grow' },
  };
  expect(
    resolveTemplateModalLongContent({
      current: 'scroll',
      touched: false,
      template: projectModal,
    }),
  ).toBe('grow');
  expect(
    resolveTemplateModalLongContent({
      current: 'scroll',
      touched: true,
      template: projectModal,
    }),
  ).toBe('scroll');
});
