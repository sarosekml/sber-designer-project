import { expect, test } from 'bun:test';

import { parseConfig } from '../packages/llm-gateway/src/config';
import { describeChatError, ProviderError } from '../packages/llm-gateway/src/provider-error';
import { openAiCompatibleChat } from '../packages/llm-gateway/src/providers/openai-compatible';
import { openAiCompatibleChatStream } from '../packages/llm-gateway/src/providers/openai-compatible-stream';
import type { SberDesignerConfig } from '../packages/llm-gateway/src/schema';
import type { ProviderEntryT } from '../packages/llm-gateway/src/schema';
import { runProviderConnectionTest } from '../services/api/src/provider-diagnostics';
import { createConfigRouter } from '../services/api/src/routes/config';
import type { ProviderConnectionTestOutcome } from '../services/api/src/provider-diagnostics';

/**
 * 0139 — Z.AI Coding Plan по API. Synthetic fixtures only: every provider
 * response here is a local fetch fake. Live evidence (HTTP 200 / OK from
 * glm-5.3 on the coding endpoint) is recorded in the task file, not here.
 */

const ZAI_GENERAL_BASE_URL = 'https://api.z.ai/api/paas/v4';
const ZAI_CODING_BASE_URL = 'https://api.z.ai/api/coding/paas/v4';

