import { expect, test } from 'bun:test';

import {
  classifyRuntimeFailure,
  type RuntimeFailurePhase,
} from '../services/api/src/agent-runtimes/failure-taxonomy';

test('runtime failure taxonomy classifies actionable runtime failures with phase severity', () => {
  const cases: Array<{
    phase: RuntimeFailurePhase;
    message: string;
    code: string;
    severity: 'info' | 'warning' | 'error';
    retryHint:
      | 'login'
      | 'reduce_prompt'
      | 'retry_later'
      | 'check_config'
      | 'reinstall_cli'
      | 'none';
    terminal: boolean;
  }> = [
    {
      phase: 'run',
      message: 'API Error: 429 rate limit exceeded',
      code: 'rate_limited',
      severity: 'error',
      retryHint: 'retry_later',
      terminal: false,
    },
    {
      phase: 'run',
      message: 'Codex CLI prompt is 200001 bytes and exceeds the 200000 byte stdin budget.',
      code: 'prompt_too_large',
      severity: 'error',
      retryHint: 'reduce_prompt',
      terminal: true,
    },
    {
      phase: 'run',
      message: 'Codex stage watchdog timed out after 60s without a stream event.',
      code: 'runtime_timeout',
      severity: 'error',
      retryHint: 'retry_later',
      terminal: true,
    },
    {
      phase: 'run',
      message: 'spawn codex ENOENT',
      code: 'runtime_spawn_failed',
      severity: 'error',
      retryHint: 'reinstall_cli',
      terminal: true,
    },
    {
      phase: 'help',
      message: 'Invalid runtime config: unknown prompt delivery mode',
      code: 'runtime_config_invalid',
      severity: 'warning',
      retryHint: 'check_config',
      terminal: true,
    },
    {
      phase: 'auth',
      message: '403 Forbidden: account is not entitled to use this model',
      code: 'auth_forbidden',
      severity: 'warning',
      retryHint: 'check_config',
      terminal: true,
    },
    {
      phase: 'auth',
      message: '401 Unauthorized: token expired',
      code: 'auth_expired',
      severity: 'warning',
      retryHint: 'login',
      terminal: true,
    },
  ];

  for (const item of cases) {
    expect(classifyRuntimeFailure(item.phase, item.message)).toMatchObject({
      code: item.code,
      phase: item.phase,
      severity: item.severity,
      retryHint: item.retryHint,
      terminal: item.terminal,
    });
  }
});
