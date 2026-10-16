import { expect, test } from 'bun:test';

import {
  assertRuntimePromptBudget,
  resolveRuntimePromptDelivery,
  RuntimePromptBudgetError,
  validateRuntimePromptBudget,
} from '../services/api/src/agent-runtimes/prompt-delivery';
import { CODEX_RUNTIME_DEF } from '../services/api/src/agent-runtimes/registry';

test('runtime prompt delivery is a data-driven contract with byte budget guards', () => {
  expect(resolveRuntimePromptDelivery(CODEX_RUNTIME_DEF)).toEqual({
    mode: 'stdin',
    maxBytes: 200_000,
  });

  expect(() => assertRuntimePromptBudget(CODEX_RUNTIME_DEF, 'ok')).not.toThrow();
  try {
    assertRuntimePromptBudget(CODEX_RUNTIME_DEF, 'x'.repeat(200_001));
    throw new Error('expected prompt budget error');
  } catch (err) {
    expect(err).toBeInstanceOf(RuntimePromptBudgetError);
    expect((err as RuntimePromptBudgetError).code).toBe('prompt_too_large');
    expect((err as RuntimePromptBudgetError).validation).toMatchObject({
      code: 'prompt_too_large',
      bytes: 200_001,
      maxBytes: 200_000,
      mode: 'stdin',
    });
  }
});

test('runtime prompt budget preflight returns a structured prompt_too_large diagnostic', () => {
  expect(validateRuntimePromptBudget(CODEX_RUNTIME_DEF, 'ok')).toEqual({
    ok: true,
    bytes: 2,
    maxBytes: 200_000,
    mode: 'stdin',
  });

  expect(validateRuntimePromptBudget(CODEX_RUNTIME_DEF, 'x'.repeat(200_001))).toMatchObject({
    ok: false,
    code: 'prompt_too_large',
    runtime: 'Codex CLI',
    bytes: 200_001,
    maxBytes: 200_000,
    mode: 'stdin',
  });
});
