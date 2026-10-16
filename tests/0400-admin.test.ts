import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { BUILTIN_DEFAULTS } from '@sber-designer/llm-gateway';

import { runAuthAdminCommand } from '../scripts/auth-admin';
import {
  createAdminRouter,
  type AdminTrashOperations,
} from '../services/api/src/auth/admin-router';
import { CaptchaStore } from '../services/api/src/auth/captcha';
import { createRequireAdmin, createRequireUser } from '../services/api/src/auth/middleware';
import { validatePassword } from '../services/api/src/auth/passwords';
import { AuthRateLimits } from '../services/api/src/auth/rate-limit';
import { createAuthRouter } from '../services/api/src/auth/router';
import { AuthService, type PasswordCodec } from '../services/api/src/auth/service';
import { SessionManager } from '../services/api/src/auth/sessions';
import { AuthStore } from '../services/api/src/auth/store';
import {
  cliRuntimeIsEnabled,
  enabledCliRuntimeKinds,
} from '../services/api/src/auth/system-settings';
import type { AuditEvent } from '../services/api/src/audit';
import { createConfigRouter } from '../services/api/src/routes/config';
import {
  filterEnabledRuntimeItems,
  runtimeDisabledError,
} from '../services/api/src/routes/agent-runtimes';

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

