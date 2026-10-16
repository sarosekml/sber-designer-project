import { expect, test } from 'bun:test';

import { ApiError } from '@/lib/api/http';

import {
  authErrorPresentation,
  captchaImageSource,
  loginRequiresCaptcha,
  registrationIsOpen,
  registrationRequiresCaptcha,
  shouldRefreshCaptcha,
} from './auth-view-model';

test('stable API auth codes map to field-level English messages', () => {
  expect(authErrorPresentation(new ApiError('duplicate', 409, 'email_taken'))).toMatchObject({
    field: 'email',
    message: 'An account with this email already exists.',
  });
  expect(authErrorPresentation(new ApiError('weak', 400, 'weak_password'))).toMatchObject({
    field: 'password',
    message: 'Use a password between 8 and 256 characters.',
  });
  expect(authErrorPresentation(new ApiError('bad captcha', 400, 'captcha_invalid'))).toMatchObject({
    field: 'captcha',
    captchaRequired: true,
  });
});

test('login reveals and refreshes CAPTCHA after the server requires it', () => {
  const challengeError = new ApiError('wrong', 401, 'invalid_credentials', {
    captchaRequired: true,
  });
  expect(loginRequiresCaptcha('register', challengeError)).toBe(true);
  expect(shouldRefreshCaptcha(challengeError)).toBe(true);
  expect(loginRequiresCaptcha('always')).toBe(true);
  expect(loginRequiresCaptcha('off')).toBe(false);
});

test('registration controls respect closed mode and configured CAPTCHA policy', () => {
  expect(registrationIsOpen('closed')).toBe(false);
  expect(registrationIsOpen('open')).toBe(true);
  expect(registrationRequiresCaptcha('register')).toBe(true);
  expect(registrationRequiresCaptcha('off')).toBe(false);
  expect(captchaImageSource('<svg aria-label="challenge"/>')).toStartWith(
    'data:image/svg+xml;charset=utf-8,',
  );
});
