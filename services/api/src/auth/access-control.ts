import type { Context, MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';

import { readContextAuthMethod } from './middleware';
import type { AuthMode } from './types';

type AuthEnvironment = Record<string, string | undefined>;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DEFAULT_DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export const PASSWORD_PUBLIC_API_ALLOWLIST = [
  { method: 'GET', path: '/api/version' },
  { method: 'GET', path: '/api/auth/status' },
  { method: 'GET', path: '/api/auth/captcha' },
  { method: 'POST', path: '/api/auth/login' },
  { method: 'POST', path: '/api/auth/register' },
  { method: 'GET', path: '/api/share/:token' },
  { method: '*', path: '/api/preview-share/:token/*' },
] as const;

export function createApiAccessGuard(
  requireUser: MiddlewareHandler,
  mode: AuthMode,
): MiddlewareHandler {
  return async (c, next) => {
    if (isPublicApiRequest(c.req.method, c.req.path, mode)) {
      await next();
      return;
    }
    return requireUser(c, next);
  };
}

export function isPublicApiRequest(
  methodInput: string,
  pathInput: string,
  mode: AuthMode,
): boolean {
  const method = methodInput.toUpperCase();
  const path = normalizePath(pathInput);
  if (method === 'OPTIONS') return true;
  if (method === 'GET' && path === '/api/version') return true;
  if (
    (method === 'GET' && (path === '/api/auth/status' || path === '/api/auth/captcha')) ||
    (method === 'POST' && (path === '/api/auth/login' || path === '/api/auth/register'))
  ) {
    return true;
  }
  if (method === 'GET' && /^\/api\/share\/[^/]+$/u.test(path)) return true;
  if (/^\/api\/preview-share\/[^/]+(?:\/.*)?$/u.test(path)) return true;

  // Preserve the pre-0400 local browser contract. Iframe navigation cannot
  // attach the trusted local identity header; password/server mode uses the
  // same-origin session cookie instead.
  if (mode === 'local') {
    if (method === 'GET' && path === '/api/config') return true;
    if ((method === 'GET' || method === 'HEAD') && /^\/api\/preview(?:\/.*)?$/u.test(path)) {
      return true;
    }
  }

  // The legacy local/OIDC browser bridge has no header-capable WS handshake.
  // Password mode is strict now; the OIDC query-token contract is a follow-up.
  return mode !== 'password' && method === 'GET' && path === '/api/events';
}

export function createApiCors(
  mode: AuthMode,
  env: AuthEnvironment = process.env,
): MiddlewareHandler {
  if (mode === 'local') {
    return cors({
      exposeHeaders: ['etag'],
      origin: (origin) => origin || '*',
      allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: [
        'authorization',
        'content-type',
        'x-sber-designer-user',
        'x-share-password',
        'if-match',
      ],
      credentials: true,
      maxAge: 600,
    });
  }
  const configuredOrigins = parseAllowedOrigins(env.SBER_DESIGNER_ALLOWED_ORIGINS);
  return cors({
    exposeHeaders: ['etag'],
    origin: (origin, c) =>
      isAllowedRequestOrigin(origin, c, configuredOrigins, env) ? origin : null,
    allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'authorization',
      'content-type',
      'x-sber-designer-service-token',
      'x-sber-designer-user',
      'x-share-password',
      'if-match',
    ],
    credentials: true,
    maxAge: 600,
  });
}

export function createCookieOriginCheck(env: AuthEnvironment = process.env): MiddlewareHandler {
  const configuredOrigins = parseAllowedOrigins(env.SBER_DESIGNER_ALLOWED_ORIGINS);
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method) || readContextAuthMethod(c) !== 'session') {
      await next();
      return;
    }

    const origin = c.req.header('origin');
    if (origin) {
      if (isAllowedRequestOrigin(origin, c, configuredOrigins, env)) {
        await next();
        return;
      }
      return c.json({ error: 'origin_forbidden', detail: 'Request origin is not allowed' }, 403);
    }

    // Browser requests without Origin still expose Fetch Metadata. CLI clients
    // send neither header and remain usable with an explicitly supplied cookie.
    const fetchSite = c.req.header('sec-fetch-site');
    if (!fetchSite || fetchSite === 'same-origin' || fetchSite === 'none') {
      await next();
      return;
    }
    return c.json({ error: 'origin_forbidden', detail: 'Cross-site request blocked' }, 403);
  };
}

export function parseAllowedOrigins(value: string | undefined): ReadonlySet<string> {
  const raw = value?.trim();
  const entries = raw ? raw.split(',') : DEFAULT_DEV_ORIGINS;
  const origins = new Set<string>();
  for (const entry of entries) {
    const candidate = entry.trim();
    if (!candidate) continue;
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      throw new Error(`Invalid SBER_DESIGNER_ALLOWED_ORIGINS entry: ${candidate}`);
    }
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error(`Allowed origin must be an http(s) origin without path: ${candidate}`);
    }
    origins.add(url.origin);
  }
  return origins;
}

function isAllowedRequestOrigin(
  origin: string,
  c: Context,
  configuredOrigins: ReadonlySet<string>,
  env: AuthEnvironment,
): boolean {
  if (!origin || origin === 'null') return false;
  let normalizedOrigin: string;
  try {
    normalizedOrigin = new URL(origin).origin;
  } catch {
    return false;
  }
  return (
    normalizedOrigin === effectiveRequestOrigin(c, env) || configuredOrigins.has(normalizedOrigin)
  );
}

function effectiveRequestOrigin(c: Context, env: AuthEnvironment): string {
  const requestUrl = new URL(c.req.url);
  let protocol = requestUrl.protocol;
  let host = c.req.header('host')?.trim() || requestUrl.host;
  if (env.SBER_DESIGNER_TRUST_PROXY?.trim() === '1') {
    const forwardedProtocol = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim();
    if (forwardedProtocol === 'http' || forwardedProtocol === 'https') {
      protocol = `${forwardedProtocol}:`;
    }
    const forwardedHost = c.req.header('x-forwarded-host')?.split(',')[0]?.trim();
    if (forwardedHost) host = forwardedHost;
  }
  return `${protocol}//${host}`;
}

function normalizePath(path: string): string {
  const normalized = path.replace(/\/+$/u, '');
  return normalized || '/';
}