function zaiProvider(baseURL: string, apiKey = 'server-side-key'): ProviderEntryT {
  return {
    type: 'openai-compatible',
    name: 'Z.AI',
    options: { baseURL, apiKey },
    models: {
      'glm-5.3': { name: 'GLM-5.3', vision: false },
      'glm-5.3-flash': { name: 'GLM-5.3-Flash', vision: true },
    },
  };
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function zaiErrorBody(code: string | number, message: string): unknown {
  return { error: { code, message } };
}

function configWith(
  providers: Record<string, ProviderEntryT>,
  agentExtra: Record<string, unknown> = {},
): SberDesignerConfig {
  const first = Object.keys(providers)[0] ?? 'custom';
  const firstModel = Object.keys(providers[first]?.models ?? {})[0] ?? 'm';
  return parseConfig(
    {
      agent: { default: { provider: first, model: firstModel }, ...agentExtra },
      provider: providers,
    },
    { env: {}, strictEnv: false },
  );
}

test('0139 classifies Z.AI business codes from non-streaming error bodies', async () => {
  const cases: Array<{
    status: number;
    code: string;
    category: string;
    retryable: boolean;
  }> = [
    { status: 401, code: '1000', category: 'auth', retryable: false },
    { status: 401, code: '1001', category: 'auth', retryable: false },
    { status: 401, code: '1003', category: 'auth', retryable: false },
    { status: 429, code: '1113', category: 'billing', retryable: false },
    { status: 429, code: '1309', category: 'billing', retryable: false },
    { status: 400, code: '1211', category: 'model-not-found', retryable: false },
    { status: 403, code: '1220', category: 'model-access', retryable: false },
    { status: 429, code: '1311', category: 'model-access', retryable: false },
    { status: 429, code: '1302', category: 'rate-limit', retryable: true },
    { status: 429, code: '1305', category: 'rate-limit', retryable: true },
    { status: 429, code: '1308', category: 'quota', retryable: false },
    { status: 429, code: '1310', category: 'quota', retryable: false },
  ];
  for (const { status, code, category, retryable } of cases) {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse(status, zaiErrorBody(code, 'Synthetic failure'));
    let thrown: unknown;
    try {
      await openAiCompatibleChat(
        { messages: [{ role: 'user', content: 'hi' }] },
        zaiProvider(ZAI_GENERAL_BASE_URL),
        { provider: 'zai', model: 'glm-5.3' },
        fetchImpl,
      );
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(ProviderError);
    const providerError = thrown as ProviderError;
    expect(providerError.category).toBe(category);
    expect(providerError.providerCode).toBe(code);
    expect(providerError.retryable).toBe(retryable);
    expect(providerError.status).toBe(status);
    // Legacy message format is preserved for existing consumers.
    expect(providerError.message).toStartWith(`Provider "zai" returned HTTP ${status}`);
  }
});

test('0139 keeps bare HTTP 429 non-retryable and redacts secrets in error bodies', async () => {
  const fetchImpl: typeof fetch = async () =>
    jsonResponse(
      429,
      zaiErrorBody('undefined', 'Key sk-secrettoken123456 was rejected by the provider'),
    );
  let thrown: unknown;
  try {
    await openAiCompatibleChat(
      { messages: [{ role: 'user', content: 'hi' }] },
      zaiProvider(ZAI_GENERAL_BASE_URL),
      { provider: 'zai', model: 'glm-5.3' },
      fetchImpl,
    );
  } catch (err) {
    thrown = err;
  }
  const providerError = thrown as ProviderError;
  // No recognizable Z.AI business code → the status alone must not define a
  // retry policy (0139 acceptance).
  expect(providerError.category).toBe('rate-limit');
  expect(providerError.retryable).toBe(false);
  expect(providerError.providerCode).toBe('undefined');
  expect(providerError.message).toContain('[redacted]');
  expect(providerError.message).not.toContain('sk-secrettoken123456');
});

test('0139 streaming errors keep the message format and add structured metadata', async () => {
  const fetchImpl: typeof fetch = async () =>
    jsonResponse(429, zaiErrorBody('1113', 'Insufficient balance or no resource package.'));

  const events = [];
  for await (const event of openAiCompatibleChatStream(
    { messages: [{ role: 'user', content: 'hi' }] },
    zaiProvider(ZAI_CODING_BASE_URL),
    { provider: 'zai-coding-plan', model: 'glm-5.3' },
    fetchImpl,
  )) {
    events.push(event);
  }

  expect(events).toHaveLength(1);
  const errorEvent = events[0]!;
  expect(errorEvent.type).toBe('error');
  if (errorEvent.type !== 'error') throw new Error('unreachable');
  expect(errorEvent.message).toStartWith('Provider "zai-coding-plan" HTTP 429:');
  expect(errorEvent.category).toBe('billing');
  expect(errorEvent.providerCode).toBe('1113');
  expect(errorEvent.retryable).toBe(false);
  expect(errorEvent.providerMessage).toBe('Insufficient balance or no resource package.');
});

test('0139 streaming network failures are network-category, not provider verdicts', async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new TypeError('fetch failed');
  };
  const events = [];
  for await (const event of openAiCompatibleChatStream(
    { messages: [{ role: 'user', content: 'hi' }] },
    zaiProvider(ZAI_CODING_BASE_URL),
    { provider: 'zai-coding-plan', model: 'glm-5.3' },
    fetchImpl,
  )) {
    events.push(event);
  }
  const errorEvent = events[0]!;
  expect(errorEvent.type).toBe('error');
  if (errorEvent.type !== 'error') throw new Error('unreachable');
  expect(errorEvent.category).toBe('network');
  expect(errorEvent.message).toBe('fetch failed');
});

test('0139 records the provider-reported response model separately from the request', async () => {
  const nonStreamFetch: typeof fetch = async () =>
    jsonResponse(200, {
      id: 'chatcmpl-1',
      model: 'glm-5.3',
      choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }],
    });
  const response = await openAiCompatibleChat(
    { messages: [{ role: 'user', content: 'hi' }] },
    zaiProvider(ZAI_CODING_BASE_URL),
    { provider: 'zai-coding-plan', model: 'glm-5.3-flash' },
    nonStreamFetch,
  );
  expect(response.model).toBe('glm-5.3-flash');
  expect(response.responseModel).toBe('glm-5.3');

  const streamFetch: typeof fetch = async () =>
    new Response(
      [
        'data: {"model":"glm-5.3","choices":[{"index":0,"delta":{"content":"OK"}}]}',
        '',
        'data: {"model":"glm-5.3","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
        '',
        'data: [DONE]',
        '',
      ].join('\n'),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    );
  const events = [];
  for await (const event of openAiCompatibleChatStream(
    { messages: [{ role: 'user', content: 'hi' }] },
    zaiProvider(ZAI_CODING_BASE_URL),
    { provider: 'zai-coding-plan', model: 'glm-5.3-flash' },
    streamFetch,
  )) {
    events.push(event);
  }
  const done = events.at(-1)!;
  expect(done.type).toBe('done');
  if (done.type !== 'done') throw new Error('unreachable');
  expect(done.final.model).toBe('glm-5.3-flash');
  expect(done.final.responseModel).toBe('glm-5.3');
});

