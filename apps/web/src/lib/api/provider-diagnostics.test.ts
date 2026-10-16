import { afterEach, expect, test } from 'bun:test';

import { testProviderConnection } from './provider-diagnostics';
import { ApiError } from './http';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('testProviderConnection posts only provider and model ids', async () => {
  let captured: { url: string; method?: string; body?: string } | null = null;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    captured = { url: String(input), method: init?.method, body: String(init?.body) };
    return Response.json({
      ok: true,
      provider: 'zai-coding-plan',
      requestedModel: 'glm-5.3',
      responseModel: 'glm-5.3',
      elapsedMs: 812,
      finishReason: 'stop',
      textPreview: 'OK',
    });
  }) as typeof fetch;

  const result = await testProviderConnection({ provider: 'zai-coding-plan', model: 'glm-5.3' });

  expect(result.ok).toBe(true);
  expect(result.responseModel).toBe('glm-5.3');
  expect(result.elapsedMs).toBe(812);
  expect(captured?.url).toEndWith('/api/config/test-connection');
  expect(captured?.method).toBe('POST');
  expect(JSON.parse(captured?.body ?? '{}')).toEqual({
    provider: 'zai-coding-plan',
    model: 'glm-5.3',
  });
});

test('testProviderConnection surfaces route validation errors as ApiError', async () => {
  globalThis.fetch = (async () =>
    Response.json(
      { error: 'unknown_provider', detail: 'Provider "nope" is not configured.' },
      { status: 404 },
    )) as typeof fetch;

  let thrown: unknown;
  try {
    await testProviderConnection({ provider: 'nope', model: 'glm-5.3' });
  } catch (err) {
    thrown = err;
  }
  expect(thrown).toBeInstanceOf(ApiError);
  const apiError = thrown as ApiError;
  expect(apiError.status).toBe(404);
  expect(apiError.code).toBe('unknown_provider');
  expect(apiError.message).toContain('not configured');
});
