import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'bun:test';

import { commitAll, getFileDiff, getWorkingTreeChanges, git, scopedCommit } from './git-worker';

// Real temp repos (task 0110): git is the source of truth, so we exercise the
// actual CLI rather than mock it. Each test gets a fresh throwaway repo.
const cleanups: string[] = [];
afterEach(async () => {
  while (cleanups.length > 0) {
    const dir = cleanups.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

async function initRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'sd-git-worker-'));
  cleanups.push(dir);
  await git(['init', '-b', 'main'], { cwd: dir });
  await git(['config', 'user.email', 'test@example.com'], { cwd: dir });
  await git(['config', 'user.name', 'Test'], { cwd: dir });
  await git(['config', 'commit.gpgsign', 'false'], { cwd: dir });
  return dir;
}

async function write(dir: string, rel: string, contents: string): Promise<void> {
  await writeFile(join(dir, rel), contents, 'utf8');
}

async function status(dir: string): Promise<string> {
  return (await git(['status', '--porcelain=v2', '-z'], { cwd: dir })).stdout;
}

test('getWorkingTreeChanges reports every kind fresh from git', async () => {
  const dir = await initRepo();
  await write(dir, 'a.ts', 'export const a = 1;\n');
  await write(dir, 'gone.ts', 'export const gone = 1;\n');
  await write(dir, 'old.ts', 'export const old = 1;\n');
  await git(['add', '-A'], { cwd: dir });
  await git(['commit', '-m', 'init'], { cwd: dir });

  await write(dir, 'a.ts', 'export const a = 2;\n'); // modified
  await write(dir, 'new.ts', 'export const n = 1;\n'); // untracked
  await git(['rm', '--quiet', 'gone.ts'], { cwd: dir }); // deleted (staged)
  await git(['mv', 'old.ts', 'renamed.ts'], { cwd: dir }); // renamed (staged)

  const changes = await getWorkingTreeChanges(dir);
  const byPath = new Map(changes.map((c) => [c.path, c]));

  expect(byPath.get('a.ts')?.kind).toBe('modified');
  expect(byPath.get('new.ts')?.kind).toBe('untracked');
  expect(byPath.get('new.ts')?.staged).toBe(false);
  expect(byPath.get('gone.ts')?.kind).toBe('deleted');
  const renamed = byPath.get('renamed.ts');
  expect(renamed?.kind).toBe('renamed');
  expect(renamed?.origPath).toBe('old.ts');
});

test('scopedCommit commits only the selected paths (incl. untracked), leaves the rest', async () => {
  const dir = await initRepo();
  await write(dir, 'a.ts', 'a\n');
  await write(dir, 'b.ts', 'b\n');
  await git(['add', '-A'], { cwd: dir });
  await git(['commit', '-m', 'init'], { cwd: dir });

  await write(dir, 'a.ts', 'a2\n'); // modified, selected
  await write(dir, 'b.ts', 'b2\n'); // modified, NOT selected
  await write(dir, 'c.ts', 'c\n'); // untracked, selected

  const result = await scopedCommit(dir, ['a.ts', 'c.ts'], 'commit subset');
  expect(result.committed).toBe(true);

  const remaining = await getWorkingTreeChanges(dir);
  const paths = remaining.map((c) => c.path);
  // b.ts stays dirty; a.ts and c.ts are committed and gone from the worktree.
  expect(paths).toEqual(['b.ts']);
  expect(remaining[0]?.kind).toBe('modified');
});

test('scopedCommit records a sanitized human author and keeps the server committer', async () => {
  const dir = await initRepo();
  await write(dir, 'human.ts', 'export const human = true;\n');

  const result = await scopedCommit(dir, ['human.ts'], 'human-authored change', {
    name: '  Ada <Root>\nLovelace  ',
    email: '  ADA@Example.com  ',
  });

  expect(result.committed).toBe(true);
  const identity = (
    await git(['log', '-1', '--format=%an%x1f%ae%x1f%cn%x1f%ce'], { cwd: dir })
  ).stdout
    .trim()
    .split('\x1f');
  expect(identity).toEqual(['Ada Root Lovelace', 'ada@example.com', 'Test', 'test@example.com']);
});