test('0139 describeChatError treats abort and timeout as network, never as invalid key', () => {
  const timeout = new Error('The operation was aborted');
  timeout.name = 'TimeoutError';
  const timeoutInfo = describeChatError(timeout);
  expect(timeoutInfo.category).toBe('network');
  expect(timeoutInfo.retryable).toBe(true);

  const abort = new Error('This operation was aborted');
  abort.name = 'AbortError';
  const abortInfo = describeChatError(abort);
  expect(abortInfo.category).toBe('network');
});

test('0139 connection test sends one short tool-free request and verifies the answer', async () => {
  let captured: { url: string; body: Record<string, unknown>; auth?: string } | null = null;
  const fetchImpl: typeof fetch = async (url, init) => {
    captured = {
      url: String(url),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      auth: (init?.headers as Record<string, string>)['Authorization'],
    };
    return jsonResponse(200, {
      id: 'chatcmpl-test',
      model: 'glm-5.3',
      choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 17, completion_tokens: 2 },
    });
  };

  const outcome = await runProviderConnectionTest(
    configWith({ 'zai-coding-plan': zaiProvider(ZAI_CODING_BASE_URL) }),
    { provider: 'zai-coding-plan', model: 'glm-5.3' },
    { fetchImpl },
  );

  expect(outcome.ok).toBe(true);
  expect(outcome.requestedModel).toBe('glm-5.3');
  expect(outcome.responseModel).toBe('glm-5.3');
  expect(outcome.finishReason).toBe('stop');
  expect(outcome.textPreview).toBe('OK');
  expect(outcome.elapsedMs).toBeGreaterThanOrEqual(0);
  expect(outcome.error).toBeUndefined();

  expect(captured?.url).toBe(`${ZAI_CODING_BASE_URL}/chat/completions`);
  expect(captured?.body).toMatchObject({
    model: 'glm-5.3',
    max_tokens: 512,
    messages: [{ role: 'user', content: 'Reply with exactly OK.' }],
  });
  expect(captured?.body.tools).toBeUndefined();
  expect(captured?.auth).toBe('Bearer server-side-key');
  // The outcome JSON must not leak the key or auth header back to the browser.
  expect(JSON.stringify(outcome)).not.toContain('server-side-key');
  expect(JSON.stringify(outcome)).not.toContain('Bearer');
});

test('0139 connection test rejects empty and truncated answers as unverified', async () => {
  const truncatedFetch: typeof fetch = async () =>
    jsonResponse(200, {
      id: 'chatcmpl-1',
      model: 'glm-5.3',
      choices: [{ index: 0, message: { role: 'assistant', content: '' }, finish_reason: 'length' }],
    });
  const cfg = configWith({ 'zai-coding-plan': zaiProvider(ZAI_CODING_BASE_URL) });
  const outcome = await runProviderConnectionTest(
    cfg,
    { provider: 'zai-coding-plan', model: 'glm-5.3' },
    { fetchImpl: truncatedFetch },
  );

  expect(outcome.ok).toBe(false);
  expect(outcome.finishReason).toBe('length');
  expect(outcome.error?.category).toBe('empty-response');
  expect(outcome.error?.message).toContain('no visible text');
});

