import type { NormalizedRunEvent } from './opencode-events';

export type RuntimeStdoutFallback =
  | { kind: 'assistant-text'; text: string }
  | { kind: 'runtime-noise'; reason: string };

export interface RuntimeStdoutFallbackOptions {
  // `| undefined` so a caller may forward an optional field straight
  // through under `exactOptionalPropertyTypes` (0136 R10).
  onRuntimeNoise?: ((reason: string, line: string) => void) | undefined;
}

export function classifyRuntimeStdoutFallback(line: string): RuntimeStdoutFallback {
  const trimmed = line.trim();
  if (!trimmed) return { kind: 'runtime-noise', reason: 'empty' };
  if (/^(warning|warn|debug|info|error):/iu.test(trimmed)) {
    return { kind: 'runtime-noise', reason: 'log-prefix' };
  }
  // Bracketed severity tags: GigaCode emits `[ERROR] [MCP_KEYCHAIN] …` on stdout.
  if (/^\[(warning|warn|debug|info|error)\]/iu.test(trimmed)) {
    return { kind: 'runtime-noise', reason: 'log-prefix' };
  }
  if (/^(checking|loading|connecting|authenticated|logged in)\b/iu.test(trimmed)) {
    return { kind: 'runtime-noise', reason: 'status-line' };
  }
  return { kind: 'assistant-text', text: `${line}\n` };
}

export function fallbackLineToNormalizedEvents(
  line: string,
  options: RuntimeStdoutFallbackOptions = {},
): NormalizedRunEvent[] {
  const classified = classifyRuntimeStdoutFallback(line);
  if (classified.kind === 'runtime-noise') {
    options.onRuntimeNoise?.(classified.reason, line);
  }
  return classified.kind === 'assistant-text'
    ? [{ type: 'text_delta', delta: classified.text }]
    : [];
}
