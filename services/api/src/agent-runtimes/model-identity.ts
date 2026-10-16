import type { AgentRunRuntimeModelDiagnostics } from '../agent/run-record/types';

/**
 * Convert a runtime-reported model into persisted run diagnostics.
 * The event is intentionally generic so other CLI adapters can adopt the
 * truthful-model contract without provider-specific branches.
 */
export function runtimeModelDiagnosticsFromEvent(
  event: string,
  data: Record<string, unknown>,
): AgentRunRuntimeModelDiagnostics | null {
  if (event !== 'runtime.model') return null;
  const runtime = typeof data.runtime === 'string' ? data.runtime.trim() : '';
  const model = typeof data.model === 'string' ? data.model.trim() : '';
  if (!runtime || !model) return null;
  return {
    runtime,
    model,
    source:
      typeof data.source === 'string' && data.source.trim() ? data.source.trim() : 'runtime-event',
  };
}
