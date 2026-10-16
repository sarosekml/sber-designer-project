import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { Hono } from 'hono';

import { sendPr as agentSendPr } from '../services/api/src/agent/tools/delivery';
import { git } from '../services/api/src/git/git-worker';
import { saveProject } from '../services/api/src/project-store';
import { gitRouter } from '../services/api/src/routes/git';
import { patchState } from '../services/api/src/state-store';

test('git status route reports non-git workspace without throwing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-git-route-nonrepo-'));
  patchState({ workspacePath: root });

  const response = await gitRouter.request('http://localhost/status');
  const body = (await response.json()) as { isGitRepo: boolean; reason: string };

  expect(response.status).toBe(200);
  expect(body.isGitRepo).toBe(false);
  expect(body.reason).toContain('not a Git repository');
});

test('status v2 lists every change fresh from git with kinds/counts and no ownership', async () => {
  // Regression for the epic bug: no markOwnedPath / no in-memory state — the
  // changes appear purely because git is the source of truth (survives restart).
  const root = await createTempRepo();
  patchState({ workspacePath: root });
  await writeFile(join(root, 'README.md'), '# Test\nchanged\n', 'utf8'); // modified (tracked)
  await writeFile(join(root, 'new.ts'), 'n\n', 'utf8'); // untracked
  await writeFile(join(root, 'staged.ts'), 's\n', 'utf8');
  await git(['add', 'staged.ts'], { cwd: root }); // staged add

  const response = await gitRouter.request('http://localhost/status');
  const body = (await response.json()) as {
    changes: { path: string; kind: string; staged: boolean; ownedByDesigner?: unknown }[];
    counts: Record<string, number>;
  };

  expect(body.counts.total).toBe(3);
  expect(body.counts.untracked).toBe(1);
  expect(body.counts.conflicted).toBe(0);
  // The ownership split is gone entirely.
  expect('ownedChanged' in body.counts).toBe(false);
  const byPath = new Map(body.changes.map((c) => [c.path, c]));
  expect(byPath.get('README.md')?.kind).toBe('modified');
  expect(byPath.get('new.ts')).toMatchObject({ kind: 'untracked', staged: false });
  expect(byPath.get('staged.ts')).toMatchObject({ kind: 'added', staged: true });
  expect(body.changes.every((c) => !('ownedByDesigner' in c))).toBe(true);
});

test('branch create route persists a git session without resetting existing branches', async () => {
  const root = await createTempRepo();
  patchState({ workspacePath: root });
  await saveBaseProject(root);

  const response = await gitRouter.request('http://localhost/branch/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ branch: 'Add Work Screen' }),
  });
  const body = (await response.json()) as {
    branch: string;
    session: { workingBranch: string; baseBranch: string };
  };

  expect(response.status).toBe(200);
  expect(body.branch).toBe('add-work-screen');
  expect(body.session).toMatchObject({ workingBranch: 'add-work-screen', baseBranch: 'main' });

  const second = await gitRouter.request('http://localhost/branch/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ branch: 'Add Work Screen' }),
  });
  expect(second.status).toBe(422);
});

test('send-pr cuts an sd/ branch off the base and commits only the selected paths', async () => {
  const root = await createTempRepoWithRemote();
  patchState({ workspacePath: root });
  await saveBaseProject(root);
  await writeFile(join(root, 'picked.ts'), 'picked\n', 'utf8');
  await writeFile(join(root, 'left.ts'), 'left\n', 'utf8');

  const response = await gitRouter.request('http://localhost/send-pr', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ paths: ['picked.ts'], title: 'Add picked', message: 'Add picked' }),
  });
  const body = (await response.json()) as {
    ok: boolean;
    branch: string;
    committed: boolean;
    status: { changes: { path: string }[]; currentBranch: string };
  };

  expect(response.status).toBe(200);
  expect(body.committed).toBe(true);
  expect(body.branch.startsWith('sd/')).toBe(true);
  expect(body.status.currentBranch).toBe(body.branch);
  // picked.ts was committed and left the working tree; left.ts is untouched.
  const paths = body.status.changes.map((c) => c.path);
  expect(paths).toContain('left.ts');
  expect(paths).not.toContain('picked.ts');
});

test('send-pr attributes the commit to the password-session user', async () => {
  const root = await createTempRepoWithRemote();
  patchState({ workspacePath: root });
  await saveBaseProject(root);
  await writeFile(join(root, 'session-user.ts'), 'session user\n', 'utf8');
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('user', 'ada@example.com');
    c.set('sessionUser', {
      id: 'u_ada',
      email: 'ada@example.com',
      displayName: 'Ada Lovelace',
      role: 'member',
      mustChangePassword: false,
    });
    await next();
  });
  app.route('/', gitRouter);

  const response = await app.request('http://localhost/send-pr', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      paths: ['session-user.ts'],
      title: 'Attribute session user',
      message: 'Attribute session user',
    }),
  });

  expect(response.status).toBe(200);
  expect(await readHeadIdentity(root)).toEqual([
    'Ada Lovelace',
    'ada@example.com',
    'sber-designer test',
    'test@sber-designer.local',
  ]);
});

