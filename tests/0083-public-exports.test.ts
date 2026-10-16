/**
 * 0083 R2 — public export verification. Reproduces the DCM `Tile`→`BaseTile`
 * bug: a barrel re-exports the component under an alias through `export *`, so
 * importing the indexed `shortName` fails with TS2305. The pack must catch this
 * up front and suggest the real export name.
 */
import path from 'node:path';

import { expect, test } from 'bun:test';

import {
  parseModuleExports,
  resolveModuleExports,
  verifyPublicExportName,
} from '../services/api/src/component-intelligence/public-exports';

const ROOT = path.join(import.meta.dir, 'fixtures', '0083-exports');
const TILE = 'components/molecules/Tiles/Tile.ts';

test('parseModuleExports keeps `as` aliases and skips type-only exports', () => {
  const parsed = parseModuleExports(
    [
      "export { Tile as BaseTile } from './Tile';",
      "export { Grid } from './Grid';",
      "export type { TileProps } from './Tile';",
      'export const Helper = 1;',
      "export * from './More';",
    ].join('\n'),
  );
  expect(parsed.names).toContain('BaseTile');
  expect(parsed.names).toContain('Grid');
  expect(parsed.names).toContain('Helper');
  expect(parsed.names).not.toContain('TileProps'); // type-only
  expect(parsed.aliasByLocal.get('Tile')).toBe('BaseTile');
  expect(parsed.reexportAll).toEqual(['./More']);
});

test('resolveModuleExports follows `export *` into sub-barrels', async () => {
  const exports = await resolveModuleExports(ROOT, 'components/molecules/index.ts');
  expect(exports.names.has('BaseTile')).toBe(true);
  expect(exports.names.has('Grid')).toBe(true);
  expect(exports.names.has('Tile')).toBe(false); // only the alias is public
  expect(exports.aliasByLocal.get('Tile')).toBe('BaseTile');
});

test('flags an aliased component and suggests the real export name', async () => {
  const check = await verifyPublicExportName(ROOT, TILE, 'Tile');
  expect(check.verifiable).toBe(true);
  expect(check.exported).toBe(false);
  expect(check.actualName).toBe('BaseTile');
});

test('accepts a symbol that is genuinely a public export', async () => {
  expect((await verifyPublicExportName(ROOT, TILE, 'Grid')).exported).toBe(true);
  expect((await verifyPublicExportName(ROOT, TILE, 'BaseTile')).exported).toBe(true);
});

test('reports "not verifiable" (never a false flag) when no barrel resolves', async () => {
  const check = await verifyPublicExportName(ROOT, 'orphan/Comp.tsx', 'Comp');
  expect(check.verifiable).toBe(false);
  expect(check.exported).toBe(true);
});
