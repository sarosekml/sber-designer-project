/**
 * Append-only audit log for sensitive operations (LLM calls today; git
 * pushes, tool invocations, etc. in Phase 1+).
 *
 * Format: JSON-line on stderr. In Phase 1 this redirects to PostgreSQL
 * with a SIEM exporter; the line shape is forward-compatible.
 */

export interface AuditEvent {
  ts: string;
  kind: 'admin' | 'chat' | 'config' | 'error' | 'event';
  user: string;
  provider?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
  errorMessage?: string;
  action?: string;
  target?: string;
  metadata?: Record<string, unknown>;
}

export function audit(event: Omit<AuditEvent, 'ts'>): void {
  const line: AuditEvent = { ts: new Date().toISOString(), ...event };
  process.stderr.write(`[audit] ${JSON.stringify(line)}\n`);
}
