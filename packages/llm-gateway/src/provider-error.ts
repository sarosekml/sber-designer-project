/**
 * Structured provider error metadata (0139).
 *
 * HTTP failures carry more signal than "429 happened": Z.AI (and OpenAI-style
 * APIs generally) put a business code inside the error body, and that code —
 * not the HTTP status — decides what the user should do next (auth vs billing
 * vs quota vs temporary overload). This module parses that body in a bounded,
 * redacted way and classifies it, while adapters keep their existing message
 * prefixes so callers that only read `message` are unaffected.
 *
 * Redaction (review R1): the *configured* credential values (apiKey, custom
 * header values) are removed from every string that reaches a caller,
 * regardless of their format — a provider that echoes the key back must never
 * leak it through `message`, `providerMessage` or the connection-test
 * response. Only the provider's own `error.code` / `error.type` /
 * `error.message` fields are surfaced; arbitrary nested fields of the error
 * body (where upstreams sometimes reflect the whole request) are never
 * included verbatim.
 *
 * Code → category mapping follows the Z.AI error reference
 * (https://docs.z.ai/api-reference/api-code), verified 2026-09-20; Anthropic
 * `error.type` strings are mapped per
 * https://docs.claude.com/en/api/errors.
 */

export type ProviderErrorCategory =
  | 'auth'
  | 'billing'
  | 'quota'
  | 'rate-limit'
  | 'model-not-found'
  | 'model-access'
  | 'invalid-request'
  | 'server'
  | 'network'
  | 'unknown';

export interface ProviderErrorInfo {
  /** HTTP status of the failed response, when there was one. */
  status?: number;
  /** Provider business code from the error body (e.g. Z.AI "1113"). */
  providerCode?: string;
  /** Provider-authored message from the error body, already redacted. */
  providerMessage?: string;
  category: ProviderErrorCategory;
  /**
   * Whether retrying the same request could plausibly succeed. A bare HTTP
   * 429 without a business code is deliberately NOT retryable — the status
   * alone does not identify a transient condition (0139 acceptance).
   */
  retryable: boolean;
}

/**
 * Credential values actually used for the request. Exact values are removed
 * from all error text before it leaves the gateway (review R1).
 */
export interface ProviderSecrets {
  apiKey?: string;
  headerValues?: string[];
}

/** Error with attached ProviderErrorInfo; message matches the legacy prefix. */
export class ProviderError extends Error {
  readonly status: number | undefined;
  readonly providerCode: string | undefined;
  readonly providerMessage: string | undefined;
  readonly category: ProviderErrorCategory;
  readonly retryable: boolean;

  constructor(message: string, info: ProviderErrorInfo) {
    super(message);
    this.name = 'ProviderError';
    this.status = info.status;
    this.providerCode = info.providerCode;
    this.providerMessage = info.providerMessage;
    this.category = info.category;
    this.retryable = info.retryable;
  }
}

const CODE_CATEGORY_BY_PROVIDER_CODE: Record<
  string,
  { category: ProviderErrorCategory; retryable: boolean }
> = {
  // Auth failures / invalid key.
  '1000': { category: 'auth', retryable: false },
  '1001': { category: 'auth', retryable: false },
  '1003': { category: 'auth', retryable: false },
  // Balance / resource package / subscription.
  '1113': { category: 'billing', retryable: false },
  '1309': { category: 'billing', retryable: false },
  // Unknown model id.
  '1211': { category: 'model-not-found', retryable: false },
  // Model not available to this account.
  '1220': { category: 'model-access', retryable: false },
  '1311': { category: 'model-access', retryable: false },
  // Rate limit / temporary overload.
  '1302': { category: 'rate-limit', retryable: true },
  '1305': { category: 'rate-limit', retryable: true },
  // Quota exhausted.
  '1308': { category: 'quota', retryable: false },
  '1310': { category: 'quota', retryable: false },
  // Anthropic error.type strings (OpenAI uses these too on some endpoints).
  authentication_error: { category: 'auth', retryable: false },
  permission_error: { category: 'model-access', retryable: false },
  not_found_error: { category: 'model-not-found', retryable: false },
  rate_limit_error: { category: 'rate-limit', retryable: true },
  overloaded_error: { category: 'rate-limit', retryable: true },
  api_error: { category: 'server', retryable: true },
  invalid_request_error: { category: 'invalid-request', retryable: false },
};

