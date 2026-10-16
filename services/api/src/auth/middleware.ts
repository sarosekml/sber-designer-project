import type { Context, MiddlewareHandler } from 'hono';

import { readSessionCookie, setSessionCookie } from './cookies';
import type { OidcVerifier } from './oidc';
import { AuthService } from './service';
import {
  matchServiceToken,
  parseServiceTokens,
  SERVICE_TOKEN_HEADER,
  type ServiceTokenEntry,
} from './service-tokens';
import type { AuthMode, SessionUser } from './types';

export type AuthMethod = 'local' | 'oidc' | 'service' | 'session';

export interface AuthMiddlewareDependencies {
  mode: AuthMode;
  service: AuthService;
  oidc: OidcVerifier;
  serviceTokens?: readonly ServiceTokenEntry[];
  env?: Record<string, string | undefined>;
}

export function createRequireUser(dependencies: AuthMiddlewareDependencies): MiddlewareHandler {
  const env = dependencies.env ?? process.env;
  const serviceTokens =
    dependencies.serviceTokens ?? parseServiceTokens(env.SBER_DESIGNER_SERVICE_TOKENS);
  return async (c, next) => {
    // The global /api guard also wraps auth-router routes that keep their
    // local guard for standalone tests. Never verify or rotate one session twice.
    if (readContextAuthMethod(c)) {
      await next();
      return;
    }

    const serviceIdentity = matchServiceToken(c.req.header(SERVICE_TOKEN_HEADER), serviceTokens);
    if (serviceIdentity) {
      c.set('user', `svc:${serviceIdentity.name}`);
      c.set('authMethod', 'service');
      await next();
      return;
    }

    if (dependencies.mode === 'oidc') {
      const auth = c.req.header('authorization') ?? '';
      if (!auth.toLowerCase().startsWith('bearer ')) {
        return c.json(
          {
            error: 'unauthenticated',
            detail:
              'OIDC mode is on — send `Authorization: Bearer <jwt>`. (See SBER_DESIGNER_OIDC_ISSUER.)',
          },
          401,
        );
      }
      try {
        const identity = await dependencies.oidc.verify(auth.slice(7).trim());
        c.set('user', identity.user);
        c.set('oidcClaims', identity.claims);
        c.set('authMethod', 'oidc');
        await next();
        return;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return c.json({ error: 'invalid_token', detail }, 401);
      }
    }

    if (dependencies.mode === 'password') {
      const token = readSessionCookie(c);
      const identity = token ? await dependencies.service.authenticateSession(token) : null;
      if (!identity) {
        return c.json({ error: 'unauthenticated', detail: 'Authentication required' }, 401);
      }
      c.set('user', identity.user.email);
      c.set('sessionUser', identity.user);
      c.set('authSessionId', identity.sessionId);
      c.set('authMethod', 'session');
      if (identity.renewedToken) {
        setSessionCookie(
          c,
          identity.renewedToken,
          identity.expiresAt,
          dependencies.env ?? process.env,
        );
      }
      await next();
      return;
    }

    const stub = c.req.header('x-sber-designer-user');
    if (!stub) {
      return c.json(
        {
          error: 'unauthenticated',
          detail:
            'Send `x-sber-designer-user` header (Phase-1 stub). For real OIDC, set SBER_DESIGNER_OIDC_ISSUER on the api process.',
        },
        401,
      );
    }
    c.set('user', stub);
    c.set('authMethod', 'local');
    await next();
  };
}

export function readContextUser(c: Context, mode: AuthMode): string {
  const fromContext = c.get('user');
  if (typeof fromContext === 'string' && fromContext) return fromContext;
  if (mode === 'local') {
    const fromHeader = c.req.header('x-sber-designer-user');
    if (fromHeader) return fromHeader;
  }
  return 'anonymous';
}

export function readContextSessionUser(c: Context): SessionUser | null {
  const value = c.get('sessionUser');
  if (!value || typeof value !== 'object') return null;
  return value as SessionUser;
}

export function readContextSessionId(c: Context): string | null {
  const value = c.get('authSessionId');
  return typeof value === 'string' && value ? value : null;
}

export function readContextAuthMethod(c: Context): AuthMethod | null {
  const value = c.get('authMethod');
  return value === 'local' || value === 'oidc' || value === 'service' || value === 'session'
    ? value
    : null;
}

export function createRequireAdmin(): MiddlewareHandler {
  return async (c, next) => {
    const user = readContextSessionUser(c);
    if (user?.role !== 'admin') {
      return c.json({ error: 'forbidden', detail: 'Administrator access required' }, 403);
    }
    await next();
  };
}
