import {
  resolveStartupProfile,
  startupNeedsAuthBootstrap,
  type DeploymentMode,
} from '@sber-designer/shared-types';

import type { ClientAuthMode } from './api/http';

export interface ClientStartupProfile {
  deploymentMode: DeploymentMode;
  authMode: ClientAuthMode;
}

export function resolveClientStartupProfile(input: {
  deploymentMode?: string | undefined;
  authMode?: string | undefined;
  oidcIssuer?: string | undefined;
}): ClientStartupProfile {
  return resolveStartupProfile(input);
}

export function clientNeedsAuthBootstrap(profile: ClientStartupProfile): boolean {
  return startupNeedsAuthBootstrap(profile);
}
