import { describe, expect, test } from 'bun:test';

import {
  compareWithBaseline,
  listRootProjects,
  parseTscOutput,
  toBaseline,
} from '../scripts/typecheck-workspace';

describe('workspace typecheck gate', () => {
  test('parses plain tsc output into per-file diagnostic codes (0136 R10)', () => {
    const parsed = parseTscOutput(
      [
        "services/api/src/a.ts(10,5): error TS2375: Type 'X' is not assignable to type 'Y'.",
        "  Types of property 'meta' are incompatible.",
        "services/api/src/a.ts(20,1): error TS2339: Property 'costUsd' does not exist.",
        'packages/ast-bridge/src/b.ts(8,17): error TS2339: Property missing.',
        'random non-error line',
      ].join('\n'),
    );

    expect(parsed.files).toEqual({
      'services/api/src/a.ts': { TS2375: 1, TS2339: 1 },
      'packages/ast-bridge/src/b.ts': { TS2339: 1 },
    });
    expect(parsed.lines).toHaveLength(3);
  });

  test('flags new errors and per-code increases as regressions', () => {
    const { regressions, improvements } = compareWithBaseline(
      {
        'services/api': {
          files: {
            'services/api/src/a.ts': { TS2375: 3 },
            'services/api/src/new.ts': { TS2339: 1 },
          },
          lines: [],
        },
      },
      { 'services/api': { 'services/api/src/a.ts': { TS2375: 2 } } },
    );

    expect(regressions).toHaveLength(2);
    expect(regressions[0]).toContain('services/api/src/a.ts has 3 TS2375');
    expect(regressions[1]).toContain('services/api/src/new.ts has 1 TS2339');
    expect(improvements).toHaveLength(0);
  });

  /**
   * The whole point of R10: before this, the baseline stored one number per
   * file, so trading one error for another kept the gate green.
   */
  test('swapping one diagnostic for another in the same file is a regression', () => {
    const { regressions, improvements } = compareWithBaseline(
      {
        'services/api': { files: { 'services/api/src/a.ts': { TS2345: 1 } }, lines: [] },
      },
      { 'services/api': { 'services/api/src/a.ts': { TS2375: 1 } } },
    );

    expect(regressions).toHaveLength(1);
    expect(regressions[0]).toContain('has 1 TS2345 error (baseline allows 0)');
    expect(improvements).toHaveLength(1);
    expect(improvements[0]).toContain('no longer reports TS2375');
  });

  test('reports fixed and shrunken files as improvements, not failures', () => {
    const { regressions, improvements } = compareWithBaseline(
      {
        'services/api': { files: { 'services/api/src/a.ts': { TS2375: 1 } }, lines: [] },
      },
      {
        'services/api': {
          'services/api/src/a.ts': { TS2375: 2 },
          'services/api/src/gone.ts': { TS2339: 4 },
        },
      },
    );

    expect(regressions).toHaveLength(0);
    expect(improvements).toHaveLength(2);
  });

  test('a pre-0136 baseline entry still loads and compares by total', () => {
    const current = {
      'services/api': { files: { 'services/api/src/a.ts': { TS2345: 2 } }, lines: [] },
    };
    expect(
      compareWithBaseline(current, { 'services/api': { 'services/api/src/a.ts': 2 } }),
    ).toEqual({ regressions: [], improvements: [] });
    expect(
      compareWithBaseline(current, { 'services/api': { 'services/api/src/a.ts': 1 } }).regressions,
    ).toHaveLength(1);
  });

  test('serializes baselines with sorted keys and without clean projects', () => {
    const baseline = toBaseline({
      'services/api': {
        files: { 'b.ts': { TS1: 1 }, 'a.ts': { TS2: 1, TS1: 1 } },
        lines: [],
      },
      'apps/web': { files: {}, lines: [] },
    });

    expect(Object.keys(baseline)).toEqual(['services/api']);
    expect(Object.keys(baseline['services/api']!)).toEqual(['a.ts', 'b.ts']);
    expect(Object.keys(baseline['services/api']!['a.ts'] as Record<string, number>)).toEqual([
      'TS1',
      'TS2',
    ]);
  });

  test('reads project list from the root tsconfig references', () => {
    const projects = listRootProjects(`${import.meta.dir}/..`);

    expect(projects).toContain('apps/web');
    expect(projects).toContain('services/api');
    expect(projects).toContain('packages/shared-types');
  });
});
