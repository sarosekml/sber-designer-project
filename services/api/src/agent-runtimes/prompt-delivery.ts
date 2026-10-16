import type { AgentRuntimeDef, AgentRuntimePromptDelivery } from './types';

const DEFAULT_STDIN_PROMPT_MAX_BYTES = 200_000;

export type RuntimePromptBudgetValidation =
  | {
      ok: true;
      bytes: number;
      maxBytes: number;
      mode: AgentRuntimePromptDelivery['mode'];
    }
  | {
      ok: false;
      code: 'prompt_too_large';
      runtime: string;
      bytes: number;
      maxBytes: number;
      mode: AgentRuntimePromptDelivery['mode'];
      detail: string;
    };

export class RuntimePromptBudgetError extends Error {
  readonly code = 'prompt_too_large';
  readonly validation: Extract<RuntimePromptBudgetValidation, { ok: false }>;

  constructor(validation: Extract<RuntimePromptBudgetValidation, { ok: false }>) {
    super(validation.detail);
    this.name = 'RuntimePromptBudgetError';
    this.validation = validation;
  }
}

export function resolveRuntimePromptDelivery(def: AgentRuntimeDef): AgentRuntimePromptDelivery {
  return (
    def.promptDelivery ?? {
      mode: def.promptViaStdin ? 'stdin' : 'argv',
      maxBytes: DEFAULT_STDIN_PROMPT_MAX_BYTES,
    }
  );
}

export function assertRuntimePromptBudget(def: AgentRuntimeDef, prompt: string): void {
  const validation = validateRuntimePromptBudget(def, prompt);
  if (validation.ok) return;
  throw new RuntimePromptBudgetError(validation);
}

export function validateRuntimePromptBudget(
  def: AgentRuntimeDef,
  prompt: string,
): RuntimePromptBudgetValidation {
  const delivery = resolveRuntimePromptDelivery(def);
  const bytes = Buffer.byteLength(prompt, 'utf8');
  if (bytes <= delivery.maxBytes) {
    return {
      ok: true,
      bytes,
      maxBytes: delivery.maxBytes,
      mode: delivery.mode,
    };
  }
  return {
    ok: false,
    code: 'prompt_too_large',
    runtime: def.displayName,
    bytes,
    maxBytes: delivery.maxBytes,
    mode: delivery.mode,
    detail: `${def.displayName} prompt is ${bytes} bytes and exceeds the ${delivery.maxBytes} byte ${delivery.mode} budget. Reduce stable context, component-pack detail, or attachment-derived context before retrying.`,
  };
}

export function isRuntimePromptTooLargeMessage(message: string): boolean {
  return /prompt is \d+ bytes and exceeds the \d+ byte \w+ budget|prompt_too_large/iu.test(message);
}

export function isRuntimePromptBudgetError(err: unknown): err is RuntimePromptBudgetError {
  return err instanceof RuntimePromptBudgetError;
}
