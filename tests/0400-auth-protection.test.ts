import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';

import {
  CAPTCHA_TTL_MS,
  CaptchaStore,
  resolveCaptchaMode,
  type CaptchaMode,
} from '../services/api/src/auth/captcha';
import { createRequireUser } from '../services/api/src/auth/middleware';
import {
  AuthRateLimits,
  CAPTCHA_IP_LIMIT,
  FixedWindowRateLimiter,
  LOGIN_FAILURE_CAPTCHA_THRESHOLD,
  LOGIN_FAILURE_LOCK_THRESHOLD,
  LOGIN_IP_LIMIT,
  LOGIN_IP_WINDOW_MS,
  LOGIN_LOCK_MS,
  REGISTER_IP_LIMIT,
} from '../services/api/src/auth/rate-limit';
import { createAuthRouter } from '../services/api/src/auth/router';
import { AuthService, type PasswordCodec } from '../services/api/src/auth/service';
import { SessionManager } from '../services/api/src/auth/sessions';
import { AuthStore } from '../services/api/src/auth/store';

const CAPTCHA_ANSWER = 'AbC23';
const SAFE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><path d="M1 1h20v20z"/></svg>';
const temporaryDirectories: string[] = [];

const fakeOidc = {
  async verify(): Promise<never> {
    throw new Error('OIDC is not used by these tests');
  },
};

const fastPasswordCodec: PasswordCodec = {
  async hash(password) {
    return `test:${password}`;
  },
  async verify(password, passwordHash) {
    return passwordHash === `test:${password}`;
  },
};

