import { expect, test } from 'bun:test';

import { formatToolTiming } from './ToolCallBubble';

test('formats long permission waits separately from handler runtime', () => {
  expect(
    formatToolTiming({
      toolTiming: {
        permissionWaitMs: 5_631_863,
        handlerDurationMs: 977,
        totalDurationMs: 5_632_841,
      },
    }),
  ).toBe('waited 1h 33m for approval');
});

test('formats handler runtime when no meaningful approval wait happened', () => {
  expect(
    formatToolTiming({
      toolTiming: {
        permissionWaitMs: 120,
        handlerDurationMs: 2_400,
        totalDurationMs: 2_520,
      },
    }),
  ).toBe('ran 2s');
});

test('omits sub-second tool timing noise', () => {
  expect(
    formatToolTiming({
      toolTiming: {
        permissionWaitMs: 100,
        handlerDurationMs: 250,
        totalDurationMs: 350,
      },
    }),
  ).toBeNull();
});
