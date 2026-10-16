import type { AuthMode } from './types';

type AuthEnvironment = Record<string, string | undefined>;

const AUTH_MODES = new Set<AuthMode>(['local', 'password', 'oidc']);

/** Resolve and validate the process-wide auth mode before the API starts. */
export function resolveAuthMode(env: AuthEnvironment = process.env): AuthMode {
  const configured = env.SBER_DESIGNER_AUTH_MODE?.trim().toLowerCase();
  const issuer = env.SBER_DESIGNER_OIDC_ISSUER?.trim();

  let mode: AuthMode;
  if (configured) {
    if (!AUTH_MODES.has(configured as AuthMode)) {
      throw new Error(
        `SBER_DESIGNER_AUTH_MODE must be local, password, or oidc; received ${configured}`,
      );
    }
    mode = configured as AuthMode;
  } else {
    // Preserve the pre-0400 OIDC activation contract for existing installs.
    mode = issuer ? 'oidc' : 'local';
  }

  if (mode === 'password' && issuer) {
    throw new Error('SBER_DESIGNER_AUTH_MODE=password conflicts with SBER_DESIGNER_OIDC_ISSUER');
  }
  if (mode === 'oidc' && !issuer) {
    throw new Error('SBER_DESIGNER_AUTH_MODE=oidc requires SBER_DESIGNER_OIDC_ISSUER');
  }

  return mode;
}
