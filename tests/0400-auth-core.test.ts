import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';

import { CaptchaStore } from '../services/api/src/auth/captcha';
import { createRequireUser, readContextUser } from '../services/api/src/auth/middleware';
import { resolveAuthMode } from '../services/api/src/auth/mode';
import { hashPassword, validatePassword, verifyPassword } from '../services/api/src/auth/passwords';
import { AuthRateLimits } from '../services/api/src/auth/rate-limit';
import { createAuthRouter } from '../services/api/src/auth/router';
import { AuthService, type PasswordCodec } from '../services/api/src/auth/service';
import {
  SESSION_RENEWAL_WINDOW_MS,
  SESSION_TTL_MS,
  SessionManager,
} from '../services/api/src/auth/sessions';
import { AuthStore } from '../services/api/src/auth/store';
import type { AuthUserRecord } from '../services/api/src/auth/types';

const temporaryDirectories: string[] = [];
const fakeOidc = {
  async verify(): Promise<never> {
    throw new Error('OIDC is not used by these tests');
  },
};

const fastPasswordCodec: PasswordCodec = {
  async hash(password, enforcePolicy = true) {
    if (enforcePolicy) validatePassword(password);
    return `test:${password}`;
  },
  async verify(password, passwordHash) {
    return passwordHash === `test:${password}`;
  },
};

interface Harness {
  app: Hono;
  service: AuthService;
  store: AuthStore;
  setNow(value: number): void;
  now(): number;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('0400 password auth core', () => {
  test('registers, reads me, logs out, logs in and updates the profile', async () => {
    const harness = await createHarness();
    const registered = await authRequest(harness.app, '/register', {
      email: ' ADA@Example.COM ',
      password: 'correct horse',
      displayName: '  Ada   Lovelace ',
    });

    expect(registered.status).toBe(201);
    expect(await registered.clone().json()).toEqual({
      user: {
        id: expect.stringMatching(/^u_/),
        email: 'ada@example.com',
        displayName: 'Ada Lovelace',
        role: 'admin',
        mustChangePassword: false,
      },
    });
    expect(registered.headers.get('set-cookie')).toContain('sd_session=');
    expect(registered.headers.get('set-cookie')).toContain('HttpOnly');
    expect(registered.headers.get('set-cookie')).toContain('SameSite=Lax');
    expect(registered.headers.get('set-cookie')).not.toContain('Secure');
    const cookie = responseCookie(registered);

    const me = await harness.app.request('http://localhost/api/auth/me', {
      headers: { cookie },
    });
    expect(me.status).toBe(200);
    expect((await me.json()).user.email).toBe('ada@example.com');

    const renamed = await authRequest(
      harness.app,
      '/me',
      { displayName: 'Augusta Ada King' },
      { method: 'PATCH', cookie },
    );
    expect(renamed.status).toBe(200);
    expect((await renamed.json()).user.displayName).toBe('Augusta Ada King');

    const logout = await harness.app.request('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: { cookie },
    });
    expect(logout.status).toBe(204);
    expect(logout.headers.get('set-cookie')).toContain('sd_session=');
    expect(
      (await harness.app.request('http://localhost/api/auth/me', { headers: { cookie } })).status,
    ).toBe(401);

    const login = await authRequest(harness.app, '/login', {
      email: 'ada@example.com',
      password: 'correct horse',
    });
    expect(login.status).toBe(200);
    expect((await login.json()).user.displayName).toBe('Augusta Ada King');
  });

  test('rejects normalized email collisions, weak passwords and closed registration', async () => {
    const harness = await createHarness();
    expect(
      (
        await authRequest(harness.app, '/register', {
          email: 'first@example.com',
          password: 'short',
          displayName: 'First User',
        })
      ).status,
    ).toBe(400);

    const first = await authRequest(harness.app, '/register', {
      email: 'First@Example.com',
      password: 'password-one',
      displayName: 'First User',
    });
    expect(first.status).toBe(201);
    const duplicate = await authRequest(harness.app, '/register', {
      email: ' first@example.COM ',
      password: 'password-two',
      displayName: 'Second User',
    });
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error).toBe('email_taken');

    await harness.store.mutateSystemSettings((current) => ({
      value: { ...current, registration: 'closed' },
      result: undefined,
    }));
    const closed = await authRequest(harness.app, '/register', {
      email: 'second@example.com',
      password: 'password-two',
      displayName: 'Second User',
    });
    expect(closed.status).toBe(403);
    expect((await closed.json()).error).toBe('registration_closed');
  });

