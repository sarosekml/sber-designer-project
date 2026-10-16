import { describe, expect, test } from 'bun:test';
import {
  appendScreenTab,
  nextActiveScreenTabId,
  pruneScreenTabIds,
  removeScreenTab,
} from './screen-tabs';

describe('screen tabs', () => {
  test('appends unique screen ids without changing their order', () => {
    expect(appendScreenTab(['a', 'b'], 'b')).toEqual(['a', 'b']);
    expect(appendScreenTab(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
  });

  test('does not impose a hard limit on tab metadata', () => {
    const ids = Array.from({ length: 20 }, (_, index) => `screen-${index + 1}`);
    const tabs = ids.reduce<string[]>((current, id) => appendScreenTab(current, id), []);
    expect(tabs).toEqual(ids);
  });

  test('chooses the right neighbor before the left neighbor', () => {
    expect(nextActiveScreenTabId(['a', 'b', 'c'], 'b')).toBe('c');
    expect(nextActiveScreenTabId(['a', 'b', 'c'], 'c')).toBe('b');
    expect(nextActiveScreenTabId(['a'], 'a')).toBeNull();
  });

  test('keeps the last tab and removes any other requested tab', () => {
    expect(removeScreenTab(['a'], 'a')).toEqual(['a']);
    expect(removeScreenTab(['a', 'b'], 'a')).toEqual(['b']);
  });

  test('prunes missing and duplicate ids', () => {
    expect(pruneScreenTabIds(['a', 'b', 'a', 'missing'], ['a', 'b', 'c'])).toEqual(['a', 'b']);
  });
});
