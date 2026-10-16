import { expect, test } from 'bun:test';

import { isUsableDomTestId } from './dom-selection';

test('rejects generated placeholder test ids and keeps intentional ids', () => {
  expect(isUsableDomTestId('undefined_Button')).toBe(false);
  expect(isUsableDomTestId('null-Button')).toBe(false);
  expect(isUsableDomTestId('[object Object]_Button')).toBe(false);
  expect(isUsableDomTestId('payments-undefined-state')).toBe(true);
  expect(isUsableDomTestId('payment-approve-button')).toBe(true);
});