  test('rejects tampered and expired cookies', async () => {
    const harness = await createHarness();
    const registered = await registerMember(harness, 'expiry@example.com');
    const cookie = responseCookie(registered);

    const tampered = await harness.app.request('http://localhost/api/auth/me', {
      headers: { cookie: `${cookie}tampered` },
    });
    expect(tampered.status).toBe(401);

    harness.setNow(harness.now() + SESSION_TTL_MS + 1);
    const expired = await harness.app.request('http://localhost/api/auth/me', {
      headers: { cookie },
    });
    expect(expired.status).toBe(401);
    expect((await harness.store.readSessions()).sessions).toHaveLength(0);
  });

  test('rotates a session inside the sliding renewal window', async () => {
    const harness = await createHarness();
    const registered = await registerMember(harness, 'renew@example.com');
    const oldCookie = responseCookie(registered);
    harness.setNow(harness.now() + SESSION_TTL_MS - SESSION_RENEWAL_WINDOW_MS + 1);

    const renewed = await harness.app.request('http://localhost/api/auth/me', {
      headers: { cookie: oldCookie },
    });
    expect(renewed.status).toBe(200);
    expect(renewed.headers.get('set-cookie')).toContain('sd_session=');
    const newCookie = responseCookie(renewed);
    expect(newCookie).not.toBe(oldCookie);

    expect(
      (
        await harness.app.request('http://localhost/api/auth/me', {
          headers: { cookie: oldCookie },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await harness.app.request('http://localhost/api/auth/me', {
          headers: { cookie: newCookie },
        })
      ).status,
    ).toBe(200);
  });

  test('disabling an account revokes sessions and blocks login', async () => {
    const harness = await createHarness();
    const owner = await registerMember(harness, 'owner@example.com');
    const ownerUser = (await owner.json()).user;
    await expect(harness.service.setUserStatus(ownerUser.id, 'disabled')).rejects.toMatchObject({
      code: 'last_admin',
    });
    const registered = await registerMember(harness, 'disabled@example.com');
    const user = (await registered.clone().json()).user;
    const cookie = responseCookie(registered);

    await harness.service.setUserStatus(user.id, 'disabled');
    expect(
      (await harness.store.readSessions()).sessions.some((session) => session.userId === user.id),
    ).toBe(false);
    expect(
      (
        await harness.app.request('http://localhost/api/auth/me', {
          headers: { cookie },
        })
      ).status,
    ).toBe(401);

    const login = await authRequest(harness.app, '/login', {
      email: 'disabled@example.com',
      password: 'password-one',
    });
    expect(login.status).toBe(403);
    expect((await login.json()).error).toBe('account_disabled');
  });

  test('changing password preserves the current session and revokes all others', async () => {
    const harness = await createHarness();
    const registered = await registerMember(harness, 'password@example.com');
    const firstCookie = responseCookie(registered);
    const secondLogin = await authRequest(harness.app, '/login', {
      email: 'password@example.com',
      password: 'password-one',
    });
    const secondCookie = responseCookie(secondLogin);

    const changed = await authRequest(
      harness.app,
      '/me/password',
      { currentPassword: 'password-one', newPassword: 'password-two' },
      { cookie: firstCookie },
    );
    expect(changed.status).toBe(200);
    expect(
      (
        await harness.app.request('http://localhost/api/auth/me', {
          headers: { cookie: firstCookie },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await harness.app.request('http://localhost/api/auth/me', {
          headers: { cookie: secondCookie },
        })
      ).status,
    ).toBe(401);

    expect(
      (
        await authRequest(harness.app, '/login', {
          email: 'password@example.com',
          password: 'password-one',
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await authRequest(harness.app, '/login', {
          email: 'password@example.com',
          password: 'password-two',
        })
      ).status,
    ).toBe(200);
  });

  test('bootstraps the deploy admin and supports the guarded local dev seed', async () => {
    const bootstrap = await createHarness({
      SBER_DESIGNER_BOOTSTRAP_ADMIN_EMAIL: 'owner@example.com',
      SBER_DESIGNER_BOOTSTRAP_ADMIN_PASSWORD: 'temporary-password',
    });
    const users = await bootstrap.store.readUsers();
    expect(users.users).toHaveLength(1);
    expect(users.users[0]).toMatchObject({
      email: 'owner@example.com',
      role: 'admin',
      mustChangePassword: true,
    });

    const seeded = await createHarness({ SBER_DESIGNER_AUTH_DEV_SEED: '1' });
    expect((await seeded.store.readUsers()).users[0]).toMatchObject({
      email: 'admin@local',
      role: 'admin',
      mustChangePassword: false,
    });
    expect(
      (
        await authRequest(seeded.app, '/login', {
          email: 'admin@local',
          password: 'admin',
        })
      ).status,
    ).toBe(200);

    const directory = await temporaryDirectory();
    const unsafe = new AuthService('password', new AuthStore({ dataRoot: directory }), {
      env: { SBER_DESIGNER_AUTH_DEV_SEED: '1', SBER_DESIGNER_PUBLIC_URL: 'https://public' },
      passwordCodec: fastPasswordCodec,
      logger: () => undefined,
    });
    await expect(unsafe.initialize()).rejects.toThrow('forbidden');
  });

  test('promotes configured admin emails on login', async () => {
    const harness = await createHarness();
    await registerMember(harness, 'first@example.com');
    await registerMember(harness, 'promote@example.com');

    const promotedService = new AuthService('password', harness.store, {
      env: { SBER_DESIGNER_ADMIN_EMAILS: 'PROMOTE@example.com' },
      passwordCodec: fastPasswordCodec,
      logger: () => undefined,
      now: harness.now,
    });
    const login = await promotedService.login(
      { email: 'promote@example.com', password: 'password-one' },
      { userAgent: 'test', ip: 'unknown' },
    );
    expect(login.user.role).toBe('admin');
  });

  test('runs one password verification for unknown emails to reduce login timing disclosure', async () => {
    const directory = await temporaryDirectory();
    const verifiedHashes: string[] = [];
    const service = new AuthService('password', new AuthStore({ dataRoot: directory }), {
      passwordCodec: {
        ...fastPasswordCodec,
        async verify(_password, passwordHash) {
          verifiedHashes.push(passwordHash);
          return false;
        },
      },
      logger: () => undefined,
    });

    await expect(
      service.login(
        { email: 'missing@example.com', password: 'password-one' },
        { userAgent: 'test', ip: 'unknown' },
      ),
    ).rejects.toMatchObject({ code: 'invalid_credentials', status: 401 });
    expect(verifiedHashes).toHaveLength(1);
    expect(verifiedHashes[0]).toStartWith('$argon2id$');
  });

  test('advertises auth status and sets Secure only for trusted HTTPS proxy requests', async () => {
    const harness = await createHarness({ SBER_DESIGNER_TRUST_PROXY: '1' });
    const status = await harness.app.request('http://localhost/api/auth/status');
    expect(await status.json()).toEqual({
      deploymentMode: 'server',
      authMode: 'password',
      registration: 'open',
      captcha: 'off',
      version: 'test-version',
    });

    const registered = await authRequest(
      harness.app,
      '/register',
      {
        email: 'secure@example.com',
        password: 'password-one',
        displayName: 'Secure User',
      },
      { headers: { 'x-forwarded-proto': 'https' } },
    );
    expect(registered.headers.get('set-cookie')).toContain('Secure');
  });

  test('preserves local stub middleware behavior and validates auth mode conflicts', async () => {
    expect(resolveAuthMode({})).toBe('local');
    expect(resolveAuthMode({ SBER_DESIGNER_OIDC_ISSUER: 'https://issuer' })).toBe('oidc');
    expect(() =>
      resolveAuthMode({
        SBER_DESIGNER_AUTH_MODE: 'password',
        SBER_DESIGNER_OIDC_ISSUER: 'https://issuer',
      }),
    ).toThrow('conflicts');

    const directory = await temporaryDirectory();
    const service = new AuthService('local', new AuthStore({ dataRoot: directory }), {
      passwordCodec: fastPasswordCodec,
    });
    const middleware = createRequireUser({ mode: 'local', service, oidc: fakeOidc });
    const app = new Hono();
    app.use('/private', middleware);
    app.get('/private', (c) => c.json({ user: readContextUser(c, 'local') }));
    expect((await app.request('http://localhost/private')).status).toBe(401);
    const allowed = await app.request('http://localhost/private', {
      headers: { 'x-sber-designer-user': 'local-dev' },
    });
    expect(await allowed.json()).toEqual({ user: 'local-dev' });
  });

  test('serializes parallel store writes and keeps auth files at 0600', async () => {
    const directory = await temporaryDirectory();
    const store = new AuthStore({ dataRoot: directory });
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        store.mutateUsers((current) => ({
          value: {
            version: 1,
            users: [...current.users, testUser(index)],
          },
          result: undefined,
        })),
      ),
    );

    expect((await store.readUsers()).users).toHaveLength(20);
    expect((await stat(store.paths.users)).mode & 0o777).toBe(0o600);
    expect((await readdir(join(directory, 'auth'))).some((name) => name.endsWith('.tmp'))).toBe(
      false,
    );
  });

  test('uses Bun argon2id hashes and enforces the 8–256 password policy', async () => {
    const hash = await hashPassword('password-one');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword('password-one', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
    expect(() => validatePassword('short')).toThrow('8–256');
    expect(() => validatePassword('x'.repeat(257))).toThrow('8–256');
  });
});

async function createHarness(env: Record<string, string | undefined> = {}): Promise<Harness> {
  const directory = await temporaryDirectory();
  let currentTime = Date.parse('2026-07-09T12:00:00.000Z');
  const now = () => currentTime;
  const store = new AuthStore({ dataRoot: directory });
  const sessions = new SessionManager(store, { now });
  const service = new AuthService('password', store, {
    env,
    now,
    sessions,
    passwordCodec: fastPasswordCodec,
    logger: () => undefined,
  });
  const requireUser = createRequireUser({ mode: 'password', service, oidc: fakeOidc, env });
  const captchas = new CaptchaStore({ now });
  const rateLimits = new AuthRateLimits({ now });
  const app = new Hono().route(
    '/api/auth',
    createAuthRouter({
      service,
      requireUser,
      deploymentMode: 'server',
      version: 'test-version',
      captchaMode: 'off',
      captchas,
      rateLimits,
      env,
    }),
  );
  await service.initialize();
  return {
    app,
    service,
    store,
    now,
    setNow(value) {
      currentTime = value;
    },
  };
}

async function registerMember(harness: Harness, email: string): Promise<Response> {
  return authRequest(harness.app, '/register', {
    email,
    password: 'password-one',
    displayName: 'Example User',
  });
}

function authRequest(
  app: Hono,
  path: string,
  body: unknown,
  options: {
    method?: 'POST' | 'PATCH';
    cookie?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<Response> {
  return app.request(`http://localhost/api/auth${path}`, {
    method: options.method ?? 'POST',
    headers: {
      'content-type': 'application/json',
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...options.headers,
    },
    body: JSON.stringify(body),
  });
}

function responseCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) throw new Error('Expected Set-Cookie response header');
  return setCookie.split(';')[0] ?? '';
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'sd-auth-core-'));
  temporaryDirectories.push(directory);
  return directory;
}

function testUser(index: number): AuthUserRecord {
  const timestamp = '2026-07-09T12:00:00.000Z';
  return {
    id: `u_${index}`,
    email: `user-${index}@example.com`,
    displayName: `User ${index}`,
    passwordHash: 'test:password-one',
    role: index === 0 ? 'admin' : 'member',
    status: 'active',
    mustChangePassword: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastLoginAt: null,
  };
}
