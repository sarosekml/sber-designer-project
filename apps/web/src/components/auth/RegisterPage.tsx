import { useState, type FormEvent } from 'react';
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
  registrationIsOpen,
  registrationRequiresCaptcha,
  shouldRefreshCaptcha,
  type AuthErrorPresentation,
} from './auth-view-model';

export function RegisterPage() {
  const captchaMode = useAuthStore((state) => state.captchaMode);
  const registration = useAuthStore((state) => state.registration);
  const register = useAuthStore((state) => state.register);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaText, setCaptchaText] = useState('');
  const [captchaRefreshKey, setCaptchaRefreshKey] = useState(0);
  const [error, setError] = useState<AuthErrorPresentation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const captchaVisible = registrationRequiresCaptcha(captchaMode);

  if (!registrationIsOpen(registration)) {
    return (
      <AuthShell
        title="Registration is closed"
        description="Ask an administrator for an account, then return to sign in."
        footer={
          <a className="font-medium text-primary hover:underline" href="/login">
            Sign in instead
          </a>
        }
      >
        <p className="text-center text-sm text-muted-foreground">
          New accounts cannot be created on this server right now.
        </p>
      </AuthShell>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register({
        displayName,
        email,
        password,
        ...(captchaVisible ? { captchaId, captchaText } : {}),
      });
      window.location.assign(authenticatedLanding(window.location));
    } catch (reason) {
      setError(authErrorPresentation(reason));
      if (shouldRefreshCaptcha(reason)) setCaptchaRefreshKey((key) => key + 1);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      description="Set up your Sber Designer workspace access."
      footer={
        <span className="text-muted-foreground">
          Already have an account?{' '}
          <a className="font-medium text-primary hover:underline" href="/login">
            Sign in instead
          </a>
        </span>
      }
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <AuthInput
          id="register-name"
          label="Display name"
          name="displayName"
          value={displayName}
          onChange={setDisplayName}
          autoComplete="name"
          minLength={2}
          maxLength={64}
          autoFocus
          disabled={submitting}
          error={error?.field === 'displayName' ? error.message : null}
        />
        <AuthInput
          id="register-email"
          label="Email"
          name="email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          disabled={submitting}
          error={error?.field === 'email' ? error.message : null}
        />
        <AuthInput
          id="register-password"
          label="Password"
          name="password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
          maxLength={256}
          disabled={submitting}
          error={error?.field === 'password' ? error.message : null}
        />

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

        {error?.field === 'form' ? (
          <p className="text-xs text-destructive" role="alert">
            {error.message}
          </p>
        ) : null}

        <Button className="mt-1 w-full" type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : null}
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}

interface AuthInputProps {
  id: string;
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  minLength?: number;
  maxLength?: number;
  autoFocus?: boolean;
  disabled: boolean;
  error: string | null;
}

function AuthInput({
  id,
  label,
  name,
  type = 'text',
  value,
  onChange,
  autoComplete,
  minLength,
  maxLength,
  autoFocus,
  disabled,
  error,
}: AuthInputProps) {
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={maxLength}
        autoFocus={autoFocus}
        required
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