interface AdminHarness {
  app: Hono;
  service: AuthService;
  store: AuthStore;
  auditEvents: Array<Omit<AuditEvent, 'ts'>>;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('0400 admin permissions and user lifecycle', () => {
  test('blocks anonymous and member access to every admin surface', async () => {
    const harness = await createAdminHarness();
    const admin = await register(harness.app, 'admin@example.com', 'Admin User');
    const member = await register(harness.app, 'member@example.com', 'Member User');
    const adminId = (await admin.clone().json()).user.id as string;
    const memberCookie = responseCookie(member);

    const requests: Array<[string, RequestInit]> = [
      ['/api/admin/users', {}],
      ['/api/admin/settings', {}],
      ['/api/admin/trash', {}],
      [`/api/admin/users/${adminId}/storage`, {}],
      [
        '/api/admin/trash/trash-entry/restore',
        jsonRequest('POST', { folder: 'project', targetUserId: adminId }),
      ],
      ['/api/admin/trash/trash-entry', { method: 'DELETE' }],
      [`/api/admin/users/${adminId}`, jsonRequest('PATCH', { status: 'disabled' })],
      [`/api/admin/users/${adminId}/reset-password`, { method: 'POST' }],
      [`/api/admin/users/${adminId}`, { method: 'DELETE' }],
      [
        '/api/admin/settings',
        jsonRequest('PATCH', {
          registration: 'closed',
          dsBrowser: { defaultEnabled: true },
          agents: { enabledCliRuntimes: ['codex'] },
        }),
      ],
    ];

    for (const [path, init] of requests) {
      expect((await harness.app.request(`http://localhost${path}`, init)).status).toBe(401);
      const memberInit = {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init.headers).entries()),
          cookie: memberCookie,
        },
      };
      const response = await harness.app.request(`http://localhost${path}`, memberInit);
      expect(response.status).toBe(403);
      expect((await response.json()).error).toBe('forbidden');
    }
  });

  test('guards the last admin, revokes sessions, resets passwords, and deletes disabled users', async () => {
    const harness = await createAdminHarness();
    const adminRegistration = await register(harness.app, 'admin@example.com', 'Admin User');
    const memberRegistration = await register(harness.app, 'member@example.com', 'Member User');
    const admin = (await adminRegistration.clone().json()).user;
    const member = (await memberRegistration.clone().json()).user;
    const adminCookie = responseCookie(adminRegistration);

    const listed = await adminRequest(harness.app, '/users', undefined, {
      cookie: adminCookie,
    });
    expect(listed.status).toBe(200);
    const listedBody = await listed.json();
    expect(listedBody.users).toHaveLength(2);
    expect(listedBody.users[0].passwordHash).toBeUndefined();

    const lastAdmin = await adminRequest(
      harness.app,
      `/users/${admin.id}`,
      { role: 'member' },
      { method: 'PATCH', cookie: adminCookie },
    );
    expect(lastAdmin.status).toBe(409);
    expect((await lastAdmin.json()).error).toBe('last_admin');

    const promoted = await adminRequest(
      harness.app,
      `/users/${member.id}`,
      { role: 'admin' },
      { method: 'PATCH', cookie: adminCookie },
    );
    expect((await promoted.json()).user.role).toBe('admin');
    const newAdminLogin = await login(harness.app, 'member@example.com', 'password-one');
    const newAdminCookie = responseCookie(newAdminLogin);

    const reset = await adminRequest(harness.app, `/users/${admin.id}/reset-password`, undefined, {
      method: 'POST',
      cookie: newAdminCookie,
    });
    expect(reset.status).toBe(200);
    const resetBody = await reset.json();
    expect(resetBody.temporaryPassword).toMatch(/^Temp-/);
    expect(resetBody.user.mustChangePassword).toBe(true);
    expect(
      (
        await harness.app.request('http://localhost/api/auth/me', {
          headers: { cookie: adminCookie },
        })
      ).status,
    ).toBe(401);

    const temporaryLogin = await login(
      harness.app,
      'admin@example.com',
      resetBody.temporaryPassword,
    );
    expect((await temporaryLogin.clone().json()).user.mustChangePassword).toBe(true);
    const temporaryCookie = responseCookie(temporaryLogin);
    const changed = await authRequest(
      harness.app,
      '/me/password',
      { currentPassword: resetBody.temporaryPassword, newPassword: 'permanent-password' },
      { cookie: temporaryCookie },
    );
    expect(changed.status).toBe(200);
    expect((await changed.json()).user.mustChangePassword).toBe(false);
    expect(
      (await login(harness.app, 'admin@example.com', resetBody.temporaryPassword)).status,
    ).toBe(401);
    expect((await login(harness.app, 'admin@example.com', 'permanent-password')).status).toBe(200);

    const activeDelete = await adminRequest(
      harness.app,
      `/users/${admin.id}`,
      { confirm: admin.email },
      {
        method: 'DELETE',
        cookie: newAdminCookie,
      },
    );
    expect(activeDelete.status).toBe(409);
    expect((await activeDelete.json()).error).toBe('user_must_be_disabled');

    const disabled = await adminRequest(
      harness.app,
      `/users/${admin.id}`,
      { status: 'disabled' },
      { method: 'PATCH', cookie: newAdminCookie },
    );
    expect((await disabled.json()).user.status).toBe('disabled');
    const deleted = await adminRequest(
      harness.app,
      `/users/${admin.id}`,
      { confirm: admin.email },
      {
        method: 'DELETE',
        cookie: newAdminCookie,
      },
    );
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toMatchObject({
      workspaceDisposition: 'trash',
      trashEntry: { user: { email: 'admin@example.com' } },
    });
    expect((await harness.service.listUsers()).map((user) => user.email)).toEqual([
      'member@example.com',
    ]);
    const trash = await adminRequest(harness.app, '/trash', undefined, {
      cookie: newAdminCookie,
    });
    expect(await trash.json()).toMatchObject({
      entries: [{ entryId: `trash-${admin.id}` }],
    });
    const restored = await adminRequest(
      harness.app,
      `/trash/trash-${admin.id}/restore`,
      { folder: 'project', targetUserId: member.id },
      { method: 'POST', cookie: newAdminCookie },
    );
    expect(restored.status).toBe(200);
    expect(await restored.json()).toMatchObject({
      project: { name: 'Restored project' },
    });
    const purged = await adminRequest(harness.app, `/trash/trash-${admin.id}`, undefined, {
      method: 'DELETE',
      cookie: newAdminCookie,
    });
    expect(purged.status).toBe(200);
    expect(await purged.json()).toEqual({ purgedEntry: true, manifest: null });
    expect(harness.auditEvents.map((event) => event.action)).toEqual([
      'user.access.update',
      'user.password.reset',
      'user.access.update',
      'user.delete',
      'trash.project.restore',
      'trash.entry.purge',
    ]);
  });

  test('rolls the trash move back when auth-store deletion fails', async () => {
    const harness = await createAdminHarness();
    const adminRegistration = await register(harness.app, 'admin@example.com', 'Admin User');
    const memberRegistration = await register(harness.app, 'member@example.com', 'Member User');
    const admin = (await adminRegistration.clone().json()).user;
    const member = (await memberRegistration.clone().json()).user;
    const adminCookie = responseCookie(adminRegistration);

    await adminRequest(
      harness.app,
      `/users/${member.id}`,
      { role: 'admin' },
      { method: 'PATCH', cookie: adminCookie },
    );
    const memberLogin = await login(harness.app, member.email, 'password-one');
    const memberCookie = responseCookie(memberLogin);
    await adminRequest(
      harness.app,
      `/users/${admin.id}`,
      { status: 'disabled' },
      { method: 'PATCH', cookie: memberCookie },
    );

    const originalDelete = harness.service.deleteUser.bind(harness.service);
    harness.service.deleteUser = async () => {
      throw new Error('simulated auth-store failure');
    };
    const response = await adminRequest(
      harness.app,
      `/users/${admin.id}`,
      { confirm: admin.email },
      { method: 'DELETE', cookie: memberCookie },
    );
    harness.service.deleteUser = originalDelete;

    expect(response.status).toBe(500);
    expect((await harness.service.listUsers()).some((user) => user.id === admin.id)).toBe(true);
    const trash = await adminRequest(harness.app, '/trash', undefined, { cookie: memberCookie });
    expect(await trash.json()).toEqual({ entries: [] });
  });
});

