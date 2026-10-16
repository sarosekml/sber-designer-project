import { expect, test } from 'bun:test';

import { decideScreenBudgetNudge } from '../services/api/src/agent/stream';

// max=20 → reconSoftLimit=10, finalizeReserve=4 (the screen-generation budget).
const base = { max: 20, reconSoftLimit: 10, finalizeReserve: 4 };

test('decideScreenBudgetNudge stays silent early in the run (task 9999 B1)', () => {
  expect(
    decideScreenBudgetNudge({ ...base, iteration: 5, reconNudged: false, finalizeNudged: false }),
  ).toBeNull();
});

test('decideScreenBudgetNudge nudges recon once past the soft limit', () => {
  expect(
    decideScreenBudgetNudge({ ...base, iteration: 11, reconNudged: false, finalizeNudged: false }),
  ).toBe('recon');
  // already nudged → silent
  expect(
    decideScreenBudgetNudge({ ...base, iteration: 12, reconNudged: true, finalizeNudged: false }),
  ).toBeNull();
});

test('decideScreenBudgetNudge forces finalize inside the reserved budget', () => {
  expect(
    decideScreenBudgetNudge({ ...base, iteration: 17, reconNudged: true, finalizeNudged: false }),
  ).toBe('finalize');
  // finalize takes priority even if recon never fired
  expect(
    decideScreenBudgetNudge({ ...base, iteration: 18, reconNudged: false, finalizeNudged: false }),
  ).toBe('finalize');
  // already finalized → silent
  expect(
    decideScreenBudgetNudge({ ...base, iteration: 19, reconNudged: true, finalizeNudged: true }),
  ).toBeNull();
});
