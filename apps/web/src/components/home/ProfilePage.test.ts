import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

import { validateDisplayName } from './ProfilePage';

test('profile display-name validation follows the API 2–64 character policy', () => {
  expect(validateDisplayName('A')).toBe('Display name must be at least 2 characters.');
  expect(validateDisplayName('  Ada Lovelace  ')).toBeNull();
  expect(validateDisplayName('A'.repeat(65))).toBe('Display name must be 64 characters or fewer.');
});

test('profile page wires profile update and the shared password form', async () => {
  const source = await readFile('apps/web/src/components/home/ProfilePage.tsx', 'utf8');

  expect(source).toContain('await updateMe(cleanDisplayName)');
  expect(source).toContain('<PasswordChangeForm />');
  expect(source).toContain('Profile saved.');
  expect(source).toContain('title="Account"');
});