describe('0400 system settings effects', () => {
  test('plain local config ignores server system settings', async () => {
    let systemReads = 0;
    const app = new Hono().route(
      '/api/config',
      createConfigRouter({
        loadConfig: async () => BUILTIN_DEFAULTS,
        readSystemSettings: async () => {
          systemReads += 1;
          throw new Error('local mode must not read this store');
        },
        authMode: () => 'local',
      }),
    );
    const response = await app.request('http://localhost/api/config');
    expect(response.status).toBe(200);
    expect((await response.json()).system).toEqual({ dsBrowser: { defaultEnabled: false } });
    expect(systemReads).toBe(0);
  });

  test('persists settings, closes registration, exposes DS Browser default, and filters CLI kinds', async () => {
    const harness = await createAdminHarness();
    const admin = await register(harness.app, 'admin@example.com', 'Admin User');
    const adminCookie = responseCookie(admin);
    const settingsInput = {
      registration: 'closed' as const,
      dsBrowser: { defaultEnabled: true },
      agents: { enabledCliRuntimes: ['codex'] as const },
    };

    const updated = await adminRequest(harness.app, '/settings', settingsInput, {
      method: 'PATCH',
      cookie: adminCookie,
    });
    expect(updated.status).toBe(200);
    expect((await updated.json()).settings).toEqual({ version: 1, ...settingsInput });

    const blockedRegistration = await register(harness.app, 'blocked@example.com', 'Blocked User');
    expect(blockedRegistration.status).toBe(403);
    expect((await blockedRegistration.json()).error).toBe('registration_closed');

    const stored = await harness.store.readSystemSettings();
    expect(enabledCliRuntimeKinds(stored)).toEqual(['codex']);
    expect(cliRuntimeIsEnabled(stored, 'codex')).toBe(true);
    expect(cliRuntimeIsEnabled(stored, 'claude-code')).toBe(false);
    expect(
      filterEnabledRuntimeItems(
        [
          { kind: 'claude-code' as const },
          { kind: 'codex' as const },
          { kind: 'opencode' as const },
        ],
        enabledCliRuntimeKinds(stored),
      ),
    ).toEqual([{ kind: 'codex' }]);
    expect(runtimeDisabledError('codex', true)).toBeNull();
    expect(runtimeDisabledError('opencode', false)).toMatchObject({
      error: 'runtime_disabled',
    });

    const configApp = new Hono().route(
      '/api/config',
      createConfigRouter({
        loadConfig: async () => BUILTIN_DEFAULTS,
        readSystemSettings: () => harness.store.readSystemSettings(),
        authMode: () => 'password',
      }),
    );
    const config = await configApp.request('http://localhost/api/config');
    expect(config.status).toBe(200);
    expect((await config.json()).system).toEqual({ dsBrowser: { defaultEnabled: true } });
    expect(harness.auditEvents.at(-1)).toMatchObject({
      kind: 'admin',
      action: 'system.settings.update',
      target: 'system',
    });
  });
});

describe('0400 auth-admin break-glass CLI', () => {
  test('lists, promotes, resets, and disables accounts without the HTTP server', async () => {
    const harness = await createAdminHarness();
    await register(harness.app, 'admin@example.com', 'Admin User');
    const member = await register(harness.app, 'member@example.com', 'Member User');
    const memberCookie = responseCookie(member);
    const lines: string[] = [];
    const dependencies = {
      store: harness.store,
      service: harness.service,
      writeLine: (line: string) => lines.push(line),
    };

    await runAuthAdminCommand(['list'], dependencies);
    expect(lines.join('\n')).toContain('member@example.com\tmember\tactive');
    await runAuthAdminCommand(['promote', ' MEMBER@example.com '], dependencies);
    expect(
      (await harness.service.listUsers()).find((user) => user.email === 'member@example.com')?.role,
    ).toBe('admin');
    await runAuthAdminCommand(['reset-password', 'member@example.com'], dependencies);
    expect(lines.at(-2)).toMatch(/Temporary password for member@example.com: Temp-/);
    await runAuthAdminCommand(['disable', 'member@example.com'], dependencies);
    expect(
      (
        await harness.app.request('http://localhost/api/auth/me', {
          headers: { cookie: memberCookie },
        })
      ).status,
    ).toBe(401);
  });
});

