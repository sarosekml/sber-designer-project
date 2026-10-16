import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import type { AdminTrashEntry, AdminUser } from '@/lib/api/admin';

import { UserTrashSection } from './UserTrashSection';

test('admin trash exposes risk, restore, purge, and manual-retention copy', () => {
  const users: AdminUser[] = [
    {
      id: 'target-user',
      email: 'target@example.com',
      displayName: 'Target User',
      role: 'member',
      status: 'active',
      mustChangePassword: false,
      createdAt: '2026-07-10T12:00:00.000Z',
      updatedAt: '2026-07-10T12:00:00.000Z',
      lastLoginAt: null,
    },
  ];
  const entries: AdminTrashEntry[] = [
    {
      version: 1,
      entryId: 'trash-owner-user',
      user: {
        id: 'owner-user',
        email: 'owner@example.com',
        displayName: 'Owner User',
      },
      deletedAt: '2026-07-10T12:00:00.000Z',
      deletedBy: 'admin@example.com',
      projects: [
        {
          id: 'project-1',
          name: 'Unpushed prototype',
          folder: 'unpushed-prototype',
          originalWorkspacePath: '/projects/owner-user/unpushed-prototype',
          sizeBytes: 2048,
          hasRemote: false,
          uncommitted: true,
          unpushedCommits: 1,
          notPushedAnywhere: true,
        },
      ],
      totalBytes: 2048,
      riskyProjects: 1,
      userDataMoved: true,
    },
  ];

  const html = renderToStaticMarkup(
    <UserTrashSection
      entries={entries}
      users={users}
      onEntriesChange={() => undefined}
      onError={() => undefined}
    />,
  );

  expect(html).toContain('Trash is never cleared automatically.');
  expect(html).toContain('1 not pushed anywhere');
  expect(html).toContain('No remote');
  expect(html).toContain('Uncommitted');
  expect(html).toContain('1 unpushed');
  expect(html).toContain('Restore to user…');
  expect(html).toContain('Purge entry');
});
