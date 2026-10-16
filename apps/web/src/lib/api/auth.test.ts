import { afterEach, expect, test } from 'bun:test';

import { login, status } from './auth';
import { ApiError } from './http';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('auth status includes credentials for the password session bootstrap', async () => {
  let captured: { url: string; init?: RequestInit } | null = null;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    captured = { url: String(input), ...(init ? { init } : {}) };
    return Response.json({
      deploymentMode: 'server',
      authMode: 'password',
      registration: 'open',
      captcha: 'register',
      version: '1',
    });
  }) as typeof fetch;

  const result = await status();

  expect(result.deploymentMode).toBe('server');
  expect(result.authMode).toBe('password');
  expect(captured?.url).toEndWith('/api/auth/status');
  expect(captured?.init?.credentials).toBe('include');
});

test('login preserves stable API error metadata for CAPTCHA escalation', async () => {
  globalThis.fetch = (async () =>
    Response.json(
      {
        error: 'invalid_credentials',
        detail: 'Invalid email or password',
        captchaRequired: true,
      },
      { status: 401 },
    )) as typeof fetch;

  const error = await login({ email: 'person@example.com', password: 'wrong-password' }).catch(
    (reason: unknown) => reason,
  );

  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).code).toBe('invalid_credentials');
  expect((error as ApiError).captchaRequired).toBe(true);
});
