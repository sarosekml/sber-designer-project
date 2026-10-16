import type { McpServerEntry } from './types';

export function redactMcpServerConfig(server: McpServerEntry): Record<string, unknown> {
  const clone = structuredClone(server) as Record<string, unknown>;
  if (server.type === 'stdio') {
    if (server.env) {
      clone.env = redactSecretRecord(server.env);
    }
    return clone;
  }
  if ('headers' in server && server.headers) {
    clone.headers = redactSecretRecord(server.headers);
  }
  return clone;
}

export function redactSecretRecord(record: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    redacted[key] = value ? '__configured__' : '__missing__';
  }
  return redacted;
}

export function redactMcpInstructions(value: string, maxLength = 2000): string {
  const normalized = value.replace(/\r\n?/gu, '\n').trim();
  const redacted = normalized
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/giu, 'Bearer [redacted-secret]')
    .replace(/\b(?:sk|pk|rk|ak)-[A-Za-z0-9_-]{12,}\b/gu, '[redacted-secret]')
    .replace(/\b(authorization)\s*[:=]\s*["']?[^\n\r]+/giu, '$1=[redacted-secret]')
    .replace(
      /\b(api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^"'\s`]+/giu,
      '$1=[redacted-secret]',
    );
  if (redacted.length <= maxLength) return redacted;
  return `${redacted.slice(0, maxLength).trimEnd()}\n[truncated]`;
}
