import { expect, test } from 'bun:test';

import type { AuthUser } from '@/lib/api/auth';

import {
  avatarColor,
  buildUserMenuModel,
  shouldShowUserAvatarMenu,
  userInitials,
} from './UserAvatarMenu';

const ADMIN: AuthUser = {
  id: 'user-admin',
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
  role: 'admin',
  mustChangePassword: false,
};

test('avatar initials prefer two display-name letters and fall back to email', () => {
  expect(userInitials(ADMIN)).toBe('AL');
  expect(userInitials({ displayName: 'Prince', email: 'prince@example.com' })).toBe('PR');
  expect(userInitials({ displayName: '', email: 'fallback@example.com' })).toBe('F');
});

test('avatar color is deterministic per user id', () => {
  expect(avatarColor('user-1')).toBe(avatarColor('user-1'));
  expect(avatarColor('user-1')).not.toBe(avatarColor('user-2'));
  expect(avatarColor('user-1')).toMatch(/^hsl\(\d+ 58% 46%\)$/u);
});

test('authenticated menu exposes the current user actions', () => {
  expect(buildUserMenuModel(ADMIN)).toMatchObject({
    title: 'Ada Lovelace',
    subtitle: 'ada@example.com',
    showProfile: true,
    showLogout: true,
  });
});

test('identity block is absent locally and requires a current server user', () => {
  expect(shouldShowUserAvatarMenu('local', null)).toBe(false);
  expect(shouldShowUserAvatarMenu('anonymous', null)).toBe(false);
  expect(shouldShowUserAvatarMenu('authed', null)).toBe(false);
  expect(shouldShowUserAvatarMenu('authed', ADMIN)).toBe(true);
});
