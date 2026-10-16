import { expect, test } from 'bun:test';

import type { GitChange } from './api/git';
import { autoPrPathsAfterRun } from './git-auto-pr';

function change(path: string): GitChange {
  return { path, kind: 'modified', staged: false };
}

test('autoPrPathsAfterRun excludes files dirty before the run', () => {
  expect(
    autoPrPathsAfterRun(
      [change('manual.ts'), change('shared.ts')],
      [change('manual.ts'), change('shared.ts'), change('agent.ts')],
    ),
  ).toEqual(['agent.ts']);
});

test('autoPrPathsAfterRun returns every changed file when the workspace started clean', () => {
  expect(autoPrPathsAfterRun([], [change('agent.ts'), change('new.ts')])).toEqual([
    'agent.ts',
    'new.ts',
  ]);
});
