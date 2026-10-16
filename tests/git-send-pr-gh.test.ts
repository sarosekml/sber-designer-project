import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'bun:test';

import { git, resetCliAvailabilityCache } from '../services/api/src/git/git-worker';
import { saveProject } from '../services/api/src/project-store';
import { gitRouter } from '../services/api/src/routes/git';
import { patchState } from '../services/api/src/state-store';

// A github-looking fetch URL makes provider detection pick GitHub (→ our mock
// `gh`), while a separate local bare pushurl keeps `git push` actually working.
const MOCK_BIN = join(import.meta.dir, 'mocks', 'bin');
const ORIGINAL_PATH = process.env.PATH ?? '';

afterEach(() => {
  process.env.PATH = ORIGINAL_PATH;
  delete process.env.GH_MOCK_PR_STATE;
  resetCliAvailabilityCache();
});

async function useMockGh() {
  process.env.PATH = `${MOCK_BIN}:${ORIGINAL_PATH}`;
  resetCliAvailabilityCache();
}

async function createTempRepoWithGitHubRemote(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-git-gh-repo-'));
  await git(['init', '-b', 'main'], { cwd: root });
  await git(['config', 'user.email', 'test@sber-designer.local'], { cwd: root });
  await git(['config', 'user.name', 'sber-designer test'], { cwd: root });
  await git(['config', 'commit.gpgsign', 'false'], { cwd: root });
  await mkdir(join(root, '.sber-designer'), { recursive: true });
  await writeFile(join(root, 'README.md'), '# Test\n', 'utf8');
  await git(['add', 'README.md'], { cwd: root });
  await git(['commit', '-m', 'initial'], { cwd: root });

  const remote = await mkdtemp(join(tmpdir(), 'sd-git-gh-remote-'));
  await git(['init', '--bare', '-b', 'main'], { cwd: remote });
  await git(['remote', 'add', 'origin', 'https://github.com/acme/demo.git'], { cwd: root });
  await git(['remote', 'set-url', '--push', 'origin', remote], { cwd: root });
  return root;
}

async function sendPr(body: Record<string, unknown>) {
  const response = await gitRouter.request('http://localhost/send-pr', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { response, body: (await response.json()) as Record<string, unknown> };
}

test('send-pr creates a PR the first time and updates the same PR on the second send', async () => {
  await useMockGh();
  const root = await createTempRepoWithGitHubRemote();
  patchState({ workspacePath: root });
  await saveProject({ version: 1, name: 'GH', workspacePath: root, screens: [], flow: [] });

  await writeFile(join(root, 'first.ts'), 'first\n', 'utf8');
  const first = await sendPr({ paths: ['first.ts'], title: 'First change' });
  expect(first.response.status).toBe(200);
  expect(first.body.provider).toBe('github');
  expect(first.body.prUrl).toBe('https://github.com/acme/demo/pull/7');
  const firstBranch = first.body.branch as string;
  expect(firstBranch.startsWith('sd/')).toBe(true);

  // Second change on the existing PR → same branch, same PR, no new sd/ branch.
  await writeFile(join(root, 'second.ts'), 'second\n', 'utf8');
  const second = await sendPr({ paths: ['second.ts'], title: 'Second change' });
  expect(second.response.status).toBe(200);
  expect(second.body.branch).toBe(firstBranch);
  expect(second.body.prUrl).toBe('https://github.com/acme/demo/pull/7');

  const sdBranches = (await git(['branch', '--list', 'sd/*'], { cwd: root })).stdout
    .split('\n')
    .filter((l) => l.trim().length > 0);
  expect(sdBranches).toHaveLength(1);
});

test('send-pr reuses the open PR branch when the user returned to main', async () => {
  await useMockGh();
  const root = await createTempRepoWithGitHubRemote();
  patchState({ workspacePath: root });
  await saveProject({ version: 1, name: 'GH', workspacePath: root, screens: [], flow: [] });

  await writeFile(join(root, 'first.ts'), 'first\n', 'utf8');
  const first = await sendPr({ paths: ['first.ts'], title: 'First change' });
  expect(first.response.status).toBe(200);
  const firstBranch = first.body.branch as string;

  await git(['checkout', 'main'], { cwd: root });
  await writeFile(join(root, 'second.ts'), 'second\n', 'utf8');
  const second = await sendPr({ paths: ['second.ts'], title: 'Second change' });

  expect(second.response.status).toBe(200);
  expect(second.body.branch).toBe(firstBranch);
  const current = (await git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root })).stdout.trim();
  expect(current).toBe(firstBranch);
  const sdBranches = (await git(['branch', '--list', 'sd/*'], { cwd: root })).stdout
    .split('\n')
    .filter((l) => l.trim().length > 0);
  expect(sdBranches).toHaveLength(1);
});

test('send-pr surfaces PR edit failures instead of silently claiming success', async () => {
  await useMockGh();
  const root = await createTempRepoWithGitHubRemote();
  patchState({ workspacePath: root });
  await saveProject({ version: 1, name: 'GH', workspacePath: root, screens: [], flow: [] });

  await writeFile(join(root, 'first.ts'), 'first\n', 'utf8');
  const first = await sendPr({ paths: ['first.ts'], title: 'First change' });
  expect(first.response.status).toBe(200);

  process.env.GH_MOCK_EDIT_FAIL = '1';
  await writeFile(join(root, 'second.ts'), 'second\n', 'utf8');
  const second = await sendPr({ paths: ['second.ts'], title: 'Second change' });

  expect(second.response.status).toBe(422);
  expect(String(second.body.detail)).toContain('gh pr edit failed');
});

test('status?refreshPr=true flips the session to Merged when the PR merged elsewhere', async () => {
  await useMockGh();
  const root = await createTempRepoWithGitHubRemote();
  patchState({ workspacePath: root });
  await saveProject({ version: 1, name: 'GH', workspacePath: root, screens: [], flow: [] });

  await writeFile(join(root, 'first.ts'), 'first\n', 'utf8');
  const first = await sendPr({ paths: ['first.ts'], title: 'First change' });
  expect((first.body.session as { status?: string }).status).toBe('review-open');

  // The PR is merged on GitHub; a focus refresh must reflect it without restart.
  process.env.GH_MOCK_PR_STATE = 'MERGED';
  const response = await gitRouter.request('http://localhost/status?refreshPr=true');
  const body = (await response.json()) as { session: { status: string } | null };
  expect(body.session?.status).toBe('merged');
});
