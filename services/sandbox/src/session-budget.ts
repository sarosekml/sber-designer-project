import { parseDeploymentMode, type DeploymentMode } from '@sber-designer/shared-types';

export const DEFAULT_SERVER_SANDBOX_MAX_SESSIONS = 5;

export function resolveSandboxMaxSessions(
  value = process.env.SBER_DESIGNER_SANDBOX_MAX_SESSIONS,
  deploymentMode: DeploymentMode = parseDeploymentMode(process.env.SBER_DESIGNER_DEPLOYMENT_MODE),
): number | null {
  const raw = value?.trim();
  if (!raw) {
    return deploymentMode === 'server' ? DEFAULT_SERVER_SANDBOX_MAX_SESSIONS : null;
  }
  if (!/^\d+$/u.test(raw)) {
    throw new Error('SBER_DESIGNER_SANDBOX_MAX_SESSIONS must be a non-negative integer.');
  }
  return Number.parseInt(raw, 10);
}

export function sandboxCapacityError(
  activeSessions: number,
  maxSessions: number | null,
): {
  error: 'sandbox_session_limit';
  detail: string;
  activeSessions: number;
  maxSessions: number;
} | null {
  if (maxSessions === null || activeSessions < maxSessions) return null;
  return {
    error: 'sandbox_session_limit',
    detail: `Sandbox capacity is full (${activeSessions}/${maxSessions}). Stop an inactive project session before starting another.`,
    activeSessions,
    maxSessions,
  };
}
