import { authenticatedLanding } from '@/lib/app-route';

import { AuthShell } from './AuthShell';
import { PasswordChangeForm } from './PasswordChangeForm';

export function ForcedPasswordChangePage() {
  return (
    <AuthShell
      title="Change your password"
      description="Your temporary password must be replaced before you can continue."
    >
      <PasswordChangeForm
        submitLabel="Change password and continue"
        onChanged={() => window.location.replace(authenticatedLanding(window.location))}
      />
    </AuthShell>
  );
}
