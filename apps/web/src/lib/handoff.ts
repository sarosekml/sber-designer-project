import {
  HOST_APP_IDS,
  type HostApp,
  type HostAppId,
  type HostPlatform,
} from '@sber-designer/shared-types';

export const HANDOFF_PREFERRED_APP_STORAGE_KEY = 'sber-designer.handoff-preferred-app';

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isHostAppId(value: string | null | undefined): value is HostAppId {
  return typeof value === 'string' && (HOST_APP_IDS as readonly string[]).includes(value);
}

export function readPreferredHostApp(
  storage: StorageReader | null = browserStorage(),
): HostAppId | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(HANDOFF_PREFERRED_APP_STORAGE_KEY);
    return isHostAppId(value) ? value : null;
  } catch {
    return null;
  }
}

export function writePreferredHostApp(
  appId: HostAppId,
  storage: StorageWriter | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(HANDOFF_PREFERRED_APP_STORAGE_KEY, appId);
  } catch {
    // Local storage can be unavailable in hardened/private browser profiles.
  }
}

export function resolvePrimaryHostApp(
  apps: readonly HostApp[],
  preferredId: HostAppId | null,
): HostApp | null {
  return (
    apps.find((app) => app.available && app.id === preferredId) ??
    apps.find((app) => app.available) ??
    null
  );
}

export function splitHostApps(apps: readonly HostApp[]): {
  installed: HostApp[];
  notInstalled: HostApp[];
} {
  return {
    installed: apps.filter((app) => app.available),
    notInstalled: apps.filter((app) => !app.available),
  };
}

export function fallbackHostApp(platform: HostPlatform | 'unknown'): HostApp {
  if (platform === 'win32') {
    return { id: 'explorer', label: 'Explorer', kind: 'file-manager', available: false };
  }
  if (platform === 'linux') {
    return { id: 'file-manager', label: 'File Manager', kind: 'file-manager', available: false };
  }
  return { id: 'finder', label: 'Finder', kind: 'file-manager', available: false };
}