test('agent send_pr attributes the commit to the run initiator', async () => {
  const root = await createTempRepoWithRemote();
  patchState({ workspacePath: root });
  await saveBaseProject(root);
  await writeFile(join(root, 'agent-user.ts'), 'agent user\n', 'utf8');

  await agentSendPr.handler(
    {
      title: 'Attribute agent initiator',
      body: '',
      branch: 'sd/agent-attribution',
      paths: ['agent-user.ts'],
      pushOnly: true,
    },
    {
      user: 'grace@example.com',
      userDisplayName: 'Grace Hopper',
      workspacePath: root,
      canvasUrl: null,
    },
  );

  expect(await readHeadIdentity(root)).toEqual([
    'Grace Hopper',
    'grace@example.com',
    'sber-designer test',
    'test@sber-designer.local',
  ]);
});

test('git status route reports counts.total/untracked/conflicted', async () => {
  const root = await createTempRepo();
  patchState({ workspacePath: root });
  await writeFile(join(root, 'a.ts'), 'a\n', 'utf8');
  await writeFile(join(root, 'b.ts'), 'b\n', 'utf8');

  const response = await gitRouter.request('http://localhost/status');
  const body = (await response.json()) as {
    counts: { total: number; untracked: number; conflicted: number };
  };

  expect(body.counts.total).toBe(2);
  expect(body.counts.untracked).toBe(2);
  expect(body.counts.conflicted).toBe(0);
});

test('git graph route returns commits and branches', async () => {
  const root = await createTempRepo();
  patchState({ workspacePath: root });
  await writeFile(join(root, 'a.ts'), 'a\n', 'utf8');
  await git(['add', 'a.ts'], { cwd: root });
  await git(['commit', '-m', 'second'], { cwd: root });

  const response = await gitRouter.request('http://localhost/graph?all=true&limit=50');
  const body = (await response.json()) as {
    ok: boolean;
    commits: { subject: string }[];
    branches: { name: string }[];
    currentBranch: string;
  };

  expect(response.status).toBe(200);
  expect(body.commits).toHaveLength(2);
  expect(body.currentBranch).toBe('main');
  expect(body.branches.some((b) => b.name === 'main')).toBe(true);
});

test('git branches route lists local branches', async () => {
  const root = await createTempRepo();
  patchState({ workspacePath: root });

  const response = await gitRouter.request('http://localhost/branches');
  const body = (await response.json()) as { branches: { name: string }[] };

  expect(response.status).toBe(200);
  expect(body.branches.some((b) => b.name === 'main')).toBe(true);
});

test('git diff route returns changed files and a patch', async () => {
  const root = await createTempRepo();
  patchState({ workspacePath: root });
  await writeFile(join(root, 'README.md'), '# Test\nmore\n', 'utf8');

  const response = await gitRouter.request('http://localhost/diff?path=README.md');
  const body = (await response.json()) as { files: { path: string }[]; patch?: string };

  expect(response.status).toBe(200);
  expect(body.files.some((f) => f.path === 'README.md')).toBe(true);
  expect(body.patch).toContain('more');
});

test('git diff route serves an untracked file without touching the index', async () => {
  const root = await createTempRepo();
  patchState({ workspacePath: root });
  await writeFile(join(root, 'fresh.ts'), 'brand new\n', 'utf8');

  const before = (await git(['status', '--porcelain'], { cwd: root })).stdout;
  const response = await gitRouter.request('http://localhost/diff?path=fresh.ts');
  const body = (await response.json()) as { patch?: string };
  const after = (await git(['status', '--porcelain'], { cwd: root })).stdout;

  expect(response.status).toBe(200);
  expect(body.patch).toContain('+brand new');
  expect(after).toBe(before);
});

test('git diff route rejects paths outside the repository', async () => {
  const root = await createTempRepo();
  patchState({ workspacePath: root });

  const absolute = await gitRouter.request(
    `http://localhost/diff?path=${encodeURIComponent('/etc/hosts')}`,
  );
  const parent = await gitRouter.request(
    `http://localhost/diff?path=${encodeURIComponent('../secret.txt')}`,
  );

  expect(absolute.status).toBe(400);
  expect(parent.status).toBe(400);
});

test('git commit rejects stale paths not present in current changes', async () => {
  const root = await createTempRepo();
  patchState({ workspacePath: root });
  await writeFile(join(root, 'README.md'), '# Test\nmore\n', 'utf8');

  const response = await gitRouter.request('http://localhost/commit', {
    method: 'POST',
    body: JSON.stringify({ message: 'selected stale path', paths: ['src/missing.ts'] }),
    headers: { 'content-type': 'application/json' },
  });
  const body = (await response.json()) as { error: string; detail: string };

  expect(response.status).toBe(400);
  expect(body.error).toBe('git_error');
  expect(body.detail).toContain('Selected paths are not changed');
});

