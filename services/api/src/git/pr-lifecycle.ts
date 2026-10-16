/**
 * PR/MR + gitSession lifecycle (task 0110), extracted from routes/git.ts to
 * keep the route module a thin HTTP layer. gitSession is only a PR cache — it
 * never sources dirty state (that always comes fresh from git).
 *
 * One-directional deps: git-worker + project-store only. `buildStatus` and
 * `runSendPr` stay in routes/git.ts and import from here.
 */
import type { ProjectGitSession } from '@sber-designer/shared-types';

import { getProject, saveProject } from '../project-store';
import {
  buildCompareUrl,
  createAndCheckoutBranch,
  detectRemote,
  getCurrentBranch,
  getRemoteUrl,
  gh,
  ghAvailable,
  ghCreatePr,
  glab,
  glabAvailable,
  glabCreateMr,
  hasBranch,
  parseRemoteUrl,
  type GitProvider,
} from './git-worker';

type GitSessionPatch = Omit<
  Partial<ProjectGitSession>,
  'prUrl' | 'compareUrl' | 'prNumber' | 'commitSha' | 'pushedAt' | 'autoPush'
> & {
  prUrl?: string | null;
  compareUrl?: string | null;
  prNumber?: string | null;
  commitSha?: string | null;
  pushedAt?: number | null;
  autoPush?: boolean | null;
};

// ---------- working branch ------------------------------------------------

