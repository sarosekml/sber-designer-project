/**
 * Shared HTTP plumbing for the services/api client: base URL, auth
 * headers, abort wiring, error shape, and the /api/config bootstrap.
 * Leaf module — must not import from sibling lib/api modules.
 */
import type { SberDesignerConfig } from '@sber-designer/llm-gateway';
import type {
  AssistantActiveRun,
  GenerationPipelinePreferences,
} from '@sber-designer/shared-types';

export type FrontendConfig = SberDesignerConfig & {
  system?: { dsBrowser: { defaultEnabled: boolean } };
  preferences?: {
    generationPipeline?: GenerationPipelinePreferences;
    generativeThumbnailEnabled?: boolean;
  };
  /**
   * Opaque server-side revision of the resolved config (review R4). Changes
   * with any effective endpoint/auth/model wiring; used to invalidate stale
   * connection-test results. Absent in the static offline fallback.
   */
  configRevision?: string;
};

export const OIDC_TOKEN_KEY = 'sd-oidc-token';

export type ClientAuthMode = 'local' | 'password' | 'oidc';

let clientAuthMode: ClientAuthMode | null = null;

/** Set after the public /api/auth/status bootstrap completes. */
export function setClientAuthMode(mode: ClientAuthMode | null): void {
  clientAuthMode = mode;
}

/**
 * Build the auth header set for an authenticated /api request.
 * Reads the OIDC token from localStorage on every call so log-out /
 * refresh take effect immediately.
 */
export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (clientAuthMode === 'local') {
    headers['x-sber-designer-user'] = 'local-dev';
  }
  if (clientAuthMode === 'oidc' && typeof window !== 'undefined') {
    const token = window.localStorage.getItem(OIDC_TOKEN_KEY);
    if (token) headers['authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export function withSignal(init: RequestInit, signal?: AbortSignal): RequestInit {
  const authenticatedInit: RequestInit = { credentials: 'include', ...init };
  return signal ? { ...authenticatedInit, signal } : authenticatedInit;
}

interface ApiUrlOptions {
  configuredUrl: string | undefined;
  isProduction: boolean;
  windowOrigin: string | undefined;
}

/** Resolve an absolute API base for both split-domain dev and same-origin builds. */
export function resolveApiUrl(options: ApiUrlOptions): string {
  const configuredUrl = options.configuredUrl?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');

  if (options.isProduction && options.windowOrigin) {
    return options.windowOrigin.replace(/\/+$/, '');
  }

  return 'http://localhost:3000';
}

const viteEnv = (
  import.meta as unknown as {
    env?: { VITE_API_URL?: string; PROD?: boolean };
  }
).env;

export const API_URL = resolveApiUrl({
  configuredUrl: viteEnv?.VITE_API_URL,
  isProduction: viteEnv?.PROD === true,
  windowOrigin:
    typeof window !== 'undefined' && window.location ? window.location.origin : undefined,
});

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly metadata: {
      attemptId?: string;
      debugLogPath?: string;
      runManifestPath?: string;
      blockingRun?: AssistantActiveRun;
      activeRuns?: AssistantActiveRun[];
      captchaRequired?: boolean;
      retryAfter?: number;
    } = {},
  ) {
    super(message);
  }

  get attemptId(): string | undefined {
    return this.metadata.attemptId;
  }

  get debugLogPath(): string | undefined {
    return this.metadata.debugLogPath;
  }

  get runManifestPath(): string | undefined {
    return this.metadata.runManifestPath;
  }

  get blockingRun(): AssistantActiveRun | undefined {
    return this.metadata.blockingRun;
  }

  get activeRuns(): AssistantActiveRun[] | undefined {
    return this.metadata.activeRuns;
  }

  get captchaRequired(): boolean {
    return this.metadata.captchaRequired === true;
  }

  get retryAfter(): number | undefined {
    return this.metadata.retryAfter;
  }
}

export async function fetchConfig(signal?: AbortSignal): Promise<FrontendConfig> {
  const res = await fetch(`${API_URL}/api/config`, withSignal({ headers: authHeaders() }, signal));
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as FrontendConfig;
}

export async function updateGenerationPipelinePreferences(
  preferences: GenerationPipelinePreferences,
): Promise<GenerationPipelinePreferences> {
  const res = await fetch(
    `${API_URL}/api/config/generation-pipeline`,
    withSignal({
      method: 'PUT',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(preferences),
    }),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  const body = (await res.json()) as { generationPipeline?: GenerationPipelinePreferences };
  return body.generationPipeline ?? {};
}

export async function updateGenerativeThumbnailPreference(enabled: boolean): Promise<boolean> {
  const res = await fetch(
    `${API_URL}/api/config/generative-thumbnail`,
    withSignal({
      method: 'PUT',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  const body = (await res.json()) as { enabled?: boolean };
  return body.enabled ?? enabled;
}

export async function safeJson(
  res: Response,
  options: { redirectUnauthorized?: boolean } = {},
): Promise<{
  error?: string;
  detail?: string;
  attemptId?: string;
  debugLogPath?: string;
  runManifestPath?: string;
  blockingRun?: AssistantActiveRun;
  activeRuns?: AssistantActiveRun[];
  captchaRequired?: boolean;
  retryAfter?: number;
} | null> {
  if (options.redirectUnauthorized !== false) redirectOnUnauthorized(res.status);
  try {
    return (await res.json()) as {
      error?: string;
      detail?: string;
      attemptId?: string;
      debugLogPath?: string;
      runManifestPath?: string;
      blockingRun?: AssistantActiveRun;
      activeRuns?: AssistantActiveRun[];
      captchaRequired?: boolean;
      retryAfter?: number;
    };
  } catch {
    return null;
  }
}

interface BrowserLocation {
  pathname: string;
  search: string;
  hash: string;
  assign(url: string): void;
}

/** Return a login URL for protected pages, or null where a 401 is handled in place. */
export function unauthorizedRedirectTarget(
  pathname: string,
  search = '',
  hash = '',
): string | null {
  if (pathname === '/login' || pathname === '/register' || /^\/share(?:\/|$)/.test(pathname)) {
    return null;
  }
  const next = `${pathname || '/'}${search}${hash}`;
  return `/login?${new URLSearchParams({ next }).toString()}`;
}

export function redirectOnUnauthorized(
  status: number,
  location: BrowserLocation | undefined = browserLocation(),
): boolean {
  if (status !== 401 || !location) return false;
  const target = unauthorizedRedirectTarget(location.pathname, location.search, location.hash);
  if (!target) return false;
  location.assign(target);
  return true;
}

function browserLocation(): BrowserLocation | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.location;
}

export const apiBaseUrl = API_URL;

/** WS URL for the events channel (ADR-0010). */
export const apiEventsWsUrl = (() => {
  try {
    const u = new URL(API_URL);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    u.pathname = (u.pathname.replace(/\/+$/, '') || '') + '/api/events';
    return u.toString();
  } catch {
    return `${API_URL.replace(/^http/, 'ws')}/api/events`;
  }
})();
