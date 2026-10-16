import { afterEach, expect, test } from 'bun:test';

import {
  ApiError,
  apiEventsWsUrl,
  authHeaders,
  redirectOnUnauthorized,
  resolveApiUrl,
  safeJson,
  setClientAuthMode,
  unauthorizedRedirectTarget,
  withSignal,
} from './http';

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  setClientAuthMode(null);
});

test('authHeaders carries the dev stub user header only in local mode', () => {
  expect(authHeaders()).toEqual({});
  setClientAuthMode('local');
  const headers = authHeaders();
  expect(headers['x-sber-designer-user']).toBe('local-dev');
  expect(headers['authorization']).toBeUndefined();

  setClientAuthMode('password');
  expect(authHeaders()).toEqual({});
});

test('authHeaders attaches the bearer token from localStorage when present', () => {
  (globalThis as { window?: unknown }).window = {
    localStorage: { getItem: (key: string) => (key === 'sd-oidc-token' ? 'tok-123' : null) },
  };
  setClientAuthMode('oidc');
  expect(authHeaders()['authorization']).toBe('Bearer tok-123');
});

test('withSignal includes password cookies and copies an optional signal', () => {
  const init: RequestInit = { method: 'POST' };
  expect(withSignal(init)).toEqual({ method: 'POST', credentials: 'include' });
  const controller = new AbortController();
  const wired = withSignal(init, controller.signal);
  expect(wired).not.toBe(init);
  expect(wired.signal).toBe(controller.signal);
  expect(wired.method).toBe('POST');
  expect(wired.credentials).toBe('include');
});

test('ApiError exposes status, code and run metadata getters', () => {
  const err = new ApiError('boom', 422, 'screen_move_failed', {
    attemptId: 'a1',
    debugLogPath: '/tmp/log.jsonl',
  });
  expect(err.message).toBe('boom');
  expect(err.status).toBe(422);
  expect(err.code).toBe('screen_move_failed');
  expect(err.attemptId).toBe('a1');
  expect(err.debugLogPath).toBe('/tmp/log.jsonl');
  expect(err.runManifestPath).toBeUndefined();
  expect(err.blockingRun).toBeUndefined();
  expect(err.captchaRequired).toBe(false);
  expect(err.retryAfter).toBeUndefined();
});

test('safeJson parses an error body and returns null for non-JSON', async () => {
  const ok = await safeJson(
    new Response(JSON.stringify({ error: 'no_workspace', detail: 'Connect a project first.' })),
  );
  expect(ok?.error).toBe('no_workspace');
  expect(ok?.detail).toBe('Connect a project first.');

  const broken = await safeJson(new Response('<html>nope</html>'));
  expect(broken).toBeNull();
});

test('safeJson can keep credential errors on an inline auth form', async () => {
  const assigned: string[] = [];
  (globalThis as { window?: unknown }).window = {
    location: {
      pathname: '/',
      search: '',
      hash: '',
      assign: (url: string) => assigned.push(url),
    },
  };
  const body = await safeJson(
    new Response(JSON.stringify({ error: 'invalid_credentials' }), { status: 401 }),
    { redirectUnauthorized: false },
  );
  expect(body?.error).toBe('invalid_credentials');
  expect(assigned).toEqual([]);
});

test('apiEventsWsUrl is a ws(s) URL pointing at /api/events', () => {
  expect(apiEventsWsUrl.startsWith('ws')).toBe(true);
  expect(apiEventsWsUrl.endsWith('/api/events')).toBe(true);
});

test('unauthorized redirect preserves the protected destination and skips public auth routes', () => {
  expect(unauthorizedRedirectTarget('/edit/project-1', '?tab=code', '#line-2')).toBe(
    '/login?next=%2Fedit%2Fproject-1%3Ftab%3Dcode%23line-2',
  );
  expect(unauthorizedRedirectTarget('/login')).toBeNull();
  expect(unauthorizedRedirectTarget('/register')).toBeNull();
  expect(unauthorizedRedirectTarget('/share/token-1')).toBeNull();
});

test('redirectOnUnauthorized navigates only for a 401 on a protected page', () => {
  const assigned: string[] = [];
  const location = {
    pathname: '/profile',
    search: '',
    hash: '',
    assign: (url: string) => assigned.push(url),
  };
  expect(redirectOnUnauthorized(403, location)).toBe(false);
  expect(redirectOnUnauthorized(401, location)).toBe(true);
  expect(assigned).toEqual(['/login?next=%2Fprofile']);
});

test('resolveApiUrl prefers the explicit split-domain override', () => {
  expect(
    resolveApiUrl({
      configuredUrl: ' https://api.example.test/ ',
      isProduction: true,
      windowOrigin: 'https://web.example.test',
    }),
  ).toBe('https://api.example.test');
});

test('resolveApiUrl uses the browser origin for a production build without an override', () => {
  const resolved = resolveApiUrl({
    configuredUrl: undefined,
    isProduction: true,
    windowOrigin: 'https://designer.example.test',
  });

  expect(resolved).toBe('https://designer.example.test');
  expect(new URL('/api/version', resolved).toString()).toBe(
    'https://designer.example.test/api/version',
  );
});

test('resolveApiUrl keeps the local api default in dev and non-browser runtimes', () => {
  expect(
    resolveApiUrl({
      configuredUrl: '   ',
      isProduction: false,
      windowOrigin: 'http://localhost:5173',
    }),
  ).toBe('http://localhost:3000');
  expect(
    resolveApiUrl({
      configuredUrl: undefined,
      isProduction: true,
      windowOrigin: undefined,
    }),
  ).toBe('http://localhost:3000');
});
