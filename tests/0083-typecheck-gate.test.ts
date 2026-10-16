/**
 * 0083 G3 — deterministic TypeScript craft gate. Every DCM contract failure is
 * a TS error against the project's own types; this gate turns them into precise
 * findings before a screen is handed back as done.
 */
import path from 'node:path';

import { expect, test } from 'bun:test';

import {
  findScreenTypeErrors,
  resetScreenTypecheckCache,
} from '../services/api/src/screen-typecheck';

const FIXTURES = path.join(import.meta.dir, 'fixtures');
const TS_PROJECT = path.join(FIXTURES, '0083-typecheck');
const NO_TS_PROJECT = path.join(FIXTURES, '0083-typecheck-no-ts');
const BROKEN_TS_PROJECT = path.join(FIXTURES, '0083-typecheck-broken');

test('flags contract errors (wrong prop name + invalid union token) as blocking findings', async () => {
  resetScreenTypecheckCache();
  const findings = await findScreenTypeErrors({
    workspaceRoot: TS_PROJECT,
    filePath: 'screen-bad.ts',
  });

  expect(findings.length).toBeGreaterThanOrEqual(2);
  expect(findings.every((f) => f.severity === 'blocking')).toBe(true);
  expect(findings.every((f) => f.ruleId === 'craft.type-error')).toBe(true);
  expect(findings.every((f) => f.filePath === 'screen-bad.ts')).toBe(true);

  const joined = findings.map((f) => f.message).join('\n');
  expect(joined).toContain('iconName'); // wrong prop name surfaced
  expect(joined).toContain('Body_M_Regular'); // invalid token surfaced
});

test('passes a contract-clean screen with zero findings', async () => {
  resetScreenTypecheckCache();
  const findings = await findScreenTypeErrors({
    workspaceRoot: TS_PROJECT,
    filePath: 'screen-good.ts',
  });
  expect(findings).toEqual([]);
});

test('degrades to no-op when the project has no tsconfig', async () => {
  resetScreenTypecheckCache();
  const findings = await findScreenTypeErrors({
    workspaceRoot: NO_TS_PROJECT,
    filePath: 'screen.ts',
  });
  expect(findings).toEqual([]);
});

test('never throws and returns [] for a path outside the workspace', async () => {
  resetScreenTypecheckCache();
  const findings = await findScreenTypeErrors({
    workspaceRoot: TS_PROJECT,
    filePath: '../../../etc/passwd',
  });
  expect(findings).toEqual([]);
});

// R3 — a TS project whose gate could not run must surface a VISIBLE finding,
// never silently "pass". Otherwise a broken tsconfig reads as "types are clean".
test('surfaces craft.typecheck-unavailable when the file is not in the program', async () => {
  resetScreenTypecheckCache();
  const findings = await findScreenTypeErrors({
    workspaceRoot: TS_PROJECT,
    filePath: 'does-not-exist.ts',
  });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.ruleId).toBe('craft.typecheck-unavailable');
  expect(findings[0]?.severity).toBe('should-fix');
});

test('surfaces craft.typecheck-unavailable when the TS project fails to load', async () => {
  resetScreenTypecheckCache();
  const findings = await findScreenTypeErrors({
    workspaceRoot: BROKEN_TS_PROJECT,
    filePath: 'screen.ts',
  });
  expect(findings).toHaveLength(1);
  expect(findings[0]?.ruleId).toBe('craft.typecheck-unavailable');
});
