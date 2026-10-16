import { expect, test } from 'bun:test';

import {
  normalizeAssistantInstruction,
  shouldAskAssistantForNewScreen,
} from '../apps/web/src/lib/new-screen-flow';

test('empty new-screen instruction does not start Assistant', () => {
  expect(normalizeAssistantInstruction('   ')).toBe('');
  expect(shouldAskAssistantForNewScreen({ instruction: '   ', chatPending: false })).toBe(false);
});

test('non-empty new-screen instruction starts Assistant only when chat is idle', () => {
  expect(
    shouldAskAssistantForNewScreen({ instruction: 'Build a dashboard', chatPending: false }),
  ).toBe(true);
  expect(
    shouldAskAssistantForNewScreen({ instruction: 'Build a dashboard', chatPending: true }),
  ).toBe(false);
});
