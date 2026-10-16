import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import type { DeploymentMode } from '@sber-designer/shared-types';

import { CaptchaStore, type CaptchaMode } from './captcha';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from './cookies';
import { AuthError } from './errors';
import { readContextSessionId, readContextSessionUser } from './middleware';
import { AuthRateLimits, type RateLimitResult } from './rate-limit';
import { AuthService } from './service';

const RegisterSchema = z.object({
  email: z.string(),
  password: z.string(),
  displayName: z.string(),
  captchaId: z.string().max(128).optional(),
  captchaText: z.string().max(16).optional(),
});

const LoginSchema = z.object({
  email: z.string(),
  password: z.string(),
  captchaId: z.string().max(128).optional(),
  captchaText: z.string().max(16).optional(),
});

const ProfileSchema = z.object({ displayName: z.string() });
const PasswordSchema = z.object({ currentPassword: z.string(), newPassword: z.string() });

export interface AuthRouterDependencies {
  service: AuthService;
  requireUser: MiddlewareHandler;
  deploymentMode: DeploymentMode;
  version: string;
  captchaMode: CaptchaMode;
  captchas: CaptchaStore;
  rateLimits: AuthRateLimits;
  env?: Record<string, string | undefined>;
}

export function createAuthRouter(dependencies: AuthRouterDependencies): Hono {
  const router = new Hono();
  const env = dependencies.env ?? process.env;

  router.onError((error, c) => authErrorResponse(c, error));

  router.get('/status', async (c) => {
    const status = await dependencies.service.status();
    return c.json({
      ...status,
      deploymentMode: dependencies.deploymentMode,
      captcha: dependencies.captchaMode,
      version: dependencies.version,
    });
  });

  router.get('/captcha', (c) => {
    enforceRateLimit(dependencies.rateLimits.captchaByIp.consume(requestIp(c, env)), 'captcha');
    return c.json(dependencies.captchas.issue());
  });

  router.post('/register', async (c) => {
    enforceRateLimit(dependencies.rateLimits.registerByIp.consume(requestIp(c, env)), 'register');
    const body = await parseJsonBody(c, RegisterSchema);
    if (dependencies.captchaMode === 'register' || dependencies.captchaMode === 'always') {
      verifyCaptcha(dependencies.captchas, body, 400);
    }
    const result = await dependencies.service.register(body, requestMetadata(c, env));
    setSessionCookie(c, result.issuedSession.token, result.issuedSession.session.expiresAt, env);
    return c.json({ user: result.user }, 201);
  });

  router.post('/login', async (c) => {
    enforceRateLimit(dependencies.rateLimits.loginByIp.consume(requestIp(c, env)), 'login');
    const body = await parseJsonBody(c, LoginSchema);
    const emailKey = loginFailureKey(body.email);
    const before = dependencies.rateLimits.loginFailures.status(emailKey);
    if (before.locked) throw accountLocked(before.retryAfter);

    const captchaRequired =
      dependencies.captchaMode === 'always' ||
      (dependencies.captchaMode === 'register' && before.captchaRequired);
    if (captchaRequired) verifyCaptcha(dependencies.captchas, body, 401);

    try {
      const result = await dependencies.service.login(body, requestMetadata(c, env));
      dependencies.rateLimits.loginFailures.recordSuccess(emailKey);
      setSessionCookie(c, result.issuedSession.token, result.issuedSession.session.expiresAt, env);
      return c.json({ user: result.user });
    } catch (error) {
      if (!(error instanceof AuthError) || error.code !== 'invalid_credentials') throw error;
      const failure = dependencies.rateLimits.loginFailures.recordFailure(emailKey);
      if (failure.locked) throw accountLocked(failure.retryAfter);
      const nextCaptchaRequired =
        dependencies.captchaMode === 'always' ||
        (dependencies.captchaMode === 'register' && failure.captchaRequired);
      throw new AuthError(
        'invalid_credentials',
        401,
        error.message,
        nextCaptchaRequired ? { captchaRequired: true } : {},
      );
    }
  });

  router.use('/logout', dependencies.requireUser);
  router.use('/me/*', dependencies.requireUser);

  router.post('/logout', async (c) => {
    const token = readSessionCookie(c);
    if (token) await dependencies.service.logout(token);
    clearSessionCookie(c, env);
    return c.body(null, 204);
  });

  router.get('/me', (c) => {
    const user = requireSessionUser(c);
    return c.json({ user });
  });

  router.patch('/me', async (c) => {
    const sessionUser = requireSessionUser(c);
    const body = await parseJsonBody(c, ProfileSchema);
    const user = await dependencies.service.updateProfile(sessionUser.id, body.displayName);
    return c.json({ user });
  });

  router.post('/me/password', async (c) => {
    const sessionUser = requireSessionUser(c);
    const sessionId = readContextSessionId(c);
    if (!sessionId) throw new AuthError('unauthenticated', 401, 'Authentication required');
    const body = await parseJsonBody(c, PasswordSchema);
    const user = await dependencies.service.changePassword({
      userId: sessionUser.id,
      sessionId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
    return c.json({ user });
  });

  return router;
}

async function parseJsonBody<T extends z.ZodTypeAny>(c: Context, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new AuthError('invalid_request', 400, 'Request body must be valid JSON');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AuthError(
      'invalid_request',
      400,
      parsed.error.issues[0]?.message ?? 'Invalid request',
    );
  }
  return parsed.data;
}

function requireSessionUser(c: Context) {
  const user = readContextSessionUser(c);
  if (!user) throw new AuthError('unauthenticated', 401, 'Password session required');
  return user;
}

function requestMetadata(
  c: Context,
  env: Record<string, string | undefined>,
): { userAgent: string; ip: string } {
  return {
    userAgent: c.req.header('user-agent') ?? 'unknown',
    ip: requestIp(c, env),
  };
}

function authErrorResponse(c: Context, error: Error): Response {
  if (error instanceof AuthError) {
    const retryAfter = error.metadata.retryAfter;
    if (typeof retryAfter === 'number') c.header('Retry-After', String(retryAfter));
    return c.json({ error: error.code, detail: error.message, ...error.metadata }, error.status);
  }
  const detail = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[auth] request failed: ${detail}\n`);
  return c.json({ error: 'auth_failed', detail: 'Authentication request failed' }, 500);
}

function verifyCaptcha(
  captchas: CaptchaStore,
  input: { captchaId?: string | undefined; captchaText?: string | undefined },
  status: 400 | 401,
): void {
  if (!input.captchaId || !input.captchaText) {
    throw new AuthError('captcha_required', status, 'Captcha is required', {
      captchaRequired: true,
    });
  }
  if (!captchas.verify(input.captchaId, input.captchaText)) {
    throw new AuthError('captcha_invalid', status, 'Captcha is invalid or expired', {
      captchaRequired: true,
    });
  }
}

function enforceRateLimit(result: RateLimitResult, operation: string): void {
  if (result.allowed) return;
  throw new AuthError('rate_limited', 429, `Too many ${operation} requests`, {
    retryAfter: result.retryAfter,
  });
}

function accountLocked(retryAfter: number): AuthError {
  return new AuthError('account_locked', 423, 'Too many failed login attempts', { retryAfter });
}

function loginFailureKey(email: string): string {
  return email.trim().toLocaleLowerCase('en-US');
}

function requestIp(c: Context, env: Record<string, string | undefined>): string {
  if (env.SBER_DESIGNER_TRUST_PROXY?.trim() === '1') {
    const forwardedIp = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwardedIp) return forwardedIp;
  }
  return connectionAddress(c) ?? 'unknown';
}

function connectionAddress(c: Context): string | null {
  const provider = c.env as
    | { requestIP?: (request: Request) => { address?: string } | null }
    | undefined;
  if (typeof provider?.requestIP !== 'function') return null;
  try {
    return provider.requestIP(c.req.raw)?.address?.trim() || null;
  } catch {
    return null;
  }
}