test('0139 connection test fails fast without leaking an unconfigured key', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    throw new Error('must not be called');
  };
  const cfg = parseConfig(
    {
      agent: { default: { provider: 'zai-coding-plan', model: 'glm-5.3' } },
      provider: {
        'zai-coding-plan': {
          type: 'openai-compatible',
          name: 'Z.AI Coding Plan',
          options: {
            baseURL: ZAI_CODING_BASE_URL,
            apiKey: '{env:ZAI_CODING_PLAN_API_KEY}',
          },
          models: { 'glm-5.3': { name: 'GLM-5.3' } },
        },
      },
    },
    { env: {}, strictEnv: false },
  );

  const outcome = await runProviderConnectionTest(
    cfg,
    { provider: 'zai-coding-plan', model: 'glm-5.3' },
    { fetchImpl },
  );

  expect(calls).toBe(0);
  expect(outcome.ok).toBe(false);
  expect(outcome.error?.category).toBe('not-configured');
  expect(outcome.error?.hint).toContain('ZAI_CODING_PLAN_API_KEY');
});

test('0139 billing hint points general-endpoint 1113 at the Coding Plan endpoint', async () => {
  const fetch1113: typeof fetch = async () =>
    jsonResponse(429, zaiErrorBody('1113', 'Insufficient balance or no resource package.'));

  const generalOutcome = await runProviderConnectionTest(
    configWith({ zai: zaiProvider(ZAI_GENERAL_BASE_URL) }),
    { provider: 'zai', model: 'glm-5.3' },
    { fetchImpl: fetch1113 },
  );
  expect(generalOutcome.ok).toBe(false);
  expect(generalOutcome.error?.category).toBe('billing');
  expect(generalOutcome.error?.hint).toContain('Coding Plan');
  expect(generalOutcome.error?.hint).toContain('https://api.z.ai/api/coding/paas/v4');

  const codingOutcome = await runProviderConnectionTest(
    configWith({ 'zai-coding-plan': zaiProvider(ZAI_CODING_BASE_URL) }),
    { provider: 'zai-coding-plan', model: 'glm-5.3' },
    { fetchImpl: fetch1113 },
  );
  expect(codingOutcome.ok).toBe(false);
  expect(codingOutcome.error?.category).toBe('billing');
  // Same code on the coding endpoint is a plain billing problem — no endpoint
  // switch hint.
  expect(codingOutcome.error?.hint).not.toContain('Coding Plan');
});

test('0139 connection test timeout is a network outcome, not a provider verdict', async () => {
  // Review R5: a bare promise plus an abort listener can starve the timer
  // on Bun 1.2.13 when nothing else keeps the event loop alive. A referenced
  // interval (cleared on abort or on settle) makes the fixture independent
  // of unrelated activity, and an already-aborted signal rejects inline.
  const fetchImpl: typeof fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      const keepAlive = setInterval(() => {}, 20);
      const signal = init?.signal;
      const abort = () => {
        clearInterval(keepAlive);
        reject(signal?.reason ?? new Error('aborted'));
      };
      if (signal) {
        if (signal.aborted) {
          abort();
          return;
        }
        signal.addEventListener('abort', abort, { once: true });
      }
    });

  const outcome = await runProviderConnectionTest(
    configWith({ 'zai-coding-plan': zaiProvider(ZAI_CODING_BASE_URL) }),
    { provider: 'zai-coding-plan', model: 'glm-5.3' },
    { fetchImpl, timeoutMs: 30 },
  );

  expect(outcome.ok).toBe(false);
  expect(outcome.error?.category).toBe('network');
  expect(outcome.error?.hint).toContain('does not indicate an invalid API key');
});

