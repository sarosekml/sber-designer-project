import { expect, test } from 'bun:test';

import type { AdminUser } from '@/lib/api/admin';

import { toggleCliRuntime } from './SystemPage';
import { filterAdminUsers } from './UsersPage';

const USERS: AdminUser[] = [
  {
    id: 'u_admin',
    email: 'admin@example.com',
    displayName: 'Ada Admin',
    role: 'admin',
    status: 'active',
    mustChangePassword: false,
    createdAt: '2026-07-10T12:00:00.000Z',
    updatedAt: '2026-07-10T12:00:00.000Z',
    lastLoginAt: null,
  },
  {
    id: 'u_member',
    email: 'member@example.com',
    displayName: 'Marie Member',
    role: 'member',
    status: 'disabled',
    mustChangePassword: true,
    createdAt: '2026-07-10T12:00:00.000Z',
    updatedAt: '2026-07-10T12:00:00.000Z',
    lastLoginAt: null,
  },
];

test('user search matches identity, role, and status without case sensitivity', () => {
  expect(filterAdminUsers(USERS, 'ADA').map((user) => user.id)).toEqual(['u_admin']);
  expect(filterAdminUsers(USERS, 'disabled').map((user) => user.id)).toEqual(['u_member']);
  expect(filterAdminUsers(USERS, 'member@example').map((user) => user.id)).toEqual(['u_member']);
  expect(filterAdminUsers(USERS, '')).toEqual(USERS);
});

test('CLI runtime toggles preserve the remaining allowlist', () => {
  expect(toggleCliRuntime(['claude-code', 'codex'], 'codex')).toEqual(['claude-code']);
  expect(toggleCliRuntime(['codex'], 'opencode')).toEqual(['codex', 'opencode']);
});