interface Harness {
  app: Hono;
  service: AuthService;
  setNow(value: number): void;
  advance(milliseconds: number): void;
  now(): number;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('0400 offline captcha', () => {
  test('generates five path glyphs without network access or network-capable SVG elements', () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error('captcha attempted a network request');
    }) as typeof fetch;
    try {
      const challenge = new CaptchaStore().issue();
      expect(challenge.challengeId).toMatch(/^[A-Za-z0-9_-]{20,}$/);
      expect(challenge.svg).toContain('<path');
      expect(challenge.svg).not.toMatch(/<text\b/i);
      expect(challenge.svg).not.toMatch(/<(?:image|use|script|foreignObject)\b/i);
      expect(challenge.svg).not.toMatch(/\b(?:href|xlink:href)\s*=/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('expires, consumes and evicts challenges at the configured LRU ceiling', () => {
    let now = Date.parse('2026-07-09T12:00:00.000Z');
    const store = testCaptchaStore(() => now, { capacity: 2 });
    const oldest = store.issue();
    const second = store.issue();
    const newest = store.issue();

    expect(store.size).toBe(2);
    expect(store.verify(oldest.challengeId, CAPTCHA_ANSWER)).toBe(false);
    expect(store.verify(second.challengeId, CAPTCHA_ANSWER.toLocaleLowerCase())).toBe(true);
    expect(store.verify(second.challengeId, CAPTCHA_ANSWER)).toBe(false);

    now += CAPTCHA_TTL_MS + 1;
    expect(store.verify(newest.challengeId, CAPTCHA_ANSWER)).toBe(false);
    expect(store.size).toBe(0);
  });

  test('defaults to register protection in password mode and validates overrides', () => {
    expect(resolveCaptchaMode('password', {})).toBe('register');
    expect(resolveCaptchaMode('local', {})).toBe('off');
    expect(resolveCaptchaMode('password', { SBER_DESIGNER_CAPTCHA: 'always' })).toBe('always');
    expect(resolveCaptchaMode('password', { SBER_DESIGNER_CAPTCHA: 'off' })).toBe('off');
    expect(() => resolveCaptchaMode('password', { SBER_DESIGNER_CAPTCHA: 'sometimes' })).toThrow(
      'off, register, or always',
    );
  });

  test('requires a fresh one-time captcha for registration', async () => {
    const harness = await createHarness({ captchaMode: 'register' });
    const status = await harness.app.request('http://localhost/api/auth/status');
    expect((await status.json()).captcha).toBe('register');

    const missing = await registerRequest(harness, 'missing@example.com');
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({
      error: 'captcha_required',
      captchaRequired: true,
    });

    const wrongChallenge = await issueCaptcha(harness);
    const wrong = await registerRequest(harness, 'wrong@example.com', {
      captchaId: wrongChallenge.challengeId,
      captchaText: 'wrong',
    });
    expect(wrong.status).toBe(400);
    expect((await wrong.json()).error).toBe('captcha_invalid');

    const reused = await registerRequest(harness, 'reuse@example.com', {
      captchaId: wrongChallenge.challengeId,
      captchaText: CAPTCHA_ANSWER,
    });
    expect(reused.status).toBe(400);
    expect((await reused.json()).error).toBe('captcha_invalid');

    const fresh = await issueCaptcha(harness);
    const registered = await registerRequest(harness, 'member@example.com', {
      captchaId: fresh.challengeId,
      captchaText: CAPTCHA_ANSWER.toLocaleLowerCase(),
    });
    expect(registered.status).toBe(201);
  });
});

describe('0400 auth anti-abuse', () => {
  test('resets fixed rate-limit windows', () => {
    let now = 1_000;
    const limiter = new FixedWindowRateLimiter(2, 1_000, { now: () => now });
    expect(limiter.consume('ip').allowed).toBe(true);
    expect(limiter.consume('ip').allowed).toBe(true);
    expect(limiter.consume('ip')).toMatchObject({ allowed: false, retryAfter: 1 });
    now += 1_000;
    expect(limiter.consume('ip')).toMatchObject({ allowed: true, remaining: 1 });
  });

  test('progresses failed login from captcha to a 15-minute lock and then expires it', async () => {
    const harness = await createHarness({ captchaMode: 'register' });
    await createMember(harness, 'member@example.com');

    for (let attempt = 1; attempt <= LOGIN_FAILURE_LOCK_THRESHOLD; attempt += 1) {
      if (attempt === LOGIN_IP_LIMIT + 1) harness.advance(LOGIN_IP_WINDOW_MS);
      const captcha =
        attempt > LOGIN_FAILURE_CAPTCHA_THRESHOLD ? await issueCaptcha(harness) : null;
      const response = await loginRequest(harness, {
        email: 'member@example.com',
        password: 'wrong-password',
        ...(captcha ? { captchaId: captcha.challengeId, captchaText: CAPTCHA_ANSWER } : {}),
      });

      if (attempt < LOGIN_FAILURE_LOCK_THRESHOLD) {
        expect(response.status).toBe(401);
      }
      if (attempt === LOGIN_FAILURE_CAPTCHA_THRESHOLD) {
        expect(await response.json()).toMatchObject({
          error: 'invalid_credentials',
          captchaRequired: true,
        });
      }
      if (attempt === LOGIN_FAILURE_LOCK_THRESHOLD) {
        expect(response.status).toBe(423);
        expect(response.headers.get('retry-after')).toBe('900');
        expect(await response.json()).toMatchObject({
          error: 'account_locked',
          retryAfter: 900,
        });
      }
    }

    const locked = await loginRequest(harness, {
      email: 'member@example.com',
      password: 'password-one',
    });
    expect(locked.status).toBe(423);

    harness.advance(LOGIN_LOCK_MS + 1);
    const recovered = await loginRequest(harness, {
      email: 'member@example.com',
      password: 'password-one',
    });
    expect(recovered.status).toBe(200);
  });

  test('requires captcha immediately in always mode and leaves internal off mode usable', async () => {
    const always = await createHarness({ captchaMode: 'always' });
    await createMember(always, 'always@example.com');
    const missing = await loginRequest(always, {
      email: 'always@example.com',
      password: 'password-one',
    });
    expect(missing.status).toBe(401);
    expect(await missing.json()).toMatchObject({
      error: 'captcha_required',
      captchaRequired: true,
    });
    const challenge = await issueCaptcha(always);
    expect(
      (
        await loginRequest(always, {
          email: 'always@example.com',
          password: 'password-one',
          captchaId: challenge.challengeId,
          captchaText: CAPTCHA_ANSWER,
        })
      ).status,
    ).toBe(200);

    const off = await createHarness({ captchaMode: 'off' });
    await createMember(off, 'off@example.com');
    for (let attempt = 1; attempt <= LOGIN_FAILURE_CAPTCHA_THRESHOLD; attempt += 1) {
      const response = await loginRequest(off, {
        email: 'off@example.com',
        password: 'wrong-password',
      });
      const body = await response.json();
      expect(body.captchaRequired).toBeUndefined();
    }
    expect(
      (
        await loginRequest(off, {
          email: 'off@example.com',
          password: 'password-one',
        })
      ).status,
    ).toBe(200);
  });

  test('enforces captcha issue and registration limits with Retry-After', async () => {
    const captchaHarness = await createHarness({ captchaMode: 'off' });
    for (let request = 0; request < CAPTCHA_IP_LIMIT; request += 1) {
      expect((await captchaHarness.app.request(captchaUrl())).status).toBe(200);
    }
    const captchaLimited = await captchaHarness.app.request(captchaUrl());
    expect(captchaLimited.status).toBe(429);
    expect(captchaLimited.headers.get('retry-after')).toBe('3600');

    const registerHarness = await createHarness({ captchaMode: 'off' });
    for (let request = 0; request < REGISTER_IP_LIMIT; request += 1) {
      expect((await registerRequest(registerHarness, `member-${request}@example.com`)).status).toBe(
        201,
      );
    }
    const registerLimited = await registerRequest(registerHarness, 'one-too-many@example.com');
    expect(registerLimited.status).toBe(429);
    expect(await registerLimited.json()).toMatchObject({
      error: 'rate_limited',
      retryAfter: 3600,
    });
  });

  test('uses X-Forwarded-For only behind an explicitly trusted proxy', async () => {
    const untrusted = await createHarness({ captchaMode: 'off', trustProxy: false });
    await createMember(untrusted, 'untrusted@example.com');
    for (let request = 0; request < LOGIN_IP_LIMIT; request += 1) {
      expect(
        (
          await loginRequest(
            untrusted,
            { email: 'untrusted@example.com', password: 'password-one' },
            `198.51.100.${request + 1}`,
          )
        ).status,
      ).toBe(200);
    }
    expect(
      (
        await loginRequest(
          untrusted,
          { email: 'untrusted@example.com', password: 'password-one' },
          '203.0.113.50',
        )
      ).status,
    ).toBe(429);

    const trusted = await createHarness({ captchaMode: 'off', trustProxy: true });
    await createMember(trusted, 'trusted@example.com');
    for (let request = 0; request <= LOGIN_IP_LIMIT; request += 1) {
      expect(
        (
          await loginRequest(
            trusted,
            { email: 'trusted@example.com', password: 'password-one' },
            `203.0.113.${request + 1}`,
          )
        ).status,
      ).toBe(200);
    }
  });
});

async function createHarness(options: {
  captchaMode: CaptchaMode;
  trustProxy?: boolean;
}): Promise<Harness> {
  const directory = await mkdtemp(join(tmpdir(), 'sd-auth-protection-'));
  temporaryDirectories.push(directory);
  let currentTime = Date.parse('2026-07-09T12:00:00.000Z');
  const now = () => currentTime;
  const env = {
    SBER_DESIGNER_TRUST_PROXY: options.trustProxy === false ? '0' : '1',
  };
  const store = new AuthStore({ dataRoot: directory });
  const service = new AuthService('password', store, {
    env,
    now,
    sessions: new SessionManager(store, { now }),
    passwordCodec: fastPasswordCodec,
    logger: () => undefined,
  });
  const requireUser = createRequireUser({ mode: 'password', service, oidc: fakeOidc, env });
  const app = new Hono().route(
    '/api/auth',
    createAuthRouter({
      service,
      requireUser,
      deploymentMode: 'server',
      version: 'test-version',
      captchaMode: options.captchaMode,
      captchas: testCaptchaStore(now),
      rateLimits: new AuthRateLimits({ now }),
      env,
    }),
  );
  await service.initialize();
  return {
    app,
    service,
    now,
    setNow(value) {
      currentTime = value;
    },
    advance(milliseconds) {
      currentTime += milliseconds;
    },
  };
}

function testCaptchaStore(now: () => number, options: { capacity?: number } = {}): CaptchaStore {
  return new CaptchaStore({
    now,
    generator: () => ({ text: CAPTCHA_ANSWER, data: SAFE_SVG }),
    ...(options.capacity ? { capacity: options.capacity } : {}),
  });
}

async function createMember(harness: Harness, email: string): Promise<void> {
  await harness.service.register(
    { email, password: 'password-one', displayName: 'Example Member' },
    { ip: 'test', userAgent: 'test' },
  );
}

async function issueCaptcha(harness: Harness): Promise<{ challengeId: string }> {
  const response = await harness.app.request(captchaUrl(), {
    headers: { 'x-forwarded-for': '198.51.100.10' },
  });
  expect(response.status).toBe(200);
  return response.json();
}

function registerRequest(
  harness: Harness,
  email: string,
  captcha: { captchaId: string; captchaText: string } | null = null,
): Promise<Response> {
  return jsonRequest(harness, '/register', {
    email,
    password: 'password-one',
    displayName: 'Example Member',
    ...captcha,
  });
}

function loginRequest(
  harness: Harness,
  body: {
    email: string;
    password: string;
    captchaId?: string;
    captchaText?: string;
  },
  ip = '198.51.100.10',
): Promise<Response> {
  return jsonRequest(harness, '/login', body, ip);
}

function jsonRequest(harness: Harness, path: string, body: unknown, ip = '198.51.100.10') {
  return harness.app.request(`http://localhost/api/auth${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

function captchaUrl(): string {
  return 'http://localhost/api/auth/captcha';
}