test('0139 test-connection route validates ids, restrictions, and types before testing', async () => {
  const providers: Record<string, ProviderEntryT> = {
    acme: {
      type: 'openai-compatible',
      name: 'Acme',
      options: { baseURL: 'https://acme.example/v1', apiKey: 'k' },
      models: { cheap: { name: 'Cheap' } },
    },
    offline: { type: 'mock', name: 'Mock', models: { echo: { name: 'echo' } } },
  };
  const calls: Array<{ provider: string; model: string }> = [];
  const router = createConfigRouter({
    loadConfig: async () => configWith(providers),
    runConnectionTest: async (_cfg, target) => {
      calls.push(target);
      return {
        ok: true,
        provider: target.provider,
        requestedModel: target.model,
        elapsedMs: 5,
        textPreview: 'OK',
      } satisfies ProviderConnectionTestOutcome;
    },
  });

  const ok = await router.request('/test-connection', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'acme', model: 'cheap' }),
  });
  expect(ok.status).toBe(200);
  expect(await ok.json()).toMatchObject({ ok: true, provider: 'acme', requestedModel: 'cheap' });
  expect(calls).toEqual([{ provider: 'acme', model: 'cheap' }]);

  const missingIds = await router.request('/test-connection', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'acme' }),
  });
  expect(missingIds.status).toBe(400);
  expect(await missingIds.json()).toMatchObject({ error: 'invalid_connection_test_request' });

  const unknownProvider = await router.request('/test-connection', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'nope', model: 'cheap' }),
  });
  expect(unknownProvider.status).toBe(404);
  expect(await unknownProvider.json()).toMatchObject({ error: 'unknown_provider' });

  const unknownModel = await router.request('/test-connection', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'acme', model: 'expensive' }),
  });
  expect(unknownModel.status).toBe(404);
  expect(await unknownModel.json()).toMatchObject({ error: 'unknown_model' });

  const mockType = await router.request('/test-connection', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'offline', model: 'echo' }),
  });
  expect(mockType.status).toBe(400);
  expect(await mockType.json()).toMatchObject({ error: 'provider_type_not_testable' });

  const restricted = createConfigRouter({
    loadConfig: async () =>
      configWith(providers, {
        restrict: { enabled: true, providers: ['acme'], models: ['cheap'] },
      }),
    runConnectionTest: async (_cfg, target) => {
      calls.push(target);
      return {
        ok: true,
        provider: target.provider,
        requestedModel: target.model,
        elapsedMs: 1,
      } satisfies ProviderConnectionTestOutcome;
    },
  });
  const hiddenModel = await restricted.request('/test-connection', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'acme', model: 'cheap2' }),
  });
  expect(hiddenModel.status).toBe(404); // not in catalog at all

  const restrictedRouter = createConfigRouter({
    loadConfig: async () =>
      configWith(
        {
          ...providers,
          acme: {
            ...providers.acme!,
            models: { cheap: { name: 'Cheap' }, secret: { name: 'Secret' } },
          },
        },
        { restrict: { enabled: true, providers: ['acme'], models: ['cheap'] } },
      ),
    runConnectionTest: async (_cfg, target) => {
      calls.push(target);
      return {
        ok: true,
        provider: target.provider,
        requestedModel: target.model,
        elapsedMs: 1,
      } satisfies ProviderConnectionTestOutcome;
    },
  });
  const blockedModel = await restrictedRouter.request('/test-connection', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'acme', model: 'secret' }),
  });
  expect(blockedModel.status).toBe(403);
  expect(await blockedModel.json()).toMatchObject({ error: 'model_not_allowed' });

  const allowedModel = await restrictedRouter.request('/test-connection', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'acme', model: 'cheap' }),
  });
  expect(allowedModel.status).toBe(200);
});

test('0139 route uses the real runner and reports an unconfigured key without inference', async () => {
  const router = createConfigRouter({
    loadConfig: async () =>
      parseConfig(
        {
          agent: { default: { provider: 'zai-coding-plan', model: 'glm-5.3' } },
          provider: {
            'zai-coding-plan': {
              type: 'openai-compatible',
              name: 'Z.AI Coding Plan',
              options: {
                baseURL: ZAI_CODING_BASE_URL,
                apiKey: '{env:ZAI_CODING_PLAN_API_KEY}',
              },
              models: { 'glm-5.3': { name: 'GLM-5.3' } },
            },
          },
        },
        { env: {}, strictEnv: false },
      ),
  });

  const response = await router.request('/test-connection', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'zai-coding-plan', model: 'glm-5.3' }),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    ok: false,
    provider: 'zai-coding-plan',
    requestedModel: 'glm-5.3',
    error: { category: 'not-configured' },
  });
});

// ---------- Review follow-ups ----------

import { anthropicChat } from '../packages/llm-gateway/src/providers/anthropic';
import { anthropicChatStream } from '../packages/llm-gateway/src/providers/anthropic-stream';