test('scopedCommit without an author keeps the legacy server identity', async () => {
  const dir = await initRepo();
  await write(dir, 'local.ts', 'export const local = true;\n');

  await scopedCommit(dir, ['local.ts'], 'legacy local change');

  const identity = (
    await git(['log', '-1', '--format=%an%x1f%ae%x1f%cn%x1f%ce'], { cwd: dir })
  ).stdout
    .trim()
    .split('\x1f');
  expect(identity).toEqual(['Test', 'test@example.com', 'Test', 'test@example.com']);
});

test('commitAll accepts the same human author contract', async () => {
  const dir = await initRepo();
  await write(dir, 'all.ts', 'export const all = true;\n');

  await commitAll(dir, 'commit everything', {
    name: 'Grace Hopper',
    email: 'grace@example.com',
  });

  const identity = (
    await git(['log', '-1', '--format=%an%x1f%ae%x1f%cn%x1f%ce'], { cwd: dir })
  ).stdout
    .trim()
    .split('\x1f');
  expect(identity).toEqual(['Grace Hopper', 'grace@example.com', 'Test', 'test@example.com']);
});

test('scopedCommit pathspecs can include both sides of a rename', async () => {
  const dir = await initRepo();
  await write(dir, 'old.ts', 'old\n');
  await git(['add', '-A'], { cwd: dir });
  await git(['commit', '-m', 'init'], { cwd: dir });

  await git(['mv', 'old.ts', 'renamed.ts'], { cwd: dir });

  const result = await scopedCommit(dir, ['old.ts', 'renamed.ts'], 'rename file');
  expect(result.committed).toBe(true);

  const remaining = await getWorkingTreeChanges(dir);
  expect(remaining).toEqual([]);
  const tree = (await git(['ls-tree', '--name-only', 'HEAD'], { cwd: dir })).stdout
    .split('\n')
    .filter(Boolean);
  expect(tree).toEqual(['renamed.ts']);
});

test('getFileDiff shows an untracked file as added lines without touching the index', async () => {
  const dir = await initRepo();
  await write(dir, 'a.ts', 'a\n');
  await git(['add', '-A'], { cwd: dir });
  await git(['commit', '-m', 'init'], { cwd: dir });

  await write(dir, 'fresh.ts', 'line one\nline two\n'); // untracked

  const before = await status(dir);
  const diff = await getFileDiff(dir, { path: 'fresh.ts' });
  const after = await status(dir);

  expect(diff.patch).toBeTruthy();
  expect(diff.patch).toContain('+line one');
  expect(diff.patch).toContain('+line two');
  // Rule D4.34 / A4: reading a diff must never stage anything.
  expect(after).toBe(before);
});

test('getFileDiff rejects absolute paths before the no-index fallback can read them', async () => {
  const dir = await initRepo();

  await expect(getFileDiff(dir, { path: '/etc/hosts' })).rejects.toThrow(/repo-relative path/i);
});

test('getFileDiff with base HEAD previews staged and unstaged hunks together', async () => {
  const dir = await initRepo();
  await write(dir, 'a.ts', 'one\n');
  await git(['add', '-A'], { cwd: dir });
  await git(['commit', '-m', 'init'], { cwd: dir });

  await write(dir, 'a.ts', 'one\ntwo\n');
  await git(['add', 'a.ts'], { cwd: dir });
  await write(dir, 'a.ts', 'one\ntwo\nthree\n');

  const diff = await getFileDiff(dir, { base: 'HEAD', path: 'a.ts' });
  expect(diff.patch).toContain('+two');
  expect(diff.patch).toContain('+three');
});

test('scopedCommit with no real change reports not committed', async () => {
  const dir = await initRepo();
  await write(dir, 'a.ts', 'a\n');
  await git(['add', '-A'], { cwd: dir });
  await git(['commit', '-m', 'init'], { cwd: dir });

  const result = await scopedCommit(dir, ['a.ts'], 'noop');
  expect(result.committed).toBe(false);
});
