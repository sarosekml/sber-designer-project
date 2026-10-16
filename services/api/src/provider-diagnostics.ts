/**
 * Provider connection test (0139 C).
 *
 * One short, tool-free chat completion against a *configured* provider/model
 * pair, so Settings can show "Connection verified" separately from "API key
 * configured". No agent loop, no tools, no MCP, no workspace content, no run
 * artifacts — the caller only passes provider/model ids; endpoints and keys
 * come from the loaded config, never from the request.
 */
import {
  createGateway,
  describeChatError,
  type ProviderErrorCategory,
  type ProviderEntryT,
  type SberDesignerConfig,
} from '@sber-designer/llm-gateway';

export const PROVIDER_CONNECTION_TEST_TIMEOUT_MS = 30_000;
export const PROVIDER_CONNECTION_TEST_MAX_TOKENS = 512;
const TEST_PROMPT = 'Reply with exactly OK.';
const TEXT_PREVIEW_LIMIT = 200;

export interface ProviderConnectionTestTarget {
  provider: string;
  model: string;
}

export type ProviderConnectionTestErrorCategory =
  | ProviderErrorCategory
  | 'not-configured'
  | 'empty-response';

export interface ProviderConnectionTestError {
  message: string;
  category: ProviderConnectionTestErrorCategory;
  /** Next action for the user; always provider-agnostic English UI copy. */
  hint?: string;
  status?: number;
  providerCode?: string;
  retryable: boolean;
}

export interface ProviderConnectionTestOutcome {
  ok: boolean;
  provider: string;
  /** The model id we requested. */
  requestedModel: string;
  /** The model id the provider reported as answering, when reported. */
  responseModel?: string;
  elapsedMs: number;
  finishReason?: string;
  textPreview?: string;
  error?: ProviderConnectionTestError;
}

export interface ProviderConnectionTestOptions {
  fetchImpl?: typeof fetch;
  /** Override the wall-clock budget (tests). */
  timeoutMs?: number;
}