test('git commit of a selected rename includes both old and new paths', async () => {
  const root = await createTempRepo();
  patchState({ workspacePath: root });
  await writeFile(join(root, 'old.ts'), 'old\n', 'utf8');
  await git(['add', 'old.ts'], { cwd: root });
  await git(['commit', '-m', 'add old'], { cwd: root });
  await git(['mv', 'old.ts', 'renamed.ts'], { cwd: root });

  const response = await gitRouter.request('http://localhost/commit', {
    method: 'POST',
    body: JSON.stringify({ message: 'rename old', paths: ['renamed.ts'] }),
    headers: { 'content-type': 'application/json' },
  });
  const body = (await response.json()) as {
    status: { changes: { path: string }[] };
    paths: string[];
  };

  expect(response.status).toBe(200);
  expect(body.paths).toEqual(['renamed.ts']);
  expect(body.status.changes).toEqual([]);
  const tree = (await git(['ls-tree', '--name-only', 'HEAD'], { cwd: root })).stdout
    .split('\n')
    .filter(Boolean);
  expect(tree).toContain('renamed.ts');
  expect(tree).not.toContain('old.ts');
});

test('git commit rejects conflicted paths', async () => {
  const root = await createTempRepo();
  patchState({ workspacePath: root });
  await git(['checkout', '-b', 'left'], { cwd: root });
  await writeFile(join(root, 'README.md'), '# Test\nleft\n', 'utf8');
  await git(['commit', '-am', 'left'], { cwd: root });
  await git(['checkout', 'main'], { cwd: root });
  await writeFile(join(root, 'README.md'), '# Test\nright\n', 'utf8');
  await git(['commit', '-am', 'right'], { cwd: root });
  await git(['merge', 'left'], { cwd: root });

  const response = await gitRouter.request('http://localhost/commit', {
    method: 'POST',
    body: JSON.stringify({ message: 'commit conflict', paths: ['README.md'] }),
    headers: { 'content-type': 'application/json' },
  });
  const body = (await response.json()) as { detail: string };

  expect(response.status).toBe(400);
  expect(body.detail).toContain('Resolve conflicts');
});

test('branch checkout route switches to an existing branch without resetting it', async () => {
  const root = await createTempRepo();
  patchState({ workspacePath: root });
  await saveBaseProject(root);
  await git(['checkout', '-b', 'feature/existing'], { cwd: root });
  await writeFile(join(root, 'feature.ts'), 'feature\n', 'utf8');
  await git(['add', 'feature.ts'], { cwd: root });
  await git(['commit', '-m', 'feature work'], { cwd: root });
  await git(['checkout', 'main'], { cwd: root });

  const response = await gitRouter.request('http://localhost/branch/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ branch: 'feature/existing' }),
  });
  const body = (await response.json()) as { status: { currentBranch: string } };

  expect(response.status).toBe(200);
  expect(body.status.currentBranch).toBe('feature/existing');
  const tree = (await git(['ls-tree', '--name-only', 'HEAD'], { cwd: root })).stdout;
  expect(tree).toContain('feature.ts');
});

test('git push refuses to push a protected base branch directly', async () => {
  const root = await createTempRepoWithRemote();
  patchState({ workspacePath: root });
  await saveBaseProject(root);
  await writeFile(join(root, 'README.md'), '# Test\nchange\n', 'utf8');
  await git(['commit', '-am', 'direct main'], { cwd: root });

  const response = await gitRouter.request('http://localhost/push', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  const body = (await response.json()) as { detail: string };

  expect(response.status).toBe(400);
  expect(body.detail).toContain('Create or checkout a feature branch');
});

async function saveBaseProject(root: string): Promise<void> {
  await saveProject({ version: 1, name: 'Git route', workspacePath: root, screens: [], flow: [] });
}

async function createTempRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-git-route-repo-'));
  await git(['init', '-b', 'main'], { cwd: root });
  await git(['config', 'user.email', 'test@sber-designer.local'], { cwd: root });
  await git(['config', 'user.name', 'sber-designer test'], { cwd: root });
  await git(['config', 'commit.gpgsign', 'false'], { cwd: root });
  await mkdir(join(root, '.sber-designer'), { recursive: true });
  await writeFile(join(root, 'README.md'), '# Test\n', 'utf8');
  await git(['add', 'README.md'], { cwd: root });
  await git(['commit', '-m', 'initial'], { cwd: root });
  return root;
}

async function createTempRepoWithRemote(): Promise<string> {
  const root = await createTempRepo();
  const remote = await mkdtemp(join(tmpdir(), 'sd-git-route-remote-'));
  await git(['init', '--bare', '-b', 'main'], { cwd: remote });
  await git(['remote', 'add', 'origin', remote], { cwd: root });
  return root;
}

async function readHeadIdentity(root: string): Promise<string[]> {
  return (await git(['log', '-1', '--format=%an%x1f%ae%x1f%cn%x1f%ce'], { cwd: root })).stdout
    .trim()
    .split('\x1f');
}
