import { parseDeploymentMode, type DeploymentMode } from '@sber-designer/shared-types';

import type { AuthMode } from './auth/types';

type DeploymentEnvironment = Record<string, string | undefined>;

export function resolveDeploymentMode(env: DeploymentEnvironment = process.env): DeploymentMode {
  return parseDeploymentMode(env.SBER_DESIGNER_DEPLOYMENT_MODE);
}

export function assertDeploymentProfile(
  mode: DeploymentMode,
  authMode: AuthMode,
  env: DeploymentEnvironment = process.env,
): void {
  if (mode === 'local') return;
  if (authMode === 'local') {
    throw new Error('Server deployment mode requires password or oidc authentication.');
  }
  if (env.SBER_DESIGNER_AUTH_DEV_SEED?.trim() === '1') {
    throw new Error('SBER_DESIGNER_AUTH_DEV_SEED is forbidden in server deployment mode.');
  }
  for (const name of ['SBER_DESIGNER_PROJECTS_ROOT', 'SBER_DESIGNER_USERS_ROOT'] as const) {
    if (!env[name]?.trim()) throw new Error(`${name} is required in server deployment mode.`);
  }
}
