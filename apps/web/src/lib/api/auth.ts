import { API_URL, ApiError, authHeaders, safeJson, withSignal, type ClientAuthMode } from './http';
import type { DeploymentMode } from '@sber-designer/shared-types';

export type RegistrationMode = 'open' | 'closed';
export type CaptchaMode = 'off' | 'register' | 'always';
export type AuthUserRole = 'admin' | 'member';

export interface AuthStatus {
  deploymentMode: DeploymentMode;
  authMode: ClientAuthMode;
  registration: RegistrationMode;
  captcha: CaptchaMode;
  version: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: AuthUserRole;
  mustChangePassword: boolean;
}

export interface CaptchaChallenge {
  challengeId: string;
  svg: string;
  expiresAt: string;
}

export interface CaptchaAnswer {
  captchaId?: string;
  captchaText?: string;
}

export interface LoginInput extends CaptchaAnswer {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  displayName: string;
}

export async function status(signal?: AbortSignal): Promise<AuthStatus> {
  return request<AuthStatus>('/api/auth/status', {}, signal);
}

export async function captcha(signal?: AbortSignal): Promise<CaptchaChallenge> {
  return request<CaptchaChallenge>('/api/auth/captcha', {}, signal);
}

export async function register(input: RegisterInput, signal?: AbortSignal): Promise<AuthUser> {
  const result = await request<{ user: AuthUser }>(
    '/api/auth/register',
    jsonRequest('POST', input),
    signal,
  );
  return result.user;
}

export async function login(input: LoginInput, signal?: AbortSignal): Promise<AuthUser> {
  const result = await request<{ user: AuthUser }>(
    '/api/auth/login',
    jsonRequest('POST', input),
    signal,
  );
  return result.user;
}

export async function logout(signal?: AbortSignal): Promise<void> {
  await request<void>('/api/auth/logout', { method: 'POST', headers: authHeaders() }, signal);
}

export async function me(signal?: AbortSignal): Promise<AuthUser> {
  const result = await request<{ user: AuthUser }>(
    '/api/auth/me',
    { headers: authHeaders() },
    signal,
  );
  return result.user;
}

export async function updateMe(displayName: string, signal?: AbortSignal): Promise<AuthUser> {
  const result = await request<{ user: AuthUser }>(
    '/api/auth/me',
    jsonRequest('PATCH', { displayName }, true),
    signal,
  );
  return result.user;
}

export async function changePassword(
  input: { currentPassword: string; newPassword: string },
  signal?: AbortSignal,
): Promise<AuthUser> {
  const result = await request<{ user: AuthUser }>(
    '/api/auth/me/password',
    jsonRequest('POST', input, true),
    signal,
  );
  return result.user;
}

function jsonRequest(method: string, body: unknown, authenticated = false): RequestInit {
  return {
    method,
    headers: {
      ...(authenticated ? authHeaders() : {}),
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

async function request<T>(path: string, init: RequestInit, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, withSignal(init, signal));
  if (!response.ok) {
    const body = await safeJson(response, {
      redirectUnauthorized: !suppressesCredentialErrorRedirect(path),
    });
    throw new ApiError(body?.detail ?? `HTTP ${response.status}`, response.status, body?.error, {
      ...(body?.captchaRequired === true ? { captchaRequired: true } : {}),
      ...(typeof body?.retryAfter === 'number' ? { retryAfter: body.retryAfter } : {}),
    });
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function suppressesCredentialErrorRedirect(path: string): boolean {
  return (
    path === '/api/auth/login' || path === '/api/auth/register' || path === '/api/auth/me/password'
  );
}
