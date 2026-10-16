import { mkdir, mkdtemp, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'bun:test';

import {
  buildCommitUrl,
  createAndCheckoutBranch,
  getCommitGraph,
  getDefaultBranch,
  getFileDiff,
  getGitTopLevel,
  getRemoteUrl,
  getWorkingTreeChanges,
  git,
  hasBranch,
  isGitRepo,
  listBranches,
  normalizeBranchName,
  parseCommitGraph,
  parseNumstat,
  parseRemoteUrl,
  scopedCommit,
} from '../services/api/src/git/git-worker';

test('git status primitives return non-git workspace without throwing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-git-nonrepo-'));

  expect(await isGitRepo(root)).toBe(false);
  expect(await getGitTopLevel(root)).toBeNull();
});

test('git worker detects repo boundary and dirty file state', async () => {
  const root = await createTempRepo();
  const nested = join(root, 'src');
  await mkdir(nested, { recursive: true });

  expect(await isGitRepo(root)).toBe(true);
  expect(await getGitTopLevel(nested)).toBe(await realpath(resolve(root)));

  await writeFile(join(root, 'src', 'screen.tsx'), 'export const screen = 1;\n', 'utf8');

  expect(await getWorkingTreeChanges(root)).toEqual([
    { path: 'src/screen.tsx', kind: 'untracked', staged: false },
  ]);
});

test('scopedCommit commits only requested paths', async () => {
  const root = await createTempRepo();
  await writeFile(join(root, 'owned.ts'), 'owned\n', 'utf8');
  await writeFile(join(root, 'external.ts'), 'external\n', 'utf8');

  const result = await scopedCommit(root, ['owned.ts'], 'commit owned');

  expect(result.committed).toBe(true);
  expect((await git(['status', '--porcelain'], { cwd: root })).stdout.trim()).toBe(
    '?? external.ts',
  );
});

test('createAndCheckoutBranch refuses to reset an existing branch', async () => {
  const root = await createTempRepo();
  await createAndCheckoutBranch(root, 'sd/test-branch');

  expect(await hasBranch(root, 'sd/test-branch')).toBe(true);
  await expect(createAndCheckoutBranch(root, 'sd/test-branch')).rejects.toThrow('already exists');
});

test('default branch and remote URL helpers use origin metadata', async () => {
  const root = await createTempRepo();
  await git(['remote', 'add', 'origin', 'git@github.com:acme/demo.git'], { cwd: root });
  await git(['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main'], {
    cwd: root,
  });

  expect(await getRemoteUrl(root)).toBe('git@github.com:acme/demo.git');
  expect(await getDefaultBranch(root)).toBe('main');
  expect(parseRemoteUrl('git@gitlab.example.com:team/subgroup/demo.git')).toEqual({
    provider: 'gitlab',
    ownerRepo: 'team/subgroup/demo',
    webOrigin: 'https://gitlab.example.com',
  });
});

test('branch names are normalized without allowing unsafe refs', () => {
  expect(normalizeBranchName('Add Deals Screen')).toBe('add-deals-screen');
  expect(() => normalizeBranchName('main..bad')).toThrow('Invalid branch name');
  expect(() => normalizeBranchName('/bad')).toThrow('Invalid branch name');
});

test('parseCommitGraph parses unit/record separated log output', () => {
  const raw =
    [
      [
        'sha1',
        'p1 p2',
        'HEAD -> main, origin/main',
        'Ann',
        'ann@x.io',
        '2026-01-01T00:00:00Z',
        'merge: thing',
      ].join('\x1f'),
      ['sha2', '', '', 'Bob', 'bob@x.io', '2026-01-02T00:00:00Z', 'init'].join('\x1f'),
    ].join('\x1e') + '\x1e';
  const nodes = parseCommitGraph(raw);
  expect(nodes).toHaveLength(2);
  expect(nodes[0]).toEqual({
    sha: 'sha1',
    parents: ['p1', 'p2'],
    refs: ['HEAD -> main', 'origin/main'],
    author: 'Ann',
    authorEmail: 'ann@x.io',
    date: '2026-01-01T00:00:00Z',
    subject: 'merge: thing',
  });
  expect(nodes[1]?.parents).toEqual([]);
  expect(nodes[1]?.refs).toEqual([]);
});

test('parseNumstat parses additions/deletions and the binary marker', () => {
  const entries = parseNumstat('3\t1\tsrc/a.ts\n-\t-\tlogo.png\n');
  expect(entries[0]).toMatchObject({ path: 'src/a.ts', additions: 3, deletions: 1, binary: false });
  expect(entries[1]).toMatchObject({ path: 'logo.png', additions: 0, deletions: 0, binary: true });
});

test('parseNumstat preserves prefix and suffix for brace rename paths', () => {
  const entries = parseNumstat('2\t1\tsrc/screens/{OldName => NewName}.tsx\n');
  expect(entries[0]).toMatchObject({
    path: 'src/screens/NewName.tsx',
    additions: 2,
    deletions: 1,
  });
});

test('buildCommitUrl builds provider-specific commit URLs', () => {
  expect(buildCommitUrl(parseRemoteUrl('git@github.com:acme/demo.git'), 'abc123')).toBe(
    'https://github.com/acme/demo/commit/abc123',
  );
  expect(buildCommitUrl(parseRemoteUrl('https://gitlab.com/team/sub/demo.git'), 'def')).toBe(
    'https://gitlab.com/team/sub/demo/-/commit/def',
  );
});

test('getCommitGraph reads commits with parents from a repo', async () => {
  const root = await createTempRepo();
  await writeFile(join(root, 'a.ts'), 'a\n', 'utf8');
  await git(['add', 'a.ts'], { cwd: root });
  await git(['commit', '-m', 'second'], { cwd: root });

  const nodes = await getCommitGraph(root, { all: true, limit: 50 });
  expect(nodes).toHaveLength(2);
  expect(nodes[0]?.subject).toBe('second');
  expect(nodes[0]?.parents).toHaveLength(1);
  expect(nodes[1]?.subject).toBe('initial');
  expect(nodes[1]?.parents).toHaveLength(0);
});

test('listBranches reports the current branch', async () => {
  const root = await createTempRepo();
  await createAndCheckoutBranch(root, 'sd/feature');

  const branches = await listBranches(root);
  const names = branches.map((b) => b.name);
  expect(names).toContain('main');
  expect(names).toContain('sd/feature');
  expect(branches.find((b) => b.isCurrent)?.name).toBe('sd/feature');
});

test('getFileDiff returns numstat entries and a patch for a path', async () => {
  const root = await createTempRepo();
  await writeFile(join(root, 'README.md'), '# Test\nmore\n', 'utf8');

  const diff = await getFileDiff(root, { path: 'README.md' });
  expect(diff.files.find((f) => f.path === 'README.md')?.additions).toBeGreaterThan(0);
  expect(diff.patch).toContain('+more');
});

async function createTempRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-git-repo-'));
  await git(['init', '-b', 'main'], { cwd: root });
  await git(['config', 'user.email', 'test@sber-designer.local'], { cwd: root });
  await git(['config', 'user.name', 'sber-designer test'], { cwd: root });
  await writeFile(join(root, 'README.md'), '# Test\n', 'utf8');
  await git(['add', 'README.md'], { cwd: root });
  await git(['commit', '-m', 'initial'], { cwd: root });
  return root;
}
