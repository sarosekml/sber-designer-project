import { describe, expect, test } from 'bun:test';
import { Hono, type MiddlewareHandler } from 'hono';

import {
  createApiAccessGuard,
  createApiCors,
  createCookieOriginCheck,
  isPublicApiRequest,
  parseAllowedOrigins,
  PASSWORD_PUBLIC_API_ALLOWLIST,
} from '../services/api/src/auth/access-control';
import {
  createRequireUser,
  readContextAuthMethod,
  readContextUser,
} from '../services/api/src/auth/middleware';
import { parseServiceTokens } from '../services/api/src/auth/service-tokens';
import type { AuthService } from '../services/api/src/auth/service';

const SERVICE_TOKEN = 'a'.repeat(64);
const fakeOidc = {
  async verify(): Promise<never> {
    throw new Error('OIDC is not used by these tests');
  },
};

describe('0400 password API allowlist', () => {
  test('keeps the public surface as an explicit snapshot', () => {
    expect(PASSWORD_PUBLIC_API_ALLOWLIST).toMatchInlineSnapshot(`
      [
        {
          "method": "GET",
          "path": "/api/version",
        },
        {
          "method": "GET",
          "path": "/api/auth/status",
        },
        {
          "method": "GET",
          "path": "/api/auth/captcha",
        },
        {
          "method": "POST",
          "path": "/api/auth/login",
        },
        {
          "method": "POST",
          "path": "/api/auth/register",
        },
        {
          "method": "GET",
          "path": "/api/share/:token",
        },
        {
          "method": "*",
          "path": "/api/preview-share/:token/*",
        },
      ]
    `);
  });

  test('matches only the documented method/path pairs', () => {
    expect(isPublicApiRequest('GET', '/api/version', 'password')).toBe(true);
    expect(isPublicApiRequest('GET', '/api/auth/status/', 'password')).toBe(true);
    expect(isPublicApiRequest('POST', '/api/auth/login', 'password')).toBe(true);
    expect(isPublicApiRequest('GET', '/api/share/token-1', 'password')).toBe(true);
    expect(isPublicApiRequest('DELETE', '/api/share/token-1', 'password')).toBe(false);
    expect(isPublicApiRequest('GET', '/api/share/token-1/files', 'password')).toBe(false);
    expect(isPublicApiRequest('GET', '/api/preview-share/token-1/index.html', 'password')).toBe(
      true,
    );
    expect(isPublicApiRequest('GET', '/api/config', 'password')).toBe(false);
    expect(isPublicApiRequest('GET', '/api/preview/session-1', 'password')).toBe(false);
    expect(isPublicApiRequest('GET', '/api/events', 'password')).toBe(false);
    expect(isPublicApiRequest('GET', '/api/events', 'local')).toBe(true);
    expect(isPublicApiRequest('GET', '/api/config', 'local')).toBe(true);
    expect(isPublicApiRequest('GET', '/api/preview/iframe.html', 'local')).toBe(true);
    expect(isPublicApiRequest('HEAD', '/api/preview/index.json', 'local')).toBe(true);
    expect(isPublicApiRequest('POST', '/api/preview/action', 'local')).toBe(false);
    expect(isPublicApiRequest('POST', '/api/events/publish', 'local')).toBe(false);
    // 0135: Home fetches artwork through the authenticated API client before
    // handing an object URL to <img>, so local/OIDC reads stay protected too.
    expect(isPublicApiRequest('GET', '/api/projects/p1/cover', 'local')).toBe(false);
    expect(isPublicApiRequest('HEAD', '/api/projects/p1/thumbnail', 'local')).toBe(false);
    expect(isPublicApiRequest('PUT', '/api/projects/p1/cover', 'local')).toBe(false);
    expect(isPublicApiRequest('GET', '/api/projects/p1/cover-screen', 'local')).toBe(false);
    expect(isPublicApiRequest('GET', '/api/projects/p1', 'local')).toBe(false);
    expect(isPublicApiRequest('GET', '/api/projects/p1/cover', 'password')).toBe(false);
  });

  test('rejects anonymous config, preview and WebSocket upgrade before handlers run', async () => {
    const app = accessGuardApp();
    for (const path of ['/api/config', '/api/preview/session-1']) {
      const response = await app.request(`http://api.example${path}`);
      expect(response.status).toBe(401);
    }
    const upgrade = await app.request('http://api.example/api/events', {
      headers: { connection: 'Upgrade', upgrade: 'websocket' },
    });
    expect(upgrade.status).toBe(401);
    expect((await upgrade.json()).error).toBe('unauthenticated');
  });

  test('allows authenticated current and future API routes through one guard', async () => {
    const app = accessGuardApp();
    for (const path of ['/api/config', '/api/preview/session-1', '/api/future-route']) {
      const response = await app.request(`http://api.example${path}`, {
        headers: { 'x-test-auth': 'yes' },
      });
      expect(response.status).toBe(200);
      expect((await response.json()).user).toBe('test-user');
    }
  });
});

