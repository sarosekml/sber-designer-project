import { create } from 'zustand';

import {
  captcha,
  changePassword as changePasswordRequest,
  login as loginRequest,
  logout as logoutRequest,
  me,
  register as registerRequest,
  status as fetchAuthStatus,
  updateMe as updateMeRequest,
  type AuthStatus,
  type AuthUser,
  type LoginInput,
  type RegisterInput,
} from '@/lib/api/auth';
import { ApiError, OIDC_TOKEN_KEY, setClientAuthMode } from '@/lib/api/http';

export type AuthStateStatus = 'loading' | 'anonymous' | 'authed' | 'local';

export interface AuthStoreApi {
  status: typeof fetchAuthStatus;
  captcha: typeof captcha;
  register: typeof registerRequest;
  login: typeof loginRequest;
  logout: typeof logoutRequest;
  me: typeof me;
  updateMe: typeof updateMeRequest;
  changePassword: typeof changePasswordRequest;
}

export interface AuthStoreDependencies {
  api: AuthStoreApi;
  setMode: typeof setClientAuthMode;
  hasOidcToken: () => boolean;
}

export interface AuthStoreState {
  status: AuthStateStatus;
  deploymentMode: AuthStatus['deploymentMode'] | null;
  authMode: AuthStatus['authMode'] | null;
  registration: AuthStatus['registration'];
  captchaMode: AuthStatus['captcha'];
  version: string | null;
  user: AuthUser | null;
  bootstrapError: string | null;
  bootstrap: () => Promise<void>;
  login: (input: LoginInput) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  updateMe: (displayName: string) => Promise<AuthUser>;
  changePassword: (input: { currentPassword: string; newPassword: string }) => Promise<AuthUser>;
}

const defaultDependencies: AuthStoreDependencies = {
  api: {
    status: fetchAuthStatus,
    captcha,
    register: registerRequest,
    login: loginRequest,
    logout: logoutRequest,
    me,
    updateMe: updateMeRequest,
    changePassword: changePasswordRequest,
  },
  setMode: setClientAuthMode,
  hasOidcToken: () =>
    typeof window !== 'undefined' && Boolean(window.localStorage.getItem(OIDC_TOKEN_KEY)),
};

export function createAuthStore(dependencies: AuthStoreDependencies = defaultDependencies) {
  let pendingBootstrap: Promise<void> | null = null;

  return create<AuthStoreState>((set) => ({
    status: 'loading',
    deploymentMode: null,
    authMode: null,
    registration: 'closed',
    captchaMode: 'off',
    version: null,
    user: null,
    bootstrapError: null,

    bootstrap: () => {
      if (pendingBootstrap) return pendingBootstrap;
      pendingBootstrap = bootstrapAuth(dependencies, set).finally(() => {
        pendingBootstrap = null;
      });
      return pendingBootstrap;
    },

    login: async (input) => {
      const user = await dependencies.api.login(input);
      set({ status: 'authed', user, bootstrapError: null });
      return user;
    },

    register: async (input) => {
      const user = await dependencies.api.register(input);
      set({ status: 'authed', user, bootstrapError: null });
      return user;
    },

    logout: async () => {
      try {
        await dependencies.api.logout();
      } finally {
        set({ status: 'anonymous', user: null });
      }
    },

    updateMe: async (displayName) => {
      const user = await dependencies.api.updateMe(displayName);
      set({ user });
      return user;
    },

    changePassword: async (input) => {
      const user = await dependencies.api.changePassword(input);
      set({ user });
      return user;
    },
  }));
}

async function bootstrapAuth(
  dependencies: AuthStoreDependencies,
  set: (partial: Partial<AuthStoreState>) => void,
): Promise<void> {
  set({ status: 'loading', bootstrapError: null });
  try {
    const server = await dependencies.api.status();
    dependencies.setMode(server.authMode);
    set({
      deploymentMode: server.deploymentMode,
      authMode: server.authMode,
      registration: server.registration,
      captchaMode: server.captcha,
      version: server.version,
    });

    if (server.authMode === 'local') {
      set({ status: 'local', user: null });
      return;
    }

    if (server.authMode === 'oidc') {
      set({ status: dependencies.hasOidcToken() ? 'authed' : 'anonymous', user: null });
      return;
    }

    try {
      const user = await dependencies.api.me();
      set({ status: 'authed', user });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        set({ status: 'anonymous', user: null });
        return;
      }
      throw error;
    }
  } catch (error) {
    dependencies.setMode(null);
    set({
      status: 'anonymous',
      deploymentMode: null,
      authMode: null,
      user: null,
      bootstrapError: error instanceof Error ? error.message : String(error),
    });
  }
}

export const useAuthStore = createAuthStore();
