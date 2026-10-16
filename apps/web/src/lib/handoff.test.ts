import { expect, test } from 'bun:test';
import type { HostApp } from '@sber-designer/shared-types';

import {
  HANDOFF_PREFERRED_APP_STORAGE_KEY,
  fallbackHostApp,
  readPreferredHostApp,
  resolvePrimaryHostApp,
  splitHostApps,
  writePreferredHostApp,
} from './handoff';

const apps: HostApp[] = [
  { id: 'cursor', label: 'Cursor', kind: 'editor', available: false },
  { id: 'vscode', label: 'VS Code', kind: 'editor', available: true },
  { id: 'finder', label: 'Finder', kind: 'file-manager', available: true },
];

test('preferred host app is used only when available', () => {
  expect(resolvePrimaryHostApp(apps, 'finder')?.id).toBe('finder');
  expect(resolvePrimaryHostApp(apps, 'cursor')?.id).toBe('vscode');
  expect(
    resolvePrimaryHostApp(
      apps.map((app) => ({ ...app, available: false })),
      null,
    ),
  ).toBeNull();
});

test('host apps split into installed and not installed groups', () => {
  expect(splitHostApps(apps).installed.map((app) => app.id)).toEqual(['vscode', 'finder']);
  expect(splitHostApps(apps).notInstalled.map((app) => app.id)).toEqual(['cursor']);
});

test('fallback follows the host platform', () => {
  expect(fallbackHostApp('darwin').id).toBe('finder');
  expect(fallbackHostApp('win32').id).toBe('explorer');
  expect(fallbackHostApp('linux').id).toBe('file-manager');
});

test('preferred app storage validates ids and tolerates storage failures', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  writePreferredHostApp('zed', storage);
  expect(values.get(HANDOFF_PREFERRED_APP_STORAGE_KEY)).toBe('zed');
  expect(readPreferredHostApp(storage)).toBe('zed');
  values.set(HANDOFF_PREFERRED_APP_STORAGE_KEY, 'unknown');
  expect(readPreferredHostApp(storage)).toBeNull();
  expect(
    readPreferredHostApp({
      getItem: () => {
        throw new Error('blocked');
      },
    }),
  ).toBeNull();
});
