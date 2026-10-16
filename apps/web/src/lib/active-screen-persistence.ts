const ACTIVE_SCREEN_STORAGE_PREFIX = 'sd.activeScreen:';

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;

export function activeScreenStorageKey(workspacePath: string): string {
  return `${ACTIVE_SCREEN_STORAGE_PREFIX}${encodeURIComponent(workspacePath.trim())}`;
}

export function readStoredActiveScreenId(
  workspacePath: string,
  availableScreenIds: readonly string[],
  storage: StorageReader | null = browserStorage(),
): string | null {
  if (!storage || !workspacePath.trim()) return null;
  try {
    const stored = storage.getItem(activeScreenStorageKey(workspacePath))?.trim();
    return stored && availableScreenIds.includes(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function writeStoredActiveScreenId(
  workspacePath: string,
  screenId: string,
  storage: StorageWriter | null = browserStorage(),
): void {
  if (!storage || !workspacePath.trim() || !screenId.trim()) return;
  try {
    storage.setItem(activeScreenStorageKey(workspacePath), screenId);
  } catch {
    // The current editor session remains usable when browser storage is unavailable.
  }
}

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
