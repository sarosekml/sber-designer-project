export type DeploymentMode = 'local' | 'server';
export type StartupAuthMode = 'local' | 'password' | 'oidc';

export interface StartupProfile {
  deploymentMode: DeploymentMode;
  authMode: StartupAuthMode;
}

export function parseDeploymentMode(value: string | undefined): DeploymentMode {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return 'local';
  if (normalized === 'local' || normalized === 'server') return normalized;
  throw new Error(`SBER_DESIGNER_DEPLOYMENT_MODE must be local or server; received ${normalized}`);
}

export function resolveStartupProfile(input: {
  deploymentMode?: string | undefined;
  authMode?: string | undefined;
  oidcIssuer?: string | undefined;
}): StartupProfile {
  const deploymentMode = parseDeploymentMode(input.deploymentMode);
  const configuredAuth = input.authMode?.trim().toLowerCase();
  const authMode = configuredAuth || input.oidcIssuer?.trim() ? configuredAuth || 'oidc' : 'local';
  if (authMode !== 'local' && authMode !== 'password' && authMode !== 'oidc') {
    throw new Error(`Startup auth mode must be local, password, or oidc; received ${authMode}`);
  }
  if (deploymentMode === 'server' && authMode === 'local') {
    throw new Error('Server startup profile requires password or oidc authentication.');
  }
  return { deploymentMode, authMode };
}

export function startupNeedsAuthBootstrap(profile: StartupProfile): boolean {
  return profile.authMode !== 'local';
}
