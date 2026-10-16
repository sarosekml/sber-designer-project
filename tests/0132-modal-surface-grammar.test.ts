/**
 * 0132 — modal surface reader + bounded size grammar (Р-20). Pure contract
 * exercised through the package's public surface.
 */
import { expect, test } from 'bun:test';

import {
  MODAL_FALLBACK_DEFAULTS,
  normalizeModalDefaults,
  parseModalDimension,
  screenSurface,
} from '@sber-designer/shared-types';

test('screenSurface reads absent/unknown as page and modal as modal', () => {
  expect(screenSurface(undefined)).toBe('page');
  expect(screenSurface(null)).toBe('page');
  expect(screenSurface({})).toBe('page');
  expect(screenSurface({ surface: 'page' })).toBe('page');
  expect(screenSurface({ surface: 'modal' })).toBe('modal');
});

test('parseModalDimension accepts one positive number with a known unit', () => {
  expect(parseModalDimension('300px', { allowAuto: false })).toEqual({ ok: true, value: '300px' });
  expect(parseModalDimension('50%', { allowAuto: false })).toEqual({ ok: true, value: '50%' });
  expect(parseModalDimension('40rem', { allowAuto: false })).toEqual({ ok: true, value: '40rem' });
  expect(parseModalDimension(' 640px ', { allowAuto: false })).toEqual({
    ok: true,
    value: '640px',
  });
  expect(parseModalDimension('12.5vh', { allowAuto: false })).toEqual({
    ok: true,
    value: '12.5vh',
  });
});

test('parseModalDimension allows auto only for height', () => {
  expect(parseModalDimension('auto', { allowAuto: true })).toEqual({ ok: true, value: 'auto' });
  expect(parseModalDimension('AUTO', { allowAuto: true })).toEqual({ ok: true, value: 'auto' });
  expect(parseModalDimension('auto', { allowAuto: false }).ok).toBe(false);
});

test('parseModalDimension rejects CSS functions and injection attempts (Р-20/риск №24)', () => {
  for (const bad of [
    '',
    'red',
    '10',
    '-10px',
    '0px',
    'calc(100% - 20px)',
    'min(300px, 50%)',
    'var(--w)',
    '300px;color:red',
    '300px}',
    '10px 20px',
    '123456789012345678px', // exceeds the length cap
  ]) {
    expect(parseModalDimension(bad, { allowAuto: true }).ok).toBe(false);
  }
});

test('normalizeModalDefaults fills blanks from fallback without issues', () => {
  const result = normalizeModalDefaults(undefined);
  expect(result.value).toEqual(MODAL_FALLBACK_DEFAULTS);
  expect(result.issues).toEqual([]);
});

test('normalizeModalDefaults keeps valid provided values', () => {
  const result = normalizeModalDefaults({ width: '300px', height: '50%', longContent: 'grow' });
  expect(result.value).toEqual({ width: '300px', height: '50%', longContent: 'grow' });
  expect(result.issues).toEqual([]);
});

test('normalizeModalDefaults reports invalid values and falls back per field', () => {
  const result = normalizeModalDefaults(
    { width: 'calc(100%)', height: 'auto', longContent: 'bounce' as 'grow' },
    { width: '640px', height: 'auto', longContent: 'scroll' },
  );
  expect(result.value).toEqual({ width: '640px', height: 'auto', longContent: 'scroll' });
  expect(result.issues).toHaveLength(2);
  expect(result.issues[0]).toContain('width');
  expect(result.issues[1]).toContain('longContent');
});

test('normalizeModalDefaults uses a template fallback when provided', () => {
  const templateDefault = { width: '480px', height: '70vh', longContent: 'scroll' as const };
  const result = normalizeModalDefaults({ longContent: 'grow' }, templateDefault);
  expect(result.value).toEqual({ width: '480px', height: '70vh', longContent: 'grow' });
});