const SECRET_PATTERNS: RegExp[] = [
  /\b(?:sk|gsk)-[A-Za-z0-9_-]{8,}\b/g,
  /\bbearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
];

/** Values shorter than this are not worth blanket-replacing in free text. */
const MIN_REDACTABLE_SECRET_LENGTH = 8;

/**
 * Remove credential material from provider-provided text: first the exact
 * configured values (any format — reflected keys, custom header values),
 * then recognizable credential shapes as defense in depth.
 */
export function redactProviderSecrets(text: string, secrets: ProviderSecrets = {}): string {
  let out = text;
  const exactValues = [
    ...(secrets.apiKey !== undefined && secrets.apiKey !== '' ? [secrets.apiKey] : []),
    ...(secrets.headerValues ?? []),
  ];
  for (const value of exactValues) {
    if (typeof value !== 'string' || value.length < MIN_REDACTABLE_SECRET_LENGTH) continue;
    if (value.includes('[redacted]')) continue;
    out = out.split(value).join('[redacted]');
  }
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (match) => match.replace(/[A-Za-z0-9._~+/=-]{4,}$/, '[redacted]'));
  }
  return out;
}

/** Collect the credential values a provider entry contributed to the request. */
export function providerSecretsOf(provider: {
  options?:
    | { apiKey?: string | undefined; headers?: Record<string, string> | undefined }
    | undefined;
}): ProviderSecrets {
  const options = provider.options;
  if (!options) return {};
  return {
    ...(options.apiKey ? { apiKey: options.apiKey } : {}),
    ...(options.headers
      ? { headerValues: Object.values(options.headers).filter((v) => v !== '') }
      : {}),
  };
}

/**
 * Build the human-facing failure message from an HTTP error response. The
 * prefix keeps the legacy adapter format; the payload is assembled only from
 * the provider's `error.code` / `error.type` / `error.message` (or the
 * top-level `message`) so reflected request fields never surface (R1). When
 * the body is not JSON, a bounded redacted excerpt is used.
 */
export function providerHttpErrorMessage(
  providerKey: string,
  status: number,
  statusText: string,
  bodyText: string,
  secrets: ProviderSecrets,
  style: 'returned' | 'plain',
): string {
  const prefix =
    style === 'returned'
      ? `Provider "${providerKey}" returned HTTP ${status} ${statusText}`
      : `Provider "${providerKey}" HTTP ${status}`;
  return `${prefix}: ${summarizeErrorBody(bodyText, secrets)}`;
}

function summarizeErrorBody(bodyText: string, secrets: ProviderSecrets): string {
  const bounded = bodyText.slice(0, 4000);
  let parsed: unknown;
  try {
    parsed = JSON.parse(bounded) as unknown;
  } catch {
    return redactProviderSecrets(bounded, secrets).slice(0, 300);
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return redactProviderSecrets(bounded, secrets).slice(0, 300);
  }
  const error = (parsed as { error?: unknown }).error;
  const source =
    typeof error === 'object' && error !== null
      ? (error as { code?: unknown; type?: unknown; message?: unknown })
      : (parsed as { code?: unknown; type?: unknown; message?: unknown });
  const parts: string[] = [];
  const code = normalizeCode(source?.code);
  if (code !== undefined) parts.push(`code ${code}`);
  else {
    const type = normalizeCode(source?.type);
    if (type !== undefined) parts.push(`type ${type}`);
  }
  if (typeof source?.message === 'string' && source.message.trim() !== '') {
    parts.push(source.message.trim().slice(0, 300));
  }
  if (parts.length === 0) {
    return redactProviderSecrets(bounded, secrets).slice(0, 300);
  }
  return redactProviderSecrets(parts.join(': '), secrets).slice(0, 400);
}

/**
 * Parse an HTTP error body (bounded) and classify the failure. Accepts both
 * numeric and string business codes and Anthropic-style `error.type`
 * strings; unknown codes fall back to the HTTP status. Never throws — an
 * unparseable body is simply classified by status.
 */