describe('0400 service tokens', () => {
  test('parses named tokens and rejects unsafe configuration', () => {
    expect(parseServiceTokens(`smoke:${SERVICE_TOKEN},mcp:${'b'.repeat(64)}`)).toEqual([
      { name: 'smoke', token: SERVICE_TOKEN },
      { name: 'mcp', token: 'b'.repeat(64) },
    ]);
    expect(() => parseServiceTokens('Bad Name:too-short')).toThrow('Invalid service token name');
    expect(() => parseServiceTokens('smoke:short')).toThrow('at least 32 characters');
    expect(() => parseServiceTokens(`smoke:${SERVICE_TOKEN},smoke:${'b'.repeat(64)}`)).toThrow(
      'Duplicate',
    );
  });

  test('authenticates a matching token as svc:name and rejects a wrong one', async () => {
    const service = {
      async authenticateSession() {
        return null;
      },
    } as unknown as AuthService;
    const requireUser = createRequireUser({
      mode: 'password',
      service,
      oidc: fakeOidc,
      serviceTokens: parseServiceTokens(`mcp:${SERVICE_TOKEN}`),
    });
    const app = new Hono();
    app.use('/private', requireUser);
    app.get('/private', (c) =>
      c.json({ user: readContextUser(c, 'password'), method: readContextAuthMethod(c) }),
    );

    const allowed = await app.request('http://api.example/private', {
      headers: { 'x-sber-designer-service-token': SERVICE_TOKEN },
    });
    expect(await allowed.json()).toEqual({ user: 'svc:mcp', method: 'service' });
    expect(
      (
        await app.request('http://api.example/private', {
          headers: { 'x-sber-designer-service-token': 'wrong'.repeat(16) },
        })
      ).status,
    ).toBe(401);
  });

  test('does not verify an identity twice when global and route guards are nested', async () => {
    let sessionChecks = 0;
    const service = {
      async authenticateSession() {
        sessionChecks += 1;
        return null;
      },
    } as unknown as AuthService;
    const requireUser = createRequireUser({ mode: 'password', service, oidc: fakeOidc });
    const app = new Hono();
    app.use('/private', async (c, next) => {
      c.set('user', 'member@example.com');
      c.set('authMethod', 'session');
      await next();
    });
    app.use('/private', requireUser);
    app.get('/private', (c) => c.json({ user: readContextUser(c, 'password') }));

    const response = await app.request('http://api.example/private');
    expect(response.status).toBe(200);
    expect(sessionChecks).toBe(0);
  });
});

