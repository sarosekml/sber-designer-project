import { afterEach, describe, expect, test } from 'bun:test';

import { BUILD_INFO_UNAVAILABLE_DETAIL, fetchBuildInfo, parseBuildInfoResponse } from './version';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubFetch(status: number, body: unknown): string[] {
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return urls;
}

describe('fetchBuildInfo', () => {
  test('returns the build marker with optional product name and author', async () => {
    const urls = stubFetch(200, {
      version: '1.0.0-beta',
      gitSha: 'abc123',
      buildTime: '2026-10-16T09:30:00.000Z',
      productName: 'sber-designer',
      author: 'Jane Doe',
    });

    expect(await fetchBuildInfo()).toEqual({
      state: 'ready',
      info: {
        version: '1.0.0-beta',
        gitSha: 'abc123',
        buildTime: '2026-10-16T09:30:00.000Z',
        productName: 'sber-designer',
        author: 'Jane Doe',
      },
    });
    expect(urls[0]).toEndWith('/api/version');
  });

  test('maps 503 to an explicit unavailable state', async () => {
    stubFetch(503, { error: 'build_info_unavailable', detail: 'missing' });
    expect(await fetchBuildInfo()).toEqual({
      state: 'unavailable',
      detail: BUILD_INFO_UNAVAILABLE_DETAIL,
    });
  });

  test('throws on other HTTP errors', async () => {
    stubFetch(500, { error: 'internal', detail: 'boom' });
    await expect(fetchBuildInfo()).rejects.toThrow('boom');
  });
});

test('parseBuildInfoResponse accepts older markers and rejects incomplete ones', () => {
  expect(parseBuildInfoResponse({ version: '0.0.0', gitSha: 'a', buildTime: 't' })).toEqual({
    version: '0.0.0',
    gitSha: 'a',
    buildTime: 't',
  });
  expect(parseBuildInfoResponse({ version: '0.0.0', gitSha: '' })).toBeNull();
  expect(parseBuildInfoResponse(null)).toBeNull();
  expect(parseBuildInfoResponse([])).toBeNull();
});
