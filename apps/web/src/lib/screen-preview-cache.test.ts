import { describe, expect, test } from 'bun:test';
import {
  invalidateScreenPreview,
  promoteScreenPreview,
  pruneScreenPreviewCache,
  type ScreenPreviewCacheEntry,
} from './screen-preview-cache';

const entry = (screenId: string, revision = 0): ScreenPreviewCacheEntry => ({
  screenId,
  revision,
  url: `/preview/${screenId}`,
});

describe('screen preview cache', () => {
  test('keeps the active entry plus two warm entries in MRU order', () => {
    let cache = promoteScreenPreview([], entry('a'));
    cache = promoteScreenPreview(cache, entry('b'));
    cache = promoteScreenPreview(cache, entry('c'));
    cache = promoteScreenPreview(cache, entry('a'));
    expect(cache.map((item) => item.screenId)).toEqual(['a', 'c', 'b']);

    cache = promoteScreenPreview(cache, entry('d'));
    expect(cache.map((item) => item.screenId)).toEqual(['d', 'a', 'c']);
  });

  test('reduces warm capacity while the Flow overlay consumes a slot', () => {
    const cache = promoteScreenPreview([entry('b'), entry('a')], entry('c'), 1);
    expect(cache.map((item) => item.screenId)).toEqual(['c', 'b']);
  });

  test('evicts an invalidated or stale screen', () => {
    expect(invalidateScreenPreview([entry('a'), entry('b')], 'a')).toEqual([entry('b')]);
    expect(pruneScreenPreviewCache([entry('a'), entry('b')], ['a', 'b'], { a: 1 })).toEqual([
      entry('b'),
    ]);
  });
});
