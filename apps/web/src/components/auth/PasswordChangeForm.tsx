import { useState, type FormEvent } from 'react';
import { Check, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AuthUser } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/http';
import { useAuthStore } from '@/stores/auth-store';

import { authErrorPresentation } from './auth-view-model';

interface PasswordChangeFormProps {
  submitLabel?: string;
  onChanged?: (user: AuthUser) => void;
}

type PasswordErrorField = 'current' | 'next' | 'confirm' | 'form';

export function PasswordChangeForm({
  submitLabel = 'Change password',
  onChanged,
}: PasswordChangeFormProps) {
  const changePassword = useAuthStore((state) => state.changePassword);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<{ field: PasswordErrorField; message: string } | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError({ field: 'confirm', message: 'Passwords do not match.' });
      return;
    }

    setSubmitting(true);
    try {
      const user = await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
      onChanged?.(user);
    } catch (reason) {
      const presentation = authErrorPresentation(reason);
      setError({
        field:
          reason instanceof ApiError && reason.code === 'invalid_credentials'
            ? 'current'
            : presentation.field === 'password'
              ? 'next'
              : 'form',
        message:
          reason instanceof ApiError && reason.code === 'invalid_credentials'
            ? 'The current password is incorrect.'
            : presentation.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <PasswordInput
        id="current-password"
        label="Current password"
        value={currentPassword}
        onChange={setCurrentPassword}
        autoComplete="current-password"
        disabled={submitting}
        error={error?.field === 'current' ? error.message : null}
      />
      <PasswordInput
        id="new-password"
        label="New password"
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
        disabled={submitting}
        minLength={8}
        maxLength={256}
        error={error?.field === 'next' ? error.message : null}
      />
      <PasswordInput
        id="confirm-password"
        label="Confirm new password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
        disabled={submitting}
        minLength={8}
        maxLength={256}
        error={error?.field === 'confirm' ? error.message : null}
      />

      {error?.field === 'form' ? (
        <p className="text-xs text-destructive" role="alert">
          {error.message}
        </p>
      ) : null}
      {success ? (
        <p className="flex items-center gap-1.5 text-xs text-success" role="status">
          <Check className="size-3.5" /> Password changed.
        </p>
      ) : null}

      <Button className="mt-1 w-full" type="submit" disabled={submitting}>
        {submitting ? <Loader2 className="animate-spin" /> : null}
        {submitLabel}
      </Button>
    </form>
  );
}

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  disabled: boolean;
  minLength?: number;
  maxLength?: number;
  error: string | null;
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled,
  minLength,
  maxLength,
  error,
}: PasswordInputProps) {
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        disabled={disabled}
        minLength={minLength}
        maxLength={maxLength}
        required
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