async function createAdminHarness(): Promise<AdminHarness> {
  const directory = await mkdtemp(join(tmpdir(), 'sd-admin-'));
  temporaryDirectories.push(directory);
  const now = () => Date.parse('2026-07-10T12:00:00.000Z');
  const store = new AuthStore({ dataRoot: directory });
  const service = new AuthService('password', store, {
    now,
    sessions: new SessionManager(store, { now }),
    passwordCodec: fastPasswordCodec,
    logger: () => undefined,
    env: {},
  });
  const requireUser = createRequireUser({ mode: 'password', service, oidc: fakeOidc, env: {} });
  const requireAdmin = createRequireAdmin();
  const auditEvents: Array<Omit<AuditEvent, 'ts'>> = [];
  const trashEntries: Awaited<ReturnType<AdminTrashOperations['list']>> = [];
  const trash: AdminTrashOperations = {
    previewUser: async () => ({ projects: [], totalBytes: 0, riskyProjects: 0 }),
    moveUser: async (user, deletedBy) => {
      const entry = {
        version: 1 as const,
        entryId: `trash-${user.id}`,
        user: { id: user.id, email: user.email, displayName: user.displayName },
        deletedAt: new Date(now()).toISOString(),
        deletedBy,
        projects: [],
        totalBytes: 0,
        riskyProjects: 0,
        userDataMoved: false,
      };
      trashEntries.push(entry);
      return entry;
    },
    rollbackUser: async (_user, manifest) => {
      const index = trashEntries.findIndex((entry) => entry.entryId === manifest.entryId);
      if (index >= 0) trashEntries.splice(index, 1);
    },
    list: async () => trashEntries,
    restore: async ({ entryId, targetUser }) => {
      const manifest = trashEntries.find((entry) => entry.entryId === entryId);
      if (!manifest) throw new Error('Trash entry not found.');
      return {
        manifest,
        project: {
          id: 'restored-project',
          name: 'Restored project',
          workspacePath: `/projects/${targetUser.id}/restored-project`,
          createdAt: now(),
          lastOpenedAt: now(),
        },
      };
    },
    purge: async ({ entryId }) => {
      const index = trashEntries.findIndex((entry) => entry.entryId === entryId);
      if (index >= 0) trashEntries.splice(index, 1);
      return { purgedEntry: true, manifest: null };
    },
  };
  const app = new Hono()
    .route(
      '/api/auth',
      createAuthRouter({
        service,
        requireUser,
        deploymentMode: 'server',
        version: 'test',
        captchaMode: 'off',
        captchas: new CaptchaStore({ now }),
        rateLimits: new AuthRateLimits({ now }),
        env: {},
      }),
    )
    .route(
      '/api/admin',
      createAdminRouter({
        service,
        store,
        requireUser,
        requireAdmin,
        trash,
        writeAudit: (event) => auditEvents.push(event),
      }),
    );
  return { app, service, store, auditEvents };
}

function register(app: Hono, email: string, displayName: string): Promise<Response> {
  return authRequest(app, '/register', { email, displayName, password: 'password-one' });
}

function login(app: Hono, email: string, password: string): Promise<Response> {
  return authRequest(app, '/login', { email, password });
}

function authRequest(
  app: Hono,
  path: string,
  body: unknown,
  options: { cookie?: string } = {},
): Promise<Response> {
  return app.request(`http://localhost/api/auth${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function adminRequest(
  app: Hono,
  path: string,
  bodyOrOptions?: unknown,
  options: { method?: 'GET' | 'PATCH' | 'POST' | 'DELETE'; cookie?: string } = {},
): Promise<Response> {
  const method = options.method ?? 'GET';
  return app.request(`http://localhost/api/admin${path}`, {
    method,
    headers: {
      ...(bodyOrOptions === undefined ? {} : { 'content-type': 'application/json' }),
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    ...(bodyOrOptions === undefined ? {} : { body: JSON.stringify(bodyOrOptions) }),
  });
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function responseCookie(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) throw new Error('Expected Set-Cookie response header');
  return setCookie.split(';')[0] ?? '';
}
