import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const stylesPath = 'apps/web/src/styles.css';

test('styles expose black, gray, and default graphite palettes separately', async () => {
  const source = await readFile(stylesPath, 'utf8');

  expect(source).toContain('--background: oklch(0.145 0 0);');
  expect(source).toContain('--primary: oklch(0.623 0.214 259.815);');
  expect(source).toContain(":root[data-surface='gray']");
  expect(source).toContain(":root.light[data-surface='gray']");
  expect(source).toContain(":root[data-surface='graphite']");
  expect(source).toContain(":root.light[data-surface='graphite']");
  expect(source).toContain('--background: oklch(0.141 0.005 285.823);');
  expect(source).toContain('--background: oklch(0.209 0 0);');
  expect(source).toContain('--background: oklch(1 0 0);');
});

test('styles use the owner-selected indigo and green accent values', async () => {
  const source = await readFile(stylesPath, 'utf8');

  expect(source).toContain(":root[data-accent='indigo']");
  expect(source).toContain('--primary: #5046c1;');
  expect(source).toContain('--ring: #5046c1;');
  expect(source).toContain(":root[data-accent='green']");
  expect(source).toContain('--primary: #2daf44;');
  expect(source).toContain('--ring: #2daf44;');
});
