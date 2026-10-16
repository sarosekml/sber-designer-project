/**
 * Client for POST /api/config/test-connection (0139 C). The request carries
 * provider/model ids only; endpoints and secrets stay server-side.
 */
import { ApiError, API_URL, authHeaders, safeJson, withSignal } from './http';

export interface ProviderConnectionTestError {
  message: string;
  category: string;
  hint?: string;
  status?: number;
  providerCode?: string;
  retryable?: boolean;
}

export interface ProviderConnectionTestResult {
  ok: boolean;
  provider: string;
  requestedModel: string;
  responseModel?: string;
  elapsedMs: number;
  finishReason?: string;
  textPreview?: string;
  error?: ProviderConnectionTestError;
}

export async function testProviderConnection(
  target: { provider: string; model: string },
  signal?: AbortSignal,
): Promise<ProviderConnectionTestResult> {
  const res = await fetch(
    `${API_URL}/api/config/test-connection`,
    withSignal(
      {
        method: 'POST',
        headers: { ...authHeaders(), 'content-type': 'application/json' },
        body: JSON.stringify(target),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as ProviderConnectionTestResult;
}