export function analyzeProviderHttpFailure(
  status: number,
  bodyText: string,
  secrets: ProviderSecrets = {},
): ProviderErrorInfo {
  const { code, message } = parseErrorBody(bodyText, secrets);
  const byCode = code !== undefined ? CODE_CATEGORY_BY_PROVIDER_CODE[code] : undefined;
  if (byCode !== undefined && code !== undefined) {
    return {
      status,
      providerCode: code,
      ...(message ? { providerMessage: message } : {}),
      ...byCode,
    };
  }
  return {
    status,
    ...(code !== undefined ? { providerCode: code } : {}),
    ...(message ? { providerMessage: message } : {}),
    ...classifyByHttpStatus(status),
  };
}

function classifyByHttpStatus(status: number): {
  category: ProviderErrorCategory;
  retryable: boolean;
} {
  if (status === 401 || status === 403) return { category: 'auth', retryable: false };
  if (status === 408) return { category: 'network', retryable: true };
  if (status === 429) return { category: 'rate-limit', retryable: false };
  if (status === 404) return { category: 'model-not-found', retryable: false };
  if (status >= 500) return { category: 'server', retryable: true };
  if (status === 400 || status === 422) return { category: 'invalid-request', retryable: false };
  return { category: 'unknown', retryable: false };
}

function parseErrorBody(
  bodyText: string,
  secrets: ProviderSecrets,
): { code?: string; message?: string } {
  const bounded = bodyText.slice(0, 4000);
  let parsed: unknown;
  try {
    parsed = JSON.parse(bounded) as unknown;
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null) return {};
  const error = (parsed as { error?: unknown }).error;
  const source =
    typeof error === 'object' && error !== null
      ? (error as { code?: unknown; type?: unknown; message?: unknown })
      : (parsed as { code?: unknown; type?: unknown; message?: unknown });
  const code = normalizeCode(source?.code) ?? normalizeCode(source?.type);
  const message =
    typeof source?.message === 'string' && source.message.trim() !== ''
      ? redactProviderSecrets(source.message, secrets).slice(0, 300)
      : undefined;
  return { ...(code !== undefined ? { code } : {}), ...(message ? { message } : {}) };
}

function normalizeCode(raw: unknown): string | undefined {
  if (typeof raw === 'string' && raw.trim() !== '') return raw.trim();
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  return undefined;
}

/**
 * Normalize any error thrown by gateway.chat()/chatStream() into
 * ProviderErrorInfo + a safe message. Network/abort failures are 'network' —
 * an unconfirmed request must never be presented as an invalid key (0139 D).
 */
export function describeChatError(err: unknown): ProviderErrorInfo & { message: string } {
  if (err instanceof ProviderError) {
    return {
      message: err.message,
      ...(err.status !== undefined ? { status: err.status } : {}),
      ...(err.providerCode !== undefined ? { providerCode: err.providerCode } : {}),
      ...(err.providerMessage !== undefined ? { providerMessage: err.providerMessage } : {}),
      category: err.category,
      retryable: err.retryable,
    };
  }
  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return {
        message: 'Provider request aborted or timed out before a confirmed response.',
        category: 'network',
        retryable: true,
      };
    }
    return { message: err.message, category: 'unknown', retryable: false };
  }
  return { message: String(err), category: 'unknown', retryable: false };
}

/**
 * Metadata for transport-level throws where no HTTP response existed (fetch
 * rejected, connection reset, timeout). User-initiated aborts are reported as
 * non-retryable; timeouts and connection errors may be transient.
 */
export function networkFailureInfo(err: unknown): ProviderErrorInfo {
  if (err instanceof Error && err.name === 'AbortError') {
    return { category: 'network', retryable: false };
  }
  return { category: 'network', retryable: true };
}

/**
 * Wrap a transport-level `fetch` rejection into a structured ProviderError so
 * non-streaming call sites classify connection failures as 'network' exactly
 * like the streaming adapters do (review R2). Parse errors of a *successful*
 * response must NOT go through this helper — they are not network failures.
 */
export function providerTransportError(err: unknown): ProviderError {
  return new ProviderError(
    err instanceof Error ? err.message : String(err),
    networkFailureInfo(err),
  );
}