const REVIEW_API_KEY = '0123456789abcdef0123456789abcdef.ABCDEFGHIJKLMNOP';
const REVIEW_HEADER_VALUE = 'review-only-custom-header-secret';

test('0139 R1: reflected credentials never leave the connection test, in any format', async () => {
  const reflected = JSON.stringify({
    error: {
      code: '1113',
      message: `Key ${REVIEW_API_KEY} was rejected`,
      request: { headers: { 'x-review-token': REVIEW_HEADER_VALUE } },
    },
  });
  const fetchImpl: typeof fetch = async () =>
    new Response(reflected, { status: 401, headers: { 'content-type': 'application/json' } });

  const outcome = await runProviderConnectionTest(
    configWith({
      'review-provider': {
        type: 'openai-compatible',
        name: 'Review Provider',
        options: {
          baseURL: 'https://review.example/v1',
          apiKey: REVIEW_API_KEY,
          headers: { 'x-review-token': REVIEW_HEADER_VALUE },
        },
        models: { cheap: { name: 'Cheap' } },
      },
    }),
    { provider: 'review-provider', model: 'cheap' },
    { fetchImpl },
  );

  expect(outcome.ok).toBe(false);
  expect(outcome.error?.category).toBe('billing');
  const serialized = JSON.stringify(outcome);
  expect(serialized).not.toContain(REVIEW_API_KEY);
  expect(serialized).not.toContain(REVIEW_HEADER_VALUE);
  // The reflected nested request block must not surface at all — only the
  // provider's own code + message fields do.
  expect(serialized).not.toContain('x-review-token');
});

test('0139 R1: anthropic adapters redact reflected keys too', async () => {
  const anthropicReflected = JSON.stringify({
    type: 'error',
    error: { type: 'authentication_error', message: 'invalid x-api-key: sk-ant-1234567890abcdef' },
  });
  const fetchImpl: typeof fetch = async () =>
    new Response(anthropicReflected, {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  const provider: ProviderEntryT = {
    type: 'anthropic',
    name: 'Anthropic',
    options: { baseURL: 'https://api.anthropic.com', apiKey: 'sk-ant-1234567890abcdef' },
  };

  let thrown: unknown;
  try {
    await anthropicChat(
      { messages: [{ role: 'user', content: 'hi' }] },
      provider,
      { provider: 'review-anthropic', model: 'claude-x' },
      fetchImpl,
    );
  } catch (err) {
    thrown = err;
  }
  expect(thrown).toBeInstanceOf(ProviderError);
  const nonStreamError = thrown as ProviderError;
  expect(nonStreamError.category).toBe('auth');
  expect(nonStreamError.providerCode).toBe('authentication_error');
  expect(nonStreamError.message).not.toContain('sk-ant-1234567890abcdef');
  expect(nonStreamError.providerMessage).not.toContain('sk-ant-1234567890abcdef');

  const events = [];
  for await (const event of anthropicChatStream(
    { messages: [{ role: 'user', content: 'hi' }] },
    provider,
    { provider: 'review-anthropic', model: 'claude-x' },
    fetchImpl,
  )) {
    events.push(event);
  }
  const errorEvent = events[0]!;
  expect(errorEvent.type).toBe('error');
  if (errorEvent.type !== 'error') throw new Error('unreachable');
  expect(errorEvent.category).toBe('auth');
  expect(JSON.stringify(events)).not.toContain('sk-ant-1234567890abcdef');
});

test('0139 R2: non-streaming transport failures classify as network with a hint', async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new TypeError('fetch failed');
  };

  const outcome = await runProviderConnectionTest(
    configWith({ 'zai-coding-plan': zaiProvider(ZAI_CODING_BASE_URL) }),
    { provider: 'zai-coding-plan', model: 'glm-5.3' },
    { fetchImpl },
  );

  expect(outcome.ok).toBe(false);
  expect(outcome.error?.category).toBe('network');
  expect(outcome.error?.retryable).toBe(true);
  expect(outcome.error?.hint).toContain('does not indicate an invalid API key');
});

