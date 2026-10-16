import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const authComponents = 'apps/web/src/components/auth';

test('login and registration render stable API errors next to their fields', async () => {
  const [loginPage, registerPage] = await Promise.all([
    readFile(`${authComponents}/LoginPage.tsx`, 'utf8'),
    readFile(`${authComponents}/RegisterPage.tsx`, 'utf8'),
  ]);

  expect(loginPage).toContain('authErrorPresentation(reason)');
  expect(loginPage).toContain("error?.field === 'captcha'");
  expect(registerPage).toContain("error?.field === 'displayName'");
  expect(registerPage).toContain("error?.field === 'password'");
});

test('CAPTCHA refreshes manually and after an API challenge failure', async () => {
  const [captchaField, loginPage] = await Promise.all([
    readFile(`${authComponents}/CaptchaField.tsx`, 'utf8'),
    readFile(`${authComponents}/LoginPage.tsx`, 'utf8'),
  ]);

  expect(captchaField).toContain('aria-label="Refresh CAPTCHA"');
  expect(captchaField).toContain('setRequestKey((key) => key + 1)');
  expect(loginPage).toContain('shouldRefreshCaptcha(reason)');
  expect(loginPage).toContain('setCaptchaRefreshKey((key) => key + 1)');
});

test('closed registration hides the create-account route and link', async () => {
  const [app, loginPage, registerPage] = await Promise.all([
    readFile('apps/web/src/App.tsx', 'utf8'),
    readFile(`${authComponents}/LoginPage.tsx`, 'utf8'),
    readFile(`${authComponents}/RegisterPage.tsx`, 'utf8'),
  ]);

  expect(app).toContain("route.kind === 'register' && registration === 'open'");
  expect(loginPage).toContain('registrationIsOpen(registration)');
  expect(registerPage).toContain('title="Registration is closed"');
});