describe('0400 CORS and cookie origin checks', () => {
  test('keeps arbitrary local development origins available', async () => {
    const app = corsApp({}, 'local');
    for (const origin of ['http://localhost:5174', 'http://192.168.1.10:5173']) {
      const response = await app.request('http://api.example/api/value', {
        headers: { origin },
      });
      expect(response.headers.get('access-control-allow-origin')).toBe(origin);
      expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    }
  });

  test('allows same-origin and default Vite dev origins with credentials', async () => {
    const app = corsApp();
    const sameOrigin = await app.request('http://api.example/api/value', {
      headers: { origin: 'http://api.example' },
    });
    expect(sameOrigin.headers.get('access-control-allow-origin')).toBe('http://api.example');
    expect(sameOrigin.headers.get('access-control-allow-credentials')).toBe('true');

    const dev = await app.request('http://api.example/api/value', {
      headers: { origin: 'http://localhost:5173' },
    });
    expect(dev.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');

    const foreign = await app.request('http://api.example/api/value', {
      headers: { origin: 'https://evil.example' },
    });
    expect(foreign.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('uses configured origins instead of the dev defaults and validates entries', async () => {
    const app = corsApp({ SBER_DESIGNER_ALLOWED_ORIGINS: 'https://web.example' });
    const configured = await app.request('http://api.example/api/value', {
      headers: { origin: 'https://web.example' },
    });
    expect(configured.headers.get('access-control-allow-origin')).toBe('https://web.example');
    const dev = await app.request('http://api.example/api/value', {
      headers: { origin: 'http://localhost:5173' },
    });
    expect(dev.headers.get('access-control-allow-origin')).toBeNull();
    expect(() => parseAllowedOrigins('https://web.example/path')).toThrow('without path');
  });

  test('returns credentialed preflight only for an allowed origin', async () => {
    const app = corsApp();
    const response = await app.request('http://api.example/api/value', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
  });

  test('blocks foreign cookie-authenticated mutations but not service-token calls', async () => {
    const app = originCheckApp();
    const sameOrigin = await mutation(app, 'session', 'http://api.example');
    expect(sameOrigin.status).toBe(200);
    const allowedDev = await mutation(app, 'session', 'http://localhost:5173');
    expect(allowedDev.status).toBe(200);
    const foreign = await mutation(app, 'session', 'https://evil.example');
    expect(foreign.status).toBe(403);
    expect((await foreign.json()).error).toBe('origin_forbidden');
    expect((await mutation(app, 'service', 'https://evil.example')).status).toBe(200);

    const fetchMetadataOnly = await app.request('http://api.example/api/mutate', {
      method: 'POST',
      headers: { 'x-auth-method': 'session', 'sec-fetch-site': 'cross-site' },
    });
    expect(fetchMetadataOnly.status).toBe(403);
  });

  test('honors trusted proxy protocol and host for same-origin checks', async () => {
    const app = originCheckApp({ SBER_DESIGNER_TRUST_PROXY: '1' });
    const response = await app.request('http://127.0.0.1:3000/api/mutate', {
      method: 'POST',
      headers: {
        'x-auth-method': 'session',
        origin: 'https://sd.example',
        'x-forwarded-host': 'sd.example',
        'x-forwarded-proto': 'https',
      },
    });
    expect(response.status).toBe(200);
  });
});

function accessGuardApp(): Hono {
  const requireUser: MiddlewareHandler = async (c, next) => {
    if (c.req.header('x-test-auth') !== 'yes') {
      return c.json({ error: 'unauthenticated' }, 401);
    }
    c.set('user', 'test-user');
    await next();
  };
  const app = new Hono();
  app.use('/api/*', createApiAccessGuard(requireUser, 'password'));
  for (const path of [
    '/api/config',
    '/api/preview/session-1',
    '/api/events',
    '/api/future-route',
  ]) {
    app.get(path, (c) => c.json({ user: c.get('user') ?? null }));
  }
  return app;
}

function corsApp(
  env: Record<string, string | undefined> = {},
  mode: 'local' | 'password' | 'oidc' = 'password',
): Hono {
  const app = new Hono();
  app.use('*', createApiCors(mode, env));
  app.get('/api/value', (c) => c.json({ ok: true }));
  return app;
}

function originCheckApp(env: Record<string, string | undefined> = {}): Hono {
  const app = new Hono();
  app.use('/api/*', async (c, next) => {
    c.set('authMethod', c.req.header('x-auth-method'));
    await next();
  });
  app.use('/api/*', createCookieOriginCheck(env));
  app.post('/api/mutate', (c) => c.json({ ok: true }));
  return app;
}

function mutation(app: Hono, method: 'service' | 'session', origin: string): Promise<Response> {
  return app.request('http://api.example/api/mutate', {
    method: 'POST',
    headers: { 'x-auth-method': method, origin },
  });
}
