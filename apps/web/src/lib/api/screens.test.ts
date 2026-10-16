import { afterEach, expect, test } from 'bun:test';

import { ApiError } from './http';
import { fetchScreenGenerationInfo } from './screens';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('fetchScreenGenerationInfo encodes the screen id and returns the shared contract', async () => {
  let requestedUrl = '';
  globalThis.fetch = (async (input) => {
    requestedUrl = String(input);
    return Response.json({ screen: { id: 'screen/a' }, totals: {}, runs: [] });
  }) as typeof fetch;

  const result = await fetchScreenGenerationInfo('screen/a');

  expect(requestedUrl).toEndWith('/api/screens/screen%2Fa/generation-info');
  expect(result.screen.id).toBe('screen/a');
});

test('fetchScreenGenerationInfo preserves structured API errors', async () => {
  globalThis.fetch = (async () =>
    Response.json(
      { error: 'screen_not_found', detail: 'Screen was not found.' },
      { status: 404 },
    )) as typeof fetch;

  try {
    await fetchScreenGenerationInfo('missing');
    throw new Error('Expected request to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).code).toBe('screen_not_found');
  }
});
