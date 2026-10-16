import { expect, test } from 'bun:test';

import {
  colorInputValue,
  formatPxValue,
  normalizeLiveInspectStyles,
  pxNumber,
  toCssPropertyName,
} from '../apps/web/src/lib/live-inspect';

test('normalizes live inspect style patches to a safe CSS property allow-list', () => {
  expect(
    normalizeLiveInspectStyles({
      color: '#111111',
      backgroundColor: 'rgb(255, 255, 255)',
      fontSize: '14px',
      padding: '12px 16px',
      borderRadius: '8px',
      position: 'fixed',
      colorScheme: 'dark',
      margin: '1px; background: red',
      lineHeight: '</style><script>alert(1)</script>',
    }),
  ).toEqual({
    color: '#111111',
    backgroundColor: 'rgb(255, 255, 255)',
    fontSize: '14px',
    padding: '12px 16px',
    borderRadius: '8px',
  });
});

test('converts camelCase inspect properties to CSS property names', () => {
  expect(toCssPropertyName('backgroundColor')).toBe('background-color');
  expect(toCssPropertyName('fontSize')).toBe('font-size');
  expect(toCssPropertyName('padding')).toBe('padding');
});

test('maps computed rgb colors to native color input values', () => {
  expect(colorInputValue('rgb(255, 255, 255)')).toBe('#ffffff');
  expect(colorInputValue('rgb(0, 170, 155)')).toBe('#00aa9b');
  expect(colorInputValue('#abc')).toBe('#aabbcc');
  expect(colorInputValue('oklch(0.62 0.13 155)')).toBe('#000000');
});

test('derives slider numbers from px values while preserving manual CSS entry', () => {
  expect(pxNumber('16px')).toBe(16);
  expect(pxNumber('6px 12px 6px 10px')).toBe(6);
  expect(pxNumber('normal', 14)).toBe(14);
  expect(formatPxValue(13.4)).toBe('13px');
});
