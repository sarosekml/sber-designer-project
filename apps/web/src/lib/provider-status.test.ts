import { expect, test } from 'bun:test';

import { providerStatusInfo } from './provider-status';

test('providerStatusInfo reports key presence without claiming a verified connection', () => {
  expect(providerStatusInfo({ type: 'mock' })).toBeNull();
  expect(providerStatusInfo({ type: 'claude-code' })).toBeNull();

  expect(providerStatusInfo({ type: 'openai-compatible' })).toEqual({
    label: 'no apiKey',
    tone: 'warn',
  });
  expect(
    providerStatusInfo({ type: 'openai-compatible', options: { apiKey: '__missing__' } }),
  ).toEqual({ label: 'env missing', tone: 'warn' });
  expect(
    providerStatusInfo({ type: 'openai-compatible', options: { apiKey: '__env_unresolved__' } }),
  ).toEqual({ label: 'env unresolved', tone: 'warn' });
  expect(
    providerStatusInfo({ type: 'openai-compatible', options: { apiKey: '{env:ZAI_API_KEY}' } }),
  ).toEqual({ label: 'env unresolved', tone: 'warn' });

  // 0139 C: a configured key is *presence*, not readiness — "Connection
  // verified" is a separate, explicit test result.
  expect(
    providerStatusInfo({ type: 'openai-compatible', options: { apiKey: '__configured__' } }),
  ).toEqual({ label: 'api key configured', tone: 'ok' });
  expect(
    providerStatusInfo({ type: 'openai-compatible', options: { apiKey: 'raw-secret' } }),
  ).toEqual({ label: 'api key configured', tone: 'ok' });
});
