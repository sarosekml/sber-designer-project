import type { CaptchaMode, RegistrationMode } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/http';

export type AuthErrorField = 'displayName' | 'email' | 'password' | 'captcha' | 'form';

export interface AuthErrorPresentation {
  code: string;
  field: AuthErrorField;
  message: string;
  captchaRequired: boolean;
}

const ERROR_MESSAGES: Record<string, { field: AuthErrorField; message: string }> = {
  invalid_credentials: { field: 'form', message: 'The email or password is incorrect.' },
  email_taken: { field: 'email', message: 'An account with this email already exists.' },
  captcha_required: { field: 'captcha', message: 'Complete the CAPTCHA to continue.' },
  captcha_invalid: {
    field: 'captcha',
    message: 'The CAPTCHA is incorrect or expired. Try the new challenge.',
  },
  registration_closed: { field: 'form', message: 'Registration is currently closed.' },
  weak_password: { field: 'password', message: 'Use a password between 8 and 256 characters.' },
  invalid_email: { field: 'email', message: 'Enter a valid email address.' },
  invalid_display_name: {
    field: 'displayName',
    message: 'Display name must be between 2 and 64 characters.',
  },
  account_disabled: { field: 'form', message: 'This account has been disabled.' },
  account_locked: { field: 'form', message: 'Too many attempts. Try again later.' },
  rate_limited: { field: 'form', message: 'Too many requests. Try again later.' },
  unauthenticated: { field: 'form', message: 'Your session has expired. Sign in again.' },
};

export function authErrorPresentation(error: unknown): AuthErrorPresentation {
  const code = error instanceof ApiError ? (error.code ?? 'auth_failed') : 'auth_failed';
  const known = ERROR_MESSAGES[code];
  return {
    code,
    field: known?.field ?? 'form',
    message:
      known?.message ??
      (error instanceof Error ? error.message : 'Authentication failed. Please try again.'),
    captchaRequired:
      error instanceof ApiError &&
      (error.captchaRequired ||
        error.code === 'captcha_required' ||
        error.code === 'captcha_invalid'),
  };
}

export function loginRequiresCaptcha(mode: CaptchaMode, error: unknown = null): boolean {
  return mode === 'always' || authErrorPresentation(error).captchaRequired;
}

export function registrationRequiresCaptcha(mode: CaptchaMode): boolean {
  return mode === 'register' || mode === 'always';
}

export function shouldRefreshCaptcha(error: unknown): boolean {
  const presentation = authErrorPresentation(error);
  return presentation.captchaRequired;
}

export function registrationIsOpen(mode: RegistrationMode): boolean {
  return mode === 'open';
}

export function captchaImageSource(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