test('0139 R2: anthropic HTTP failures keep status, category and hint', async () => {
  const cases: Array<{ status: number; body: unknown; category: string; retryable: boolean }> = [
    {
      status: 401,
      body: {
        type: 'error',
        error: { type: 'authentication_error', message: 'invalid x-api-key' },
      },
      category: 'auth',
      retryable: false,
    },
    {
      status: 429,
      body: { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } },
      category: 'rate-limit',
      retryable: true,
    },
    {
      status: 529,
      body: { type: 'error', error: { type: 'overloaded_error', message: 'overloaded' } },
      category: 'rate-limit',
      retryable: true,
    },
    {
      status: 503,
      body: { type: 'error', error: { type: 'api_error', message: 'internal' } },
      category: 'server',
      retryable: true,
    },
  ];
  for (const { status, body, category, retryable } of cases) {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    const outcome = await runProviderConnectionTest(
      configWith({
        'review-anthropic': {
          type: 'anthropic',
          name: 'Anthropic Review',
          options: { baseURL: 'https://api.anthropic.com', apiKey: 'sk-ant-review-1234567890' },
          models: { 'claude-x': { name: 'Claude X' } },
        },
      }),
      { provider: 'review-anthropic', model: 'claude-x' },
      { fetchImpl },
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.error?.category).toBe(category);
    expect(outcome.error?.status).toBe(status);
    expect(outcome.error?.retryable).toBe(retryable);
    if (category === 'auth') {
      expect(outcome.error?.hint).toContain('API key');
    }
    expect(JSON.stringify(outcome)).not.toContain('sk-ant-review-1234567890');
  }
});

test('0139 R3: keyless and header-auth providers are testable, not pre-rejected', async () => {
  let calls = 0;
  let sawAuthorization: string | undefined;
  const fetchImpl: typeof fetch = async (_url, init) => {
    calls += 1;
    const headers = init?.headers as Record<string, string>;
    sawAuthorization = headers?.Authorization;
    return jsonResponse(200, {
      id: 'chatcmpl-ok',
      model: 'cheap',
      choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }],
    });
  };

  // Keyless local server: no apiKey at all.
  const keyless = await runProviderConnectionTest(
    configWith({
      local: {
        type: 'openai-compatible',
        name: 'Local',
        options: { baseURL: 'http://localhost:11434/v1' },
        models: { cheap: { name: 'Cheap' } },
      },
    }),
    { provider: 'local', model: 'cheap' },
    { fetchImpl },
  );
  expect(keyless.ok).toBe(true);
  expect(keyless.textPreview).toBe('OK');

  // Header-auth proxy: Authorization comes from configured headers, no apiKey.
  const headerAuth = await runProviderConnectionTest(
    configWith({
      proxy: {
        type: 'openai-compatible',
        name: 'Proxy',
        options: {
          baseURL: 'https://proxy.example/v1',
          headers: { Authorization: 'Bearer proxy-shared-token-123' },
        },
        models: { cheap: { name: 'Cheap' } },
      },
    }),
    { provider: 'proxy', model: 'cheap' },
    { fetchImpl },
  );
  expect(headerAuth.ok).toBe(true);
  expect(calls).toBe(2);
  expect(sawAuthorization).toBe('Bearer proxy-shared-token-123');

  // A genuinely unresolved required env key is still caught before inference.
  const unresolved = parseConfig(
    {
      agent: { default: { provider: 'zai-coding-plan', model: 'glm-5.3' } },
      provider: {
        'zai-coding-plan': {
          type: 'openai-compatible',
          name: 'Z.AI Coding Plan',
          options: { baseURL: ZAI_CODING_BASE_URL, apiKey: '{env:ZAI_CODING_PLAN_API_KEY}' },
          models: { 'glm-5.3': { name: 'GLM-5.3' } },
        },
      },
    },
    { env: {}, strictEnv: false },
  );
  const rejected = await runProviderConnectionTest(
    unresolved,
    { provider: 'zai-coding-plan', model: 'glm-5.3' },
    { fetchImpl },
  );
  expect(rejected.ok).toBe(false);
  expect(rejected.error?.category).toBe('not-configured');
  expect(calls).toBe(2);
});
