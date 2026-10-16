import { expect, test } from 'bun:test';
import type { GitChange } from '@sber-designer/shared-types';

import { parsePorcelainV2 } from './porcelain';

// Fixtures use realistic mode/hash fields so the path-index math is exercised
// exactly as `git status --porcelain=v2 -z` emits it. `-z` NUL-terminates every
// record; type-2 (rename) emits the original path as its own trailing field.
const H = '0000000000000000000000000000000000000000';
const MODES = `100644 100644 100644 ${H} ${H}`;

function byPath(changes: GitChange[]): Map<string, GitChange> {
  return new Map(changes.map((c) => [c.path, c]));
}

test('parsePorcelainV2: ordinary modified, unstaged', () => {
  const [change] = parsePorcelainV2(`1 .M N... ${MODES} src/a.ts\0`);
  expect(change).toEqual({ path: 'src/a.ts', kind: 'modified', staged: false });
});

test('parsePorcelainV2: ordinary modified, staged', () => {
  const [change] = parsePorcelainV2(`1 M. N... ${MODES} src/b.ts\0`);
  expect(change).toEqual({ path: 'src/b.ts', kind: 'modified', staged: true });
});

test('parsePorcelainV2: added (staged)', () => {
  const [change] = parsePorcelainV2(`1 A. N... ${MODES} src/new.ts\0`);
  expect(change).toEqual({ path: 'src/new.ts', kind: 'added', staged: true });
});

test('parsePorcelainV2: deleted (worktree)', () => {
  const [change] = parsePorcelainV2(`1 .D N... ${MODES} src/gone.ts\0`);
  expect(change).toEqual({ path: 'src/gone.ts', kind: 'deleted', staged: false });
});

test('parsePorcelainV2: renamed carries origPath from the trailing field', () => {
  const [change] = parsePorcelainV2(`2 R. N... ${MODES} R100 src/new-name.ts\0src/old-name.ts\0`);
  expect(change).toEqual({
    path: 'src/new-name.ts',
    kind: 'renamed',
    staged: true,
    origPath: 'src/old-name.ts',
  });
});

test('parsePorcelainV2: untracked', () => {
  const [change] = parsePorcelainV2(`? src/untracked.ts\0`);
  expect(change).toEqual({ path: 'src/untracked.ts', kind: 'untracked', staged: false });
});

test('parsePorcelainV2: unmerged → conflicted', () => {
  // `u` carries 4 mode fields (m1 m2 m3 mW) + 3 hashes (h1 h2 h3) before path.
  const [change] = parsePorcelainV2(
    `u UU N... 100644 100644 100644 100644 ${H} ${H} ${H} src/conflict.ts\0`,
  );
  expect(change).toEqual({ path: 'src/conflict.ts', kind: 'conflicted', staged: true });
});

test('parsePorcelainV2: skips headers and ignored entries', () => {
  // Built by concatenation so each NUL is followed by a non-digit — a `\0`
  // immediately before a digit would be lexed as a legacy octal escape.
  const out =
    `# branch.oid ${H}\0` +
    `# branch.head main\0` +
    `! node_modules/x.js\0` +
    `1 .M N... ${MODES} src/a.ts\0`;
  const changes = parsePorcelainV2(out);
  expect(changes).toEqual([{ path: 'src/a.ts', kind: 'modified', staged: false }]);
});

test('parsePorcelainV2: paths with spaces and Cyrillic round-trip verbatim', () => {
  const out =
    `1 .M N... ${MODES} src/my file.ts\0` +
    `? docs/Заметки о дизайне.md\0` +
    `2 R. N... ${MODES} R100 src/новое имя.ts\0src/старое имя.ts\0`;
  const map = byPath(parsePorcelainV2(out));
  expect(map.get('src/my file.ts')?.kind).toBe('modified');
  expect(map.get('docs/Заметки о дизайне.md')?.kind).toBe('untracked');
  const renamed = map.get('src/новое имя.ts');
  expect(renamed?.kind).toBe('renamed');
  expect(renamed?.origPath).toBe('src/старое имя.ts');
});

test('parsePorcelainV2: empty output → no changes', () => {
  expect(parsePorcelainV2('')).toEqual([]);
});
