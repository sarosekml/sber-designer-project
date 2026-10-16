export type ProviderStatusTone = 'ok' | 'warn' | 'muted';

export interface ProviderStatusInfo {
  label: string;
  tone: ProviderStatusTone;
}

/**
 * Presence-of-secret badge only. "API key configured" is NOT "connection
 * verified" — endpoint reachability and billing are checked by the explicit
 * Test connection action (0139 C), never by this badge.
 */
export function providerStatusInfo(provider: {
  type: string;
  options?: { apiKey?: string | undefined } | undefined;
}): ProviderStatusInfo | null {
  if (provider.type === 'mock' || provider.type === 'claude-code') return null;
  const apiKey = provider.options?.apiKey;
  if (!apiKey) return { label: 'no apiKey', tone: 'warn' };
  if (apiKey === '__missing__') return { label: 'env missing', tone: 'warn' };
  if (apiKey === '__env_unresolved__') return { label: 'env unresolved', tone: 'warn' };
  if (apiKey === '__configured__') return { label: 'api key configured', tone: 'ok' };
  if (/^\{env:[A-Z0-9_]+\}$/u.test(apiKey)) return { label: 'env unresolved', tone: 'warn' };
  return { label: 'api key configured', tone: 'ok' };
}
