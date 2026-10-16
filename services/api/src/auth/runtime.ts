import type { Context } from 'hono';
import { type DeploymentMode } from '@sber-designer/shared-types';

import { loadBuildInfo } from '../build-info';
import { assertDeploymentProfile, resolveDeploymentMode } from '../deployment-mode';
import { loadLocalEnvFiles } from '../local-env';
import { CaptchaStore, resolveCaptchaMode } from './captcha';
import {
  createRequireAdmin,
  createRequireUser,
  readContextSessionUser,
  readContextUser,
} from './middleware';
import { resolveAuthMode } from './mode';
import { createOidcVerifier } from './oidc';
import { AuthRateLimits } from './rate-limit';
import { createAuthRouter } from './router';
import { createAdminRouter } from './admin-router';
import { AuthService } from './service';
import { AuthStore } from './store';
import type { SessionUser } from './types';

if (process.env.SBER_DESIGNER_DISABLE_LOCAL_ENV_LOAD !== '1') loadLocalEnvFiles();

const mode = resolveAuthMode();
const deployment = resolveDeploymentMode();
const store = new AuthStore();
const service = new AuthService(mode, store);
const oidc = createOidcVerifier();
const captchaMode = resolveCaptchaMode(mode);
const captchas = new CaptchaStore();
const rateLimits = new AuthRateLimits();

export const requireUser = createRequireUser({ mode, service, oidc });
export const requireAdmin = createRequireAdmin();
export const authRouter = createAuthRouter({
  service,
  requireUser,
  deploymentMode: deployment,
  version: readBuildVersion(),
  captchaMode,
  captchas,
  rateLimits,
});
export const adminRouter = createAdminRouter({
  service,
  store,
  requireUser,
  requireAdmin,
});

export function initializeAuth(): Promise<void> {
  assertDeploymentProfile(deployment, mode);
  return service.initialize();
}

export function authMode() {
  return mode;
}

export function deploymentMode(): DeploymentMode {
  return deployment;
}

export function getUser(c: Context): string {
  return readContextUser(c, mode);
}

export function getSessionUser(c: Context): SessionUser | null {
  return readContextSessionUser(c);
}

export function getAuthService(): AuthService {
  return service;
}

export function getAuthStore(): AuthStore {
  return store;
}

function readBuildVersion(): string {
  try {
    return loadBuildInfo().version;
  } catch {
    return 'development';
  }
}
