/**
 * 0132.1 — built-in modal templates + surface/modalDefaults frontmatter parsing.
 */
import { beforeEach, expect, test } from 'bun:test';

import {
  parseScreenTemplateFile,
  resetScreenTemplatesCache,
  resolveScreenTemplates,
} from '../services/api/src/screen-templates';

beforeEach(() => {
  resetScreenTemplatesCache();
});

test('built-in modal templates carry surface + modalDefaults and keep their kind', async () => {
  const { templates, diagnostics } = await resolveScreenTemplates();
  const modalForm = templates.find((t) => t.id === 'modal-form');
  const modalConfirm = templates.find((t) => t.id === 'modal-confirm');

  expect(modalForm?.surface).toBe('modal');
  expect(modalForm?.kind).toBe('form'); // surface is orthogonal to kind
  expect(modalForm?.modalDefaults).toEqual({
    width: '560px',
    height: 'auto',
    longContent: 'scroll',
  });

  expect(modalConfirm?.surface).toBe('modal');
  expect(modalConfirm?.kind).toBe('custom');
  expect(modalConfirm?.modalDefaults).toEqual({
    width: '420px',
    height: 'auto',
    longContent: 'scroll',
  });

  expect(diagnostics.filter((d) => d.level === 'error')).toEqual([]);
  expect(diagnostics.filter((d) => d.code === 'screen_template_modal_defaults')).toEqual([]);
});

function parseModal(raw: string) {
  return parseScreenTemplateFile({ source: 'built-in', fileName: 'x.screen.md', raw });
}

test('parser resolves valid modal defaults from frontmatter', () => {
  const { template, diagnostics } = parseModal(
    [
      '---',
      'name: Quick modal',
      'description: A modal.',
      'surface: modal',
      'modalDefaults:',
      '  width: 300px',
      '  height: 50%',
      '  longContent: grow',
      '---',
      '## Intent',
      'x',
      '## Layout',
      '## Regions',
    ].join('\n'),
  );
  expect(template?.surface).toBe('modal');
  expect(template?.modalDefaults).toEqual({ width: '300px', height: '50%', longContent: 'grow' });
  expect(diagnostics.filter((d) => d.code === 'screen_template_modal_defaults')).toEqual([]);
});

test('parser warns and falls back when a modal template omits modalDefaults', () => {
  const { template, diagnostics } = parseModal(
    ['---', 'name: Bare modal', 'description: A modal.', 'surface: modal', '---', '## Intent'].join(
      '\n',
    ),
  );
  expect(template?.surface).toBe('modal');
  expect(template?.modalDefaults).toEqual({
    width: '640px',
    height: 'auto',
    longContent: 'scroll',
  });
  expect(diagnostics.some((d) => d.code === 'screen_template_modal_defaults')).toBe(true);
});

test('parser warns and clamps an invalid modal width to the fallback', () => {
  const { template, diagnostics } = parseModal(
    [
      '---',
      'name: Bad modal',
      'description: A modal.',
      'surface: modal',
      'modalDefaults:',
      '  width: calc(100%)',
      '  height: 70vh',
      '---',
      '## Intent',
    ].join('\n'),
  );
  expect(template?.modalDefaults).toEqual({
    width: '640px',
    height: '70vh',
    longContent: 'scroll',
  });
  expect(
    diagnostics.some(
      (d) => d.code === 'screen_template_modal_defaults' && d.message.includes('width'),
    ),
  ).toBe(true);
});

test('parser warns when a non-modal template declares modalDefaults and drops it', () => {
  const { template, diagnostics } = parseModal(
    [
      '---',
      'name: Page with defaults',
      'description: A page.',
      'kind: form',
      'modalDefaults:',
      '  width: 300px',
      '---',
      '## Intent',
    ].join('\n'),
  );
  expect(template?.surface).toBeUndefined();
  expect(template?.modalDefaults).toBeUndefined();
  expect(diagnostics.some((d) => d.code === 'screen_template_modal_defaults')).toBe(true);
});
