import type { RuntimeDiagnostic } from './types';

export type RuntimeFailurePhase = 'auth' | 'models' | 'mcp' | 'version' | 'help' | 'run';
export type RuntimeFailureRetryHint = NonNullable<RuntimeDiagnostic['retryHint']>;

interface RuntimeFailurePattern {
  code: string;
  pattern: RegExp;
  severity?: RuntimeDiagnostic['severity'];
  retryHint: RuntimeFailureRetryHint;
  terminal: boolean;
}

const RUNTIME_FAILURE_PATTERNS: RuntimeFailurePattern[] = [
  {
    code: 'permission_required',
    pattern:
      /permission_required|permission required|requires permission|needs permission|approval required|requires approval|tool approval/iu,
    retryHint: 'check_config',
    terminal: true,
  },
  {
    code: 'prompt_too_large',
    pattern: /prompt_too_large|prompt is \d+ bytes and exceeds the \d+ byte \w+ budget/iu,
    retryHint: 'reduce_prompt',
    terminal: true,
  },
  {
    code: 'runtime_timeout',
    pattern: /runtime_timeout|stage watchdog timed out|without a stream event|stream timed out/iu,
    retryHint: 'retry_later',
    terminal: true,
  },
  {
    code: 'runtime_spawn_failed',
    pattern: /runtime_spawn_failed|\bspawn\b.*\b(?:enoent|eacces)\b|command not found/iu,
    retryHint: 'reinstall_cli',
    terminal: true,
  },
  {
    code: 'runtime_config_invalid',
    pattern:
      /runtime_config_invalid|invalid runtime config|unknown prompt delivery|invalid agent runtime/iu,
    retryHint: 'check_config',
    terminal: true,
  },
  {
    code: 'auth_expired',
    pattern: /token expired|expired token|refresh token|401|unauthorized/iu,
    severity: 'warning',
    retryHint: 'login',
    terminal: true,
  },
  {
    code: 'auth_forbidden',
    pattern: /403|forbidden|not entitled|entitlement/iu,
    severity: 'warning',
    retryHint: 'check_config',
    terminal: true,
  },
  {
    code: 'auth_missing',
    pattern: /not logged in|login required|authentication required|no credentials/iu,
    severity: 'warning',
    retryHint: 'login',
    terminal: true,
  },
  {
    code: 'rate_limited',
    pattern: /rate limit|rate_limited|\b429\b|quota exceeded/iu,
    retryHint: 'retry_later',
    terminal: false,
  },
  {
    code: 'service_unavailable',
    pattern: /503|service unavailable|temporarily unavailable|overloaded/iu,
    retryHint: 'retry_later',
    terminal: false,
  },
  {
    code: 'network_failed',
    pattern: /network|econnrefused|enotfound|etimedout/iu,
    retryHint: 'retry_later',
    terminal: false,
  },
];

export function classifyRuntimeFailure(
  phase: RuntimeFailurePhase,
  message: string,
): RuntimeDiagnostic {
  const matched = RUNTIME_FAILURE_PATTERNS.find((item) => item.pattern.test(message));
  if (matched) {
    return {
      code: matched.code,
      message,
      phase,
      severity: matched.severity ?? severityForPhase(phase),
      retryHint: matched.retryHint,
      terminal: matched.terminal,
    };
  }
  return {
    code: `${phase}_failed`,
    message,
    phase,
    severity: severityForPhase(phase),
    retryHint: retryHintForPhase(phase),
    terminal: phase === 'run',
  };
}

function severityForPhase(phase: RuntimeFailurePhase): RuntimeDiagnostic['severity'] {
  return phase === 'run' ? 'error' : 'warning';
}

function retryHintForPhase(phase: RuntimeFailurePhase): RuntimeFailureRetryHint {
  if (phase === 'auth') return 'login';
  if (phase === 'models' || phase === 'mcp' || phase === 'version' || phase === 'help') {
    return 'check_config';
  }
  return 'none';
}
