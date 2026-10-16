import { useEffect, useState, type FormEvent } from 'react';
import { Check, Loader2, Save } from 'lucide-react';

import { PasswordChangeForm } from '@/components/auth/PasswordChangeForm';
import { authErrorPresentation } from '@/components/auth/auth-view-model';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth-store';

import { buildUserMenuModel, UserAvatar } from './UserAvatarMenu';

export function validateDisplayName(value: string): string | null {
  const length = Array.from(value.trim()).length;
  if (length < 2) return 'Display name must be at least 2 characters.';
  if (length > 64) return 'Display name must be 64 characters or fewer.';
  return null;
}

export function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const updateMe = useAuthStore((state) => state.updateMe);
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
  }, [user?.displayName]);

  if (!user) {
    return (
      <main className="min-h-full bg-background">
        <PageHeader />
        <div className="mx-auto max-w-3xl px-6 py-10">
          <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Profile settings are unavailable for this authentication mode.
          </p>
        </div>
      </main>
    );
  }

  const cleanDisplayName = displayName.trim();
  const validationError = validateDisplayName(displayName);
  const dirty = cleanDisplayName !== user.displayName;

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccess(false);
    const nextValidationError = validateDisplayName(displayName);
    if (nextValidationError) {
      setError(nextValidationError);
      return;
    }
    if (!dirty) return;

    setSaving(true);
    setError(null);
    try {
      const updated = await updateMe(cleanDisplayName);
      setDisplayName(updated.displayName);
      setSuccess(true);
    } catch (reason) {
      setError(authErrorPresentation(reason).message);
    } finally {
      setSaving(false);
    }
  };

  const avatar = buildUserMenuModel(user);

  return (
    <main className="min-h-full bg-background">
      <PageHeader />
      <div className="mx-auto grid w-full max-w-3xl gap-6 px-6 py-8">
        <ProfileSection
          title="Profile"
          description="Update how your name appears across projects and activity."
        >
          <div className="flex items-center gap-4">
            <UserAvatar model={avatar} className="size-14" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <form className="grid max-w-md gap-4" onSubmit={handleProfileSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="profile-display-name">Display name</Label>
              <Input
                id="profile-display-name"
                name="displayName"
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  setError(null);
                  setSuccess(false);
                }}
                minLength={2}
                maxLength={64}
                autoComplete="name"
                disabled={saving}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'profile-name-error' : undefined}
              />
              {error ? (
                <p id="profile-name-error" className="text-xs text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving || !dirty || Boolean(validationError)}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                Save profile
              </Button>
              {success ? (
                <span className="flex items-center gap-1.5 text-xs text-success" role="status">
                  <Check className="size-3.5" /> Profile saved.
                </span>
              ) : null}
            </div>
          </form>
        </ProfileSection>

        <ProfileSection title="Account" description="Your account identity on this server.">
          <div className="grid max-w-md gap-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={user.email} readOnly aria-readonly="true" />
            <p className="text-xs text-muted-foreground">
              Email changes are managed by an administrator.
            </p>
          </div>
        </ProfileSection>

        <ProfileSection
          title="Password"
          description="Use your current password to set a new one. Other sessions will be signed out."
        >
          <div className="max-w-md">
            <PasswordChangeForm />
          </div>
        </ProfileSection>
      </div>
    </main>
  );
}

function PageHeader() {
  return (
    <header className="flex h-12 items-center border-b border-border bg-card px-5">
      <h1 className="text-sm font-semibold">Profile settings</h1>
    </header>
  );
}

function ProfileSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-5 rounded-lg border border-border bg-card p-5">
      <header className="grid gap-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  );
}
