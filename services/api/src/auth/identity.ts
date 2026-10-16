import { AuthError } from './errors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/u;

export function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 320 || !EMAIL_PATTERN.test(email) || hasControlCharacters(email)) {
    throw new AuthError('invalid_email', 400, 'Enter a valid email address');
  }
  return email;
}

export function normalizeDisplayName(value: string): string {
  if (hasControlCharacters(value)) {
    throw new AuthError('invalid_display_name', 400, 'Display name contains invalid characters');
  }
  const displayName = value.trim().replace(/\s+/gu, ' ');
  if (displayName.length < 2 || displayName.length > 64) {
    throw new AuthError('invalid_display_name', 400, 'Display name must contain 2–64 characters');
  }
  return displayName;
}

export function parseAdminEmails(value: string | undefined): Set<string> {
  const emails = new Set<string>();
  for (const candidate of value?.split(',') ?? []) {
    if (!candidate.trim()) continue;
    emails.add(normalizeEmail(candidate));
  }
  return emails;
}

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || code === 0x7f;
  });
}
