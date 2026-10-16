import { expect, test } from 'bun:test';
import { shouldShowHighConcurrencyWarning } from './BackgroundRunsStrip';

test('high concurrency warning is non-blocking and starts above five active runs', () => {
  expect(shouldShowHighConcurrencyWarning(5, false)).toBe(false);
  expect(shouldShowHighConcurrencyWarning(6, false)).toBe(true);
  expect(shouldShowHighConcurrencyWarning(6, true)).toBe(false);
});
