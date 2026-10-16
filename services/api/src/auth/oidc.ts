import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

type AuthEnvironment = Record<string, string | undefined>;

export interface OidcIdentity {
  user: string;
  claims: JWTPayload;
}

export interface OidcVerifier {
  verify(token: string): Promise<OidcIdentity>;
}

export function createOidcVerifier(env: AuthEnvironment = process.env): OidcVerifier {
  const issuer = env.SBER_DESIGNER_OIDC_ISSUER?.trim() ?? '';
  const audience = env.SBER_DESIGNER_OIDC_AUDIENCE?.trim() ?? '';
  const jwksUrl =
    env.SBER_DESIGNER_OIDC_JWKS_URL?.trim() ||
    (issuer ? `${issuer.replace(/\/$/u, '')}/protocol/openid-connect/certs` : '');
  let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  return {
    async verify(token) {
      if (!issuer || !jwksUrl) throw new Error('OIDC issuer is not configured');
      jwks ??= createRemoteJWKSet(new URL(jwksUrl));
      const { payload } = await jwtVerify(token, jwks, {
        issuer,
        ...(audience ? { audience } : {}),
      });
      return { user: pickUserClaim(payload), claims: payload };
    },
  };
}

function pickUserClaim(payload: JWTPayload): string {
  const candidates: unknown[] = [payload['preferred_username'], payload['email'], payload['sub']];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return 'oidc-user';
}
