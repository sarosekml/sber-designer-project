import { describe, expect, test } from 'bun:test';

import { createHttpBridge } from '../packages/proj-mcp/src/bridge';

describe('0400 proj-mcp service token bridge', () => {
  test('sends the service token without the local stub identity', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const bridge = createHttpBridge({
      apiUrl: 'https://sd.example',
      serviceToken: 'service-secret',
      fetchImpl: (async (input, init) => {
        calls.push({ url: String(input), ...(init ? { init } : {}) });
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }) as typeof fetch,
    });

    await bridge.postMessage('hello');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://sd.example/api/events/publish');
    expect(calls[0]?.init?.headers).toEqual({
      'content-type': 'application/json',
      'x-sber-designer-service-token': 'service-secret',
    });
  });

  test('keeps the local stub identity when no service token is configured', async () => {
    let headers: HeadersInit | undefined;
    const bridge = createHttpBridge({
      apiUrl: 'http://localhost:3000',
      user: 'proj-test',
      fetchImpl: (async (_input, init) => {
        headers = init?.headers;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }) as typeof fetch,
    });

    await bridge.postMessage('hello');
    expect(headers).toEqual({
      'content-type': 'application/json',
      'x-sber-designer-user': 'proj-test',
    });
  });

  test('reads editor state from the bridge workspace instead of the process-global snapshot', async () => {
    let stateUrl = '';
    const bridge = createHttpBridge({
      apiUrl: 'https://sd.example',
      workspacePath: '/srv/projects/user-a/product',
      serviceToken: 'service-secret',
      fetchImpl: (async (input) => {
        stateUrl = String(input);
        return new Response(JSON.stringify({ selection: null }), { status: 200 });
      }) as typeof fetch,
    });

    await bridge.getSelection();
    expect(stateUrl).toBe(
      'https://sd.example/api/state?workspacePath=%2Fsrv%2Fprojects%2Fuser-a%2Fproduct',
    );
  });
});