export async function runProviderConnectionTest(
  cfg: SberDesignerConfig,
  target: ProviderConnectionTestTarget,
  opts: ProviderConnectionTestOptions = {},
): Promise<ProviderConnectionTestOutcome> {
  const provider = cfg.provider[target.provider];
  const base = {
    provider: target.provider,
    requestedModel: target.model,
  };

  if (!provider) {
    return {
      ...base,
      ok: false,
      elapsedMs: 0,
      error: {
        message: `Provider "${target.provider}" is not configured.`,
        category: 'not-configured',
        hint: 'Add the provider to sber-designer.json (server side), then reload Settings.',
        retryable: false,
      },
    };
  }

  const apiKey = provider.options?.apiKey;
  // Review R3: an *unresolved* env placeholder is a real misconfiguration the
  // server can detect without inference. A missing apiKey is NOT: keyless
  // endpoints and header-auth proxies are legitimate openai-compatible
  // setups, and the gateway adapter handles both — the provider's own 401 is
  // the authoritative answer there.
  if (apiKey && /^\{env:[A-Z0-9_]+\}$/u.test(apiKey)) {
    const hint = unresolvedKeyHint(apiKey);
    return {
      ...base,
      ok: false,
      elapsedMs: 0,
      error: {
        message: `API key for provider "${target.provider}" is not configured on the server.`,
        category: 'not-configured',
        ...(hint ? { hint } : {}),
        retryable: false,
      },
    };
  }

  const gateway = createGateway(cfg, {
    override: { provider: target.provider, model: target.model },
    ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
  });
  const timeoutMs = opts.timeoutMs ?? PROVIDER_CONNECTION_TEST_TIMEOUT_MS;
  const startedAt = Date.now();
  try {
    const response = await gateway.chat({
      messages: [{ role: 'user', content: TEST_PROMPT }],
      maxTokens: PROVIDER_CONNECTION_TEST_MAX_TOKENS,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const elapsedMs = Date.now() - startedAt;
    const text = response.text.trim();
    // C1 (review): `finishReason: undefined` is accepted as a clean stop —
    // the openai-compatible adapter leaves it undefined exactly when the
    // provider omitted `finish_reason` from an otherwise complete answer.
    // The failing cases ('length', 'content_filter', 'other') are rejected
    // below. Non-empty text already proves endpoint+model contact; anything
    // stricter would fail providers that simply do not echo finish_reason.
    const completedCleanly =
      response.finishReason === undefined || response.finishReason === 'stop';
    if (text.length === 0 || !completedCleanly) {
      return {
        ...base,
        ok: false,
        elapsedMs,
        ...(response.finishReason ? { finishReason: response.finishReason } : {}),
        ...(response.responseModel ? { responseModel: response.responseModel } : {}),
        error: emptyResponseError(text.length === 0, response.finishReason),
      };
    }
    return {
      ...base,
      ok: true,
      elapsedMs,
      ...(response.finishReason ? { finishReason: response.finishReason } : {}),
      ...(response.responseModel ? { responseModel: response.responseModel } : {}),
      textPreview: text.slice(0, TEXT_PREVIEW_LIMIT),
    };
  } catch (err) {
    const described = describeChatError(err);
    const hint = hintForFailure(described, provider);
    return {
      ...base,
      ok: false,
      elapsedMs: Date.now() - startedAt,
      error: {
        message: described.message,
        category: described.category,
        ...(hint ? { hint } : {}),
        ...(described.status !== undefined ? { status: described.status } : {}),
        ...(described.providerCode !== undefined ? { providerCode: described.providerCode } : {}),
        retryable: described.retryable,
      },
    };
  }
}

function emptyResponseError(
  emptyText: boolean,
  finishReason?: string,
): ProviderConnectionTestError {
  if (emptyText) {
    return {
      message:
        finishReason === 'length'
          ? 'Provider returned no visible text: the whole output budget was spent before final content.'
          : 'Provider returned an empty response.',
      category: 'empty-response',
      hint: 'The endpoint and key work, but the model produced no final text. Reasoning models can spend the entire output budget on reasoning — retry or use a larger output limit.',
      retryable: true,
    };
  }
  return {
    message: `Provider response finished with "${finishReason}" instead of a clean stop.`,
    category: 'empty-response',
    hint: 'The request reached the provider, but the answer did not complete cleanly. Retry, or lower the prompt complexity.',
    retryable: true,
  };
}

function unresolvedKeyHint(apiKey: string | undefined): string | undefined {
  const match = /^\{env:([A-Z0-9_]+)\}$/u.exec(apiKey ?? '');
  return match
    ? `Set the ${match[1]} environment variable on the machine running services/api, then reload Settings.`
    : 'Add an apiKey for this provider in sber-designer.json (server side), then reload Settings.';
}

function hintForFailure(
  info: ReturnType<typeof describeChatError>,
  provider: ProviderEntryT,
): string | undefined {
  switch (info.category) {
    case 'auth':
      return 'Check the API key configured for this provider on the server (environment variable). A confirmed auth failure means the key is wrong, expired, or missing.';
    case 'billing':
      if (info.providerCode === '1309') {
        return 'The provider reports the subscription for this key has expired. Renew it in the provider console.';
      }
      if (info.providerCode === '1113' && isZaiGeneralEndpoint(provider)) {
        return 'Z.AI error 1113 on the general API endpoint usually means this key is on a Coding Plan subscription, which needs its own endpoint. Switch to the "Z.AI Coding Plan" provider (baseURL https://api.z.ai/api/coding/paas/v4) or review Z.AI billing.';
      }
      return 'The provider reports a balance or resource-package problem for this key. Review your provider billing.';
    case 'quota':
      return 'The usage quota for this key or model is exhausted. Quotas typically reset at a provider-defined time; retrying immediately will not help.';
    case 'rate-limit':
      return info.retryable
        ? 'The provider is rate limiting or temporarily overloaded. Wait briefly and test again.'
        : 'The provider returned HTTP 429 without a business code, so the cause (rate limit, quota, or billing) is unclear. Check the provider console.';
    case 'model-not-found':
      return 'The provider does not recognize this model id. Update the model ids for this provider in sber-designer.json.';
    case 'model-access':
      return 'This account is not allowed to use the selected model. Pick another model or contact the provider administrator.';
    case 'network':
      return 'No confirmed provider response (network error or timeout). This does not indicate an invalid API key.';
    case 'server':
      return 'The provider reported a server-side error. Retry later; the API key is not the problem.';
    case 'invalid-request':
      return 'The provider rejected the request as invalid. This is a protocol/configuration issue, not a key problem.';
    default:
      return undefined;
  }
}

function isZaiGeneralEndpoint(provider: ProviderEntryT): boolean {
  const baseURL = provider.options?.baseURL ?? '';
  return /^https:\/\/api\.z\.ai\/api\/paas\/v4\/?$/u.test(baseURL);
}