/** Cut and check out a unique `sd/<slug>` branch off the base (task 0110 A6). */
export async function createWorkingBranch(
  workspaceRoot: string,
  seed: string,
  baseBranch: string,
): Promise<string> {
  const base = `sd/${branchSlug(seed)}`;
  let candidate = base;
  let n = 2;
  while (await hasBranch(workspaceRoot, candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return createAndCheckoutBranch(workspaceRoot, candidate, baseBranch);
}

/** Slugify a title/message into the branch tail; always valid for git refnames. */
function branchSlug(seed: string): string {
  const slug = seed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return slug || timestampSlug();
}

export function timestampSlug(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').replace(/T/, '-').replace(/Z$/, '');
}

// ---------- open / update / refresh PR ------------------------------------

export interface OpenPrOptions {
  title: string;
  body: string;
  headBranch: string;
  baseBranch: string;
  draft?: boolean;
}

export interface OpenPrResult {
  prUrl: string | null;
  prNumber?: string;
  compareUrl: string | null;
  note: string | null;
}

export async function openPullRequest(
  workspaceRoot: string,
  provider: GitProvider,
  opts: OpenPrOptions,
): Promise<OpenPrResult> {
  if (provider === 'github' && (await ghAvailable())) {
    const { url } = await ghCreatePr({ workspaceRoot, ...opts });
    return prCreated(url);
  }
  if (provider === 'gitlab' && (await glabAvailable())) {
    const { url } = await glabCreateMr({ workspaceRoot, ...opts });
    return prCreated(url);
  }
  const remote = await detectRemote(workspaceRoot).catch(() => null);
  const compareUrl = remote ? buildCompareUrl(remote, opts.headBranch, opts.baseBranch) : null;
  const note =
    provider === 'bitbucket'
      ? 'Bitbucket compare URL created. Open it to finish the pull request.'
      : 'Provider CLI is not available. Open the compare URL to finish the review.';
  return { prUrl: null, compareUrl, note };
}

/** Build an OpenPrResult from a freshly-created PR URL (omits absent PR number). */
function prCreated(url: string): OpenPrResult {
  const prNumber = prNumberFromUrl(url);
  return { prUrl: url, ...(prNumber ? { prNumber } : {}), compareUrl: null, note: null };
}

/** Update an existing PR's title/body when the user edits them on re-send. */
export async function updatePrMeta(
  workspaceRoot: string,
  provider: GitProvider,
  prNumber: string | undefined,
  title?: string,
  body?: string,
): Promise<void> {
  if (!prNumber) return;
  if (provider === 'github' && (await ghAvailable())) {
    const args = ['pr', 'edit', prNumber];
    if (title) args.push('--title', title);
    if (body) args.push('--body', body);
    const r = await gh(args, { cwd: workspaceRoot, timeoutMs: 60_000 });
    if (!r.ok) {
      throw new Error(
        `gh pr edit failed: ${r.stderr.trim() || r.stdout.trim() || `code ${r.code}`}`,
      );
    }
  } else if (provider === 'gitlab' && (await glabAvailable())) {
    const args = ['mr', 'update', prNumber];
    if (title) args.push('--title', title);
    if (body) args.push('--description', body);
    const r = await glab(args, { cwd: workspaceRoot, timeoutMs: 60_000 });
    if (!r.ok) {
      throw new Error(
        `glab mr update failed: ${r.stderr.trim() || r.stdout.trim() || `code ${r.code}`}`,
      );
    }
  }
}

/**
 * Refresh the cached PR status from the host (task 0110 A7). A PR merged or
 * closed elsewhere flips the session status; a deleted PR clears the cache.
 * GitHub only for now (matches the `gh` mock in tests); other hosts no-op.
 */
export async function refreshPrState(workspaceRoot: string): Promise<void> {
  const session = getProject().gitSession;
  if (!session?.prNumber || session.provider !== 'github') return;
  if (!(await ghAvailable())) return;
  const r = await gh(['pr', 'view', session.prNumber, '--json', 'state,url'], {
    cwd: workspaceRoot,
    timeoutMs: 30_000,
  });
  if (!r.ok) {
    // PR no longer exists on the host — drop the stale cache.
    await clearGitSession();
    return;
  }
  let state = '';
  try {
    state = String((JSON.parse(r.stdout) as { state?: string }).state ?? '').toUpperCase();
  } catch {
    return;
  }
  if (state === 'MERGED') {
    await updateGitSession(workspaceRoot, { status: 'merged', updatedAt: Date.now() });
  } else if (state === 'CLOSED') {
    await updateGitSession(workspaceRoot, { status: 'closed', updatedAt: Date.now() });
  }
}

export function autoPrBody(paths: string[]): string {
  const list = paths.map((path) => `- \`${path}\``).join('\n');
  return `Changes from sber-designer:\n\n${list}`;
}

function prNumberFromUrl(url: string): string | undefined {
  const m = /\/(?:pull|merge_requests|pull-requests|-\/merge_requests)\/(\d+)/.exec(url);
  return m?.[1];
}

// ---------- gitSession read/write -----------------------------------------

export async function upsertGitSession(
  workspaceRoot: string,
  patch: Pick<ProjectGitSession, 'baseBranch' | 'workingBranch'> & GitSessionPatch,
): Promise<ProjectGitSession> {
  const remote = patch.remote ?? 'origin';
  const remoteUrl = patch.remoteUrl ?? (await getRemoteUrl(workspaceRoot, remote)) ?? '';
  const provider = patch.provider ?? (remoteUrl ? parseRemoteUrl(remoteUrl).provider : 'unknown');
  const now = Date.now();
  const sessionPatch: GitSessionPatch = {
    ...patch,
    provider,
    remote,
    remoteUrl,
    status: patch.status ?? 'branch',
    createdAt: patch.createdAt ?? now,
    updatedAt: patch.updatedAt ?? now,
  };
  return updateGitSession(workspaceRoot, {
    ...sessionPatch,
    baseBranch: patch.baseBranch,
    workingBranch: patch.workingBranch,
  });
}

export async function updateGitSession(
  workspaceRoot: string,
  patch: GitSessionPatch,
): Promise<ProjectGitSession> {
  const project = getProject();
  const previous = project.gitSession;
  const now = Date.now();
  const prUrl = patch.prUrl === null ? undefined : (patch.prUrl ?? previous?.prUrl);
  const compareUrl =
    patch.compareUrl === null ? undefined : (patch.compareUrl ?? previous?.compareUrl);
  const prNumber = patch.prNumber === null ? undefined : (patch.prNumber ?? previous?.prNumber);
  const commitSha = patch.commitSha === null ? undefined : (patch.commitSha ?? previous?.commitSha);
  const pushedAt = patch.pushedAt === null ? undefined : (patch.pushedAt ?? previous?.pushedAt);
  const autoPush = patch.autoPush === null ? undefined : (patch.autoPush ?? previous?.autoPush);
  const session: ProjectGitSession = {
    provider: patch.provider ?? previous?.provider ?? 'unknown',
    remote: patch.remote ?? previous?.remote ?? 'origin',
    remoteUrl: patch.remoteUrl ?? previous?.remoteUrl ?? '',
    baseBranch: patch.baseBranch ?? previous?.baseBranch ?? (await getCurrentBranch(workspaceRoot)),
    workingBranch:
      patch.workingBranch ?? previous?.workingBranch ?? (await getCurrentBranch(workspaceRoot)),
    status: patch.status ?? previous?.status ?? 'branch',
    createdAt: patch.createdAt ?? previous?.createdAt ?? now,
    updatedAt: patch.updatedAt ?? now,
    ...(prUrl ? { prUrl } : {}),
    ...(compareUrl ? { compareUrl } : {}),
    ...(prNumber ? { prNumber } : {}),
    ...(commitSha ? { commitSha } : {}),
    ...(pushedAt ? { pushedAt } : {}),
    ...(autoPush !== undefined ? { autoPush } : {}),
  };
  await saveProject({ ...project, gitSession: session });
  return session;
}

/** Persist the project with the git session (PR cache) removed. */
export async function clearGitSession(): Promise<void> {
  const project = { ...getProject() };
  delete project.gitSession;
  await saveProject(project);
}
