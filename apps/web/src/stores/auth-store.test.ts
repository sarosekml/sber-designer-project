import { expect, test } from 'bun:test';

import type { AuthStatus, AuthUser } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/http';

import { createAuthStore, type AuthStoreApi, type AuthStoreDependencies } from './auth-store';

const USER: AuthUser = {
  id: 'user-1',
  email: 'person@example.com',
  displayName: 'Person Example',
  role: 'member',
  mustChangePassword: false,
};

function createDependencies(
  authStatus: AuthStatus,
  overrides: Partial<AuthStoreApi> = {},
): { dependencies: AuthStoreDependencies; modes: Array<AuthStatus['authMode'] | null> } {
  const modes: Array<AuthStatus['authMode'] | null> = [];
  const api: AuthStoreApi = {
    status: async () => authStatus,
    captcha: async () => ({ challengeId: 'c1', svg: '<svg/>', expiresAt: 'later' }),
    register: async () => USER,
    login: async () => USER,
    logout: async () => undefined,
    me: async () => USER,
    updateMe: async () => USER,
    changePassword: async () => USER,
    ...overrides,
  };
  return {
    dependencies: {
      api,
      setMode: (mode) => modes.push(mode),
      hasOidcToken: () => false,
    },
    modes,
  };
}

test('bootstrap enters local mode without requesting a session user', async () => {
  let meCalls = 0;
  const { dependencies, modes } = createDependencies(
    {
      deploymentMode: 'local',
      authMode: 'local',
      registration: 'closed',
      captcha: 'off',
      version: '1',
    },
    { me: async () => ((meCalls += 1), USER) },
  );
  const store = createAuthStore(dependencies);

  await store.getState().bootstrap();

  expect(store.getState().status).toBe('local');
  expect(store.getState().user).toBeNull();
  expect(store.getState().deploymentMode).toBe('local');
  expect(store.getState().registration).toBe('closed');
  expect(meCalls).toBe(0);
  expect(modes).toEqual(['local']);
});

test('bootstrap resolves a password session into the authenticated state', async () => {
  const { dependencies } = createDependencies({
    deploymentMode: 'server',
    authMode: 'password',
    registration: 'open',
    captcha: 'register',
    version: '2',
  });
  const store = createAuthStore(dependencies);

  await store.getState().bootstrap();

  expect(store.getState().status).toBe('authed');
  expect(store.getState().user).toEqual(USER);
  expect(store.getState().captchaMode).toBe('register');
});

test('bootstrap treats a password me 401 as an anonymous session', async () => {
  const { dependencies } = createDependencies(
    {
      deploymentMode: 'server',
      authMode: 'password',
      registration: 'closed',
      captcha: 'always',
      version: '2',
    },
    { me: async () => Promise.reject(new ApiError('Authentication required', 401)) },
  );
  const store = createAuthStore(dependencies);

  await store.getState().bootstrap();

  expect(store.getState().status).toBe('anonymous');
  expect(store.getState().user).toBeNull();
  expect(store.getState().registration).toBe('closed');
});

test('bootstrap records transport failures and clears the selected auth mode', async () => {
  const { dependencies, modes } = createDependencies({
    deploymentMode: 'server',
    authMode: 'password',
    registration: 'open',
    captcha: 'register',
    version: '2',
  });
  dependencies.api.status = async () => Promise.reject(new Error('API unavailable'));
  const store = createAuthStore(dependencies);

  await store.getState().bootstrap();

  expect(store.getState().status).toBe('anonymous');
  expect(store.getState().authMode).toBeNull();
  expect(store.getState().bootstrapError).toBe('API unavailable');
  expect(modes).toEqual([null]);
});

test('login, password change, and logout keep the session state in sync', async () => {
  const changedUser = { ...USER, mustChangePassword: false, displayName: 'Updated Person' };
  const { dependencies } = createDependencies(
    {
      deploymentMode: 'server',
      authMode: 'password',
      registration: 'open',
      captcha: 'off',
      version: '2',
    },
    {
      updateMe: async (displayName) => ({ ...USER, displayName }),
      changePassword: async () => changedUser,
    },
  );
  const store = createAuthStore(dependencies);

  await store.getState().login({ email: USER.email, password: 'password' });
  expect(store.getState().status).toBe('authed');
  await store.getState().updateMe('Updated Person');
  expect(store.getState().user?.displayName).toBe('Updated Person');
  await store
    .getState()
    .changePassword({ currentPassword: 'password', newPassword: 'next-password' });
  expect(store.getState().user).toEqual(changedUser);
  await store.getState().logout();
  expect(store.getState().status).toBe('anonymous');
  expect(store.getState().user).toBeNull();
});
