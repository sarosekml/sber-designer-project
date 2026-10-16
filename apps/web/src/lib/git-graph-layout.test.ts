import { expect, test } from 'bun:test';

import type { GitCommitNode } from '@/lib/api/git';
import { layoutGraph } from './git-graph-layout';

function node(sha: string, parents: string[]): GitCommitNode {
  return {
    sha,
    parents,
    refs: [],
    author: 'tester',
    authorEmail: 'tester@example.com',
    date: '2026-01-01T00:00:00Z',
    subject: sha,
  };
}

test('linear history stays in a single column', () => {
  const layout = layoutGraph([node('c', ['b']), node('b', ['a']), node('a', [])]);
  expect(layout.cols).toEqual([0, 0, 0]);
  expect(layout.maxCol).toBe(0);
  expect(layout.edges).toHaveLength(2);
  expect(layout.edges.every((e) => e.kind === 'continue')).toBe(true);
});

test('a merge opens a second lane and records a merge edge', () => {
  const layout = layoutGraph([
    node('m', ['p1', 'p2']),
    node('p1', ['g']),
    node('p2', ['g']),
    node('g', []),
  ]);
  // m=0, p1 continues 0, p2 on new lane 1, g converges back to 0
  expect(layout.cols).toEqual([0, 0, 1, 0]);
  expect(layout.maxCol).toBe(1);
  const merges = layout.edges.filter((e) => e.kind === 'merge');
  expect(merges).toHaveLength(1);
  expect(merges[0]?.parent).toBe('p2');
  expect(layout.edges).toHaveLength(4);
});

test('empty history produces no columns or edges', () => {
  const layout = layoutGraph([]);
  expect(layout.cols).toEqual([]);
  expect(layout.edges).toEqual([]);
  expect(layout.maxCol).toBe(0);
});
