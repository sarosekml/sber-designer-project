import { expect, test } from 'bun:test';

import {
  activeScreenStorageKey,
  readStoredActiveScreenId,
  writeStoredActiveScreenId,
} from './active-screen-persistence';

test('active screen persistence is isolated by workspace and restores an existing screen', () => {
  const storage = new MemoryStorage();

  writeStoredActiveScreenId('/workspace/one', 'screen-b', storage);
  writeStoredActiveScreenId('/workspace/two', 'screen-c', storage);

  expect(readStoredActiveScreenId('/workspace/one', ['screen-a', 'screen-b'], storage)).toBe(
    'screen-b',
  );
  expect(readStoredActiveScreenId('/workspace/two', ['screen-c'], storage)).toBe('screen-c');
  expect(storage.getItem(activeScreenStorageKey('/workspace/one'))).toBe('screen-b');
});

test('active screen persistence ignores a screen removed from the project', () => {
  const storage = new MemoryStorage();
  writeStoredActiveScreenId('/workspace', 'deleted-screen', storage);

  expect(readStoredActiveScreenId('/workspace', ['current-screen'], storage)).toBeNull();
});

test('active screen persistence tolerates unavailable browser storage', () => {
  const storage = {
    getItem: () => {
      throw new Error('storage unavailable');
    },
    setItem: () => {
      throw new Error('storage unavailable');
    },
  };

  expect(readStoredActiveScreenId('/workspace', ['screen-a'], storage)).toBeNull();
  expect(() => writeStoredActiveScreenId('/workspace', 'screen-a', storage)).not.toThrow();
});

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
