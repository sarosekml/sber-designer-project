import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from './sessions';

type AuthEnvironment = Record<string, string | undefined>;

export function readSessionCookie(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE_NAME);
}

export function setSessionCookie(
  c: Context,
  token: string,
  expiresAt: string,
  env: AuthEnvironment = process.env,
): void {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    path: '/',
    sameSite: 'Lax',
    secure: shouldUseSecureCookie(c, env),
    maxAge: Math.floor(SESSION_TTL_MS / 1_000),
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie(c: Context, env: AuthEnvironment = process.env): void {
  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: '/',
    secure: shouldUseSecureCookie(c, env),
  });
}

export function shouldUseSecureCookie(
  c: Pick<Context, 'req'>,
  env: AuthEnvironment = process.env,
): boolean {
  if (new URL(c.req.url).protocol === 'https:') return true;
  if (env.SBER_DESIGNER_TRUST_PROXY?.trim() !== '1') return false;
  return c.req.header('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase() === 'https';
}
