import { expect, test } from 'bun:test';

import { buildContextStripMetrics } from './context-strip-metrics';

test('buildContextStripMetrics returns compact counts and tooltip labels', () => {
  expect(
    buildContextStripMetrics({
      componentsCount: 113,
      hasSelection: false,
      currentTaskMessageCount: 0,
    }),
  ).toEqual([
    { id: 'components', label: 'Components', count: 113 },
    { id: 'selection', label: 'Selection', count: 0 },
    { id: 'current-task', label: 'Current task', count: 0 },
  ]);
});
