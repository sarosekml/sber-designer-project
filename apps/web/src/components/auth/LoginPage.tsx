import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authenticatedLanding } from '@/lib/app-route';
import { useAuthStore } from '@/stores/auth-store';

import { AuthShell } from './AuthShell';
import { CaptchaField } from './CaptchaField';
import {
  authErrorPresentation,
  loginRequiresCaptcha,
  registrationIsOpen,
  shouldRefreshCaptcha,
  type AuthErrorPresentation,
} from './auth-view-model';

export function LoginPage() {
  const captchaMode = useAuthStore((state) => state.captchaMode);
  const registration = useAuthStore((state) => state.registration);
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaText, setCaptchaText] = useState('');
  const [captchaVisible, setCaptchaVisible] = useState(() => loginRequiresCaptcha(captchaMode));
  const [captchaRefreshKey, setCaptchaRefreshKey] = useState(0);
  const [error, setError] = useState<AuthErrorPresentation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (captchaMode === 'always') setCaptchaVisible(true);
  }, [captchaMode]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login({
        email,
        password,
        ...(captchaVisible ? { captchaId, captchaText } : {}),
      });
      window.location.assign(authenticatedLanding(window.location));
    } catch (reason) {
      const nextError = authErrorPresentation(reason);
      setError(nextError);
      if (loginRequiresCaptcha(captchaMode, reason)) setCaptchaVisible(true);
      if (shouldRefreshCaptcha(reason)) setCaptchaRefreshKey((key) => key + 1);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to continue to your projects."
      footer={
        registrationIsOpen(registration) ? (
          <span className="text-muted-foreground">
            New to Sber Designer?{' '}
            <a className="font-medium text-primary hover:underline" href="/register">
              Create an account
            </a>
          </span>
        ) : null
      }
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            autoFocus
            required
            disabled={submitting}
            aria-invalid={error?.field === 'email'}
            aria-describedby={error?.field === 'email' ? 'login-email-error' : undefined}
          />
          <FieldError id="login-email-error" error={error} field="email" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            disabled={submitting}
            aria-invalid={error?.field === 'password'}
            aria-describedby={error?.field === 'password' ? 'login-password-error' : undefined}
          />
          <FieldError id="login-password-error" error={error} field="password" />
        </div>

        {captchaVisible ? (
          <CaptchaField
            challengeId={captchaId}
            value={captchaText}
            onChallengeIdChange={setCaptchaId}
            onValueChange={setCaptchaText}
            refreshKey={captchaRefreshKey}
            error={error?.field === 'captcha' ? error.message : null}
            disabled={submitting}
          />
        ) : null}

        <FieldError id="login-form-error" error={error} field="form" />

        <Button className="mt-1 w-full" type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : null}
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}

function FieldError({
  id,
  error,
  field,
}: {
  id: string;
  error: AuthErrorPresentation | null;
  field: AuthErrorPresentation['field'];
}) {
  if (!error || error.field !== field) return null;
  return (
    <p id={id} className="text-xs text-destructive" role="alert">
      {error.message}
    </p>
  );
}
