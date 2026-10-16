/**
 * /api/git/* — working-tree status + PR/MR lifecycle (task 0110 v2).
 *
 * Git is the single source of truth: every response reads a fresh
 * `git status --porcelain=v2`, so a restart of this process changes nothing —
 * there is no editor-owned "who changed it" state (CLAUDE.md rule 11). The
 * Source Control panel commits exactly the paths it sends; `send-pr` is the one
 * button that branches, commits, pushes and opens/updates a PR.
 */
import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { GitChange, ProjectGitSession } from '@sber-designer/shared-types';

import { audit } from '../audit';
import { getSessionUser, getUser } from '../auth';
import {
  checkoutBranch,
  createAndCheckoutBranch,
  detectRemote,
  fetchRemote,
  getAheadBehind,
  getCommitGraph,
  getCurrentBranch,
  getDefaultBranch,
  getFileDiff,
  getGitTopLevel,
  getRemoteUrl,
  getWorkingTreeChanges,
  ghAvailable,
  git,
  glabAvailable,
  hasUncommitted,
  isGitRepo,
  listBranches,
  normalizeRepoRelativePath,
  parseRemoteUrl,
  pushBranch,
  scopedCommit,
  type GitCommitAuthor,
  type GitProvider,
} from '../git/git-worker';
import {
  autoPrBody,
  clearGitSession,
  createWorkingBranch,
  openPullRequest,
  refreshPrState,
  timestampSlug,
  updateGitSession,
  updatePrMeta,
  upsertGitSession,
} from '../git/pr-lifecycle';
import { getProject } from '../project-store';
import { getState } from '../state-store';

const WorkspaceInput = z.object({ workspacePath: z.string().optional() }).strict();

const BranchCreateInput = WorkspaceInput.extend({
  branch: z.string().min(1).optional(),
  baseBranch: z.string().min(1).optional(),
}).strict();

const BranchCheckoutInput = WorkspaceInput.extend({
  branch: z.string().min(1),
}).strict();

// task 0110 A5: commit exactly the selected paths; message is optional and
// auto-generated when blank. No `scope` — there is no ownership anymore.
const CommitInput = WorkspaceInput.extend({
  paths: z.array(z.string().min(1)).min(1),
  message: z.string().optional(),
}).strict();

// task 0110 A6: one button → branch + commit + push + create/update PR.
const SendPrInput = WorkspaceInput.extend({
  paths: z.array(z.string().min(1)).min(1),
  message: z.string().optional(),
  title: z.string().min(1).optional(),
  body: z.string().optional(),
  draft: z.boolean().optional(),
}).strict();

const SyncInput = WorkspaceInput.extend({
  syncToBase: z.boolean().default(false),
}).strict();

export const gitRouter = new Hono()
  .get('/status', async (c) => {
    const startedAt = Date.now();
    const user = getUser(c);
    const workspaceRoot = c.req.query('workspacePath') ?? getState().workspacePath;
    if (!workspaceRoot) {
      return c.json(emptyStatus({ reason: 'No active workspace. Connect a project first.' }));
    }
    try {
      // Web sends ?refreshPr=true on window-focus (throttled) to pick up a PR
      // merged/closed elsewhere without a restart (task 0110 A7).
      const refreshPr = c.req.query('refreshPr') === 'true';
      const status = await buildStatus(workspaceRoot, { refreshPr });
      audit({
        kind: 'config',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `git status repo=${status.isGitRepo} branch=${status.currentBranch ?? 'none'} changes=${status.counts.total}`,
      });
      return c.json(status);
    } catch (err) {
      return gitError(c, user, startedAt, 'git status', err);
    }
  })
  .get('/graph', async (c) => {
    const startedAt = Date.now();
    const user = getUser(c);
    try {
      const workspaceRoot = resolveWorkspace(c.req.query('workspacePath'));
      const resolved = await assertSupportedRepo(workspaceRoot);
      const limit = clampInt(c.req.query('limit'), 200, 1, 2000);
      const skip = clampInt(c.req.query('skip'), 0, 0, 1_000_000);
      const all = c.req.query('all') !== 'false';
      const commits = await getCommitGraph(resolved, { limit, skip, all });
      const branches = await listBranches(resolved).catch(() => []);
      const head = await revParse(resolved, 'HEAD').catch(() => null);
      const currentBranch = await getCurrentBranch(resolved).catch(() => null);
      audit({
        kind: 'config',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `git graph commits=${commits.length} all=${all}`,
      });
      return c.json({
        ok: true as const,
        commits,
        branches,
        head,
        currentBranch,
        hasMore: commits.length >= limit,
      });
    } catch (err) {
      return gitError(c, user, startedAt, 'git graph', err);
    }
  })
  .get('/branches', async (c) => {
    const startedAt = Date.now();
    const user = getUser(c);
    try {
      const workspaceRoot = resolveWorkspace(c.req.query('workspacePath'));
      const resolved = await assertSupportedRepo(workspaceRoot);
      const branches = await listBranches(resolved);
      audit({
        kind: 'config',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `git branches count=${branches.length}`,
      });
      return c.json({ ok: true as const, branches });
    } catch (err) {
      return gitError(c, user, startedAt, 'git branches', err);
    }
  })
  .get('/diff', async (c) => {
    const startedAt = Date.now();
    const user = getUser(c);
    try {
      const workspaceRoot = resolveWorkspace(c.req.query('workspacePath'));
      const resolved = await assertSupportedRepo(workspaceRoot);
      const base = c.req.query('base') || undefined;
      const head = c.req.query('head') || undefined;
      const path = c.req.query('path') || undefined;
      const origPath = c.req.query('origPath') || undefined;
      const staged = c.req.query('staged') === 'true';
      const safePath = path ? validateRepoPathInput(path) : undefined;
      const safeOrigPath = origPath ? validateRepoPathInput(origPath) : undefined;
      if (safePath && !base && !head) {
        const changes = await getWorkingTreeChanges(resolved);
        if (!changes.some((change) => change.path === safePath)) {
          throw new GitInputError(`Path is not changed in the current workspace: ${safePath}.`);
        }
      }
      const diff = await getFileDiff(resolved, {
        ...(base ? { base } : {}),
        ...(head ? { head } : {}),
        ...(safePath ? { path: safePath } : {}),
        staged,
      });
      audit({
        kind: 'config',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `git diff files=${diff.files.length} path=${safePath ?? '-'}`,
      });
      // origPath is echoed so the UI can label a rename "old → new".
      return c.json({
        ok: true as const,
        base: base ?? null,
        head: head ?? null,
        ...(safeOrigPath ? { origPath: safeOrigPath } : {}),
        ...diff,
      });
    } catch (err) {
      return gitError(c, user, startedAt, 'git diff', err);
    }
  })
  .post('/branch/create', async (c) => {
    const startedAt = Date.now();
    const user = getUser(c);
    const input = await parseJson(c, BranchCreateInput);
    if ('response' in input) return input.response;
    try {
      const workspaceRoot = resolveWorkspace(input.data.workspacePath);
      await assertSupportedRepo(workspaceRoot);
      const baseBranch = input.data.baseBranch ?? (await getCurrentBranch(workspaceRoot));
      const branch = await createAndCheckoutBranch(
        workspaceRoot,
        input.data.branch ?? generateBranchName(),
        baseBranch,
      );
      const session = await upsertGitSession(workspaceRoot, {
        baseBranch,
        workingBranch: branch,
        status: 'branch',
      });
      audit({
        kind: 'config',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `git branch create branch=${branch} base=${baseBranch}`,
      });
      return c.json({ ok: true, branch, session, status: await buildStatus(workspaceRoot) });
    } catch (err) {
      return gitError(c, user, startedAt, 'git branch create', err);
    }
  })
  .post('/branch/checkout', async (c) => {
    const startedAt = Date.now();
    const user = getUser(c);
    const input = await parseJson(c, BranchCheckoutInput);
    if ('response' in input) return input.response;
    try {
      const workspaceRoot = resolveWorkspace(input.data.workspacePath);
      await assertSupportedRepo(workspaceRoot);
      await checkoutBranch(workspaceRoot, input.data.branch);
      const branch = await getCurrentBranch(workspaceRoot);
      const baseBranch = await getDefaultBranch(workspaceRoot).catch(() => branch);
      const previous = getProject().gitSession;
      if (branch !== baseBranch && (!previous?.prUrl || previous.workingBranch !== branch)) {
        await upsertGitSession(workspaceRoot, {
          baseBranch,
          workingBranch: branch,
          status: 'branch',
        });
      }
      audit({
        kind: 'config',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `git branch checkout branch=${branch}`,
      });
      return c.json({ ok: true, branch, status: await buildStatus(workspaceRoot) });
    } catch (err) {
      return gitError(c, user, startedAt, 'git branch checkout', err);
    }
  })
  .post('/commit', async (c) => {
    const startedAt = Date.now();
    const user = getUser(c);
    const input = await parseJson(c, CommitInput);
    if ('response' in input) return input.response;
    try {
      const workspaceRoot = resolveWorkspace(input.data.workspacePath);
      await assertSupportedRepo(workspaceRoot);
      const selection = await validateCommitSelection(workspaceRoot, input.data.paths);
      const message = commitMessage(input.data.message, selection.selectedPaths.length);
      const commit = await scopedCommit(
        workspaceRoot,
        selection.gitPathspecs,
        message,
        gitCommitAuthorForRequest(c),
      );
      const session = await patchSessionAfterCommit(workspaceRoot);
      audit({
        kind: 'config',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `git commit files=${selection.selectedPaths.length} committed=${commit.committed}`,
      });
      return c.json({
        ok: true,
        ...commit,
        paths: selection.selectedPaths,
        session,
        status: await buildStatus(workspaceRoot),
      });
    } catch (err) {
      return gitError(c, user, startedAt, 'git commit', err);
    }
  })
  .post('/push', async (c) => {
    const startedAt = Date.now();
    const user = getUser(c);
    const input = await parseJson(c, WorkspaceInput);
    if ('response' in input) return input.response;
    try {
      const workspaceRoot = resolveWorkspace(input.data.workspacePath);
      await assertSupportedRepo(workspaceRoot);
      const project = getProject();
      const branch = await getCurrentBranch(workspaceRoot);
      if (project.gitSession?.workingBranch && project.gitSession.workingBranch !== branch) {
        throw new GitInputError(
          `Current branch is ${branch}, but the active PR session points to ${project.gitSession.workingBranch}. Checkout that branch before pushing.`,
        );
      }
      if (isProtectedBaseBranch(branch)) {
        throw new GitInputError('Create or checkout a feature branch before pushing.');
      }
      await pushBranch(workspaceRoot, branch);
      const session = await updateGitSession(workspaceRoot, {
        pushedAt: Date.now(),
        updatedAt: Date.now(),
      });
      audit({
        kind: 'config',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `git push branch=${branch}`,
      });
      return c.json({ ok: true, branch, session, status: await buildStatus(workspaceRoot) });
    } catch (err) {
      return gitError(c, user, startedAt, 'git push', err);
    }
  })
  .post('/sync', async (c) => {
    const startedAt = Date.now();
    const user = getUser(c);
    const input = await parseJson(c, SyncInput);
    if ('response' in input) return input.response;
    try {
      const workspaceRoot = resolveWorkspace(input.data.workspacePath);
      await assertSupportedRepo(workspaceRoot);
      await fetchRemote(workspaceRoot);
      // Freshen the PR cache (merged/closed/deleted elsewhere) then fall back to
      // an ancestor check for hosts without a CLI.
      await refreshPrState(workspaceRoot).catch(() => undefined);
      const session = getProject().gitSession;
      if (session?.commitSha && session.status !== 'merged') {
        const merged = await isAncestor(
          workspaceRoot,
          session.commitSha,
          `origin/${session.baseBranch}`,
        );
        if (merged)
          await updateGitSession(workspaceRoot, { status: 'merged', updatedAt: Date.now() });
      }
      if (input.data.syncToBase) {
        await syncToBase(workspaceRoot);
      }
      audit({
        kind: 'config',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `git sync syncToBase=${input.data.syncToBase}`,
      });
      return c.json({ ok: true, status: await buildStatus(workspaceRoot) });
    } catch (err) {
      return gitError(c, user, startedAt, 'git sync', err);
    }
  })
  .post('/session/clear', async (c) => {
    const startedAt = Date.now();
    const user = getUser(c);
    const input = await parseJson(c, WorkspaceInput);
    if ('response' in input) return input.response;
    try {
      const workspaceRoot = resolveWorkspace(input.data.workspacePath);
      await clearGitSession();
      audit({
        kind: 'config',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: 'git session clear',
      });
      return c.json({ ok: true, status: await buildStatus(workspaceRoot) });
    } catch (err) {
      return gitError(c, user, startedAt, 'git session clear', err);
    }
  })
  .post('/send-pr', async (c) => {
    const startedAt = Date.now();
    const user = getUser(c);
    const input = await parseJson(c, SendPrInput);
    if ('response' in input) return input.response;
    try {
      const result = await runSendPr(input.data, gitCommitAuthorForRequest(c));
      audit({
        kind: 'config',
        user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `git send-pr provider=${result.provider} branch=${result.branch} committed=${result.committed}`,
      });
      return c.json(result);
    } catch (err) {
      return gitError(c, user, startedAt, 'git send-pr', err);
    }
  });

// ---------- status --------------------------------------------------------

async function buildStatus(workspaceRoot: string, opts: { refreshPr?: boolean } = {}) {
  const workspaceKey = resolve(workspaceRoot);
  const resolvedWorkspace = await realpath(workspaceKey).catch(() => workspaceKey);
  const isRepo = await isGitRepo(resolvedWorkspace);
  if (!isRepo) {
    return emptyStatus({
      workspaceRoot: workspaceKey,
      reason: 'The connected folder is not a Git repository.',
    });
  }

  const topLevel = await getGitTopLevel(resolvedWorkspace);
  const boundaryOk = topLevel === resolvedWorkspace;
  const remote = 'origin';
  const remoteUrl = await getRemoteUrl(resolvedWorkspace, remote);
  const providerInfo = remoteUrl ? parseRemoteUrl(remoteUrl) : null;
  const currentBranch = await getCurrentBranch(resolvedWorkspace).catch(() => null);
  const baseBranch = await getDefaultBranch(resolvedWorkspace, remote).catch(
    () => currentBranch ?? null,
  );

  if (opts.refreshPr) {
    await refreshPrState(resolvedWorkspace).catch(() => undefined);
  }

  const changes = await getWorkingTreeChanges(resolvedWorkspace);
  const counts = {
    total: changes.length,
    untracked: changes.filter((change) => change.kind === 'untracked').length,
    conflicted: changes.filter((change) => change.kind === 'conflicted').length,
  };
  const remoteBaseRef = baseBranch ? `${remote}/${baseBranch}` : null;
  const aheadBehind = remoteBaseRef
    ? await getAheadBehind(resolvedWorkspace, remoteBaseRef).catch(() => ({ ahead: 0, behind: 0 }))
    : { ahead: 0, behind: 0 };

  return {
    ok: true as const,
    isGitRepo: true,
    boundaryOk,
    topLevel,
    workspaceRoot: workspaceKey,
    provider: providerInfo?.provider ?? ('unknown' as GitProvider),
    remote,
    remoteUrl,
    currentBranch,
    baseBranch,
    ahead: aheadBehind.ahead,
    behind: aheadBehind.behind,
    changes,
    counts,
    session: getProject().gitSession ?? null,
    tools: {
      git: true,
      gh: await ghAvailable(),
      glab: await glabAvailable(),
    },
    reason: boundaryOk
      ? null
      : `Open the Git repository root in sber-designer. Current workspace is ${workspaceKey}, but git top-level is ${topLevel}.`,
  };
}

function emptyStatus(input: { workspaceRoot?: string; reason: string }) {
  return {
    ok: true as const,
    isGitRepo: false,
    boundaryOk: false,
    topLevel: null,
    workspaceRoot: input.workspaceRoot ?? null,
    provider: 'unknown' as GitProvider,
    remote: null,
    remoteUrl: null,
    currentBranch: null,
    baseBranch: null,
    ahead: 0,
    behind: 0,
    changes: [] as GitChange[],
    counts: { total: 0, untracked: 0, conflicted: 0 },
    session: getProject().gitSession ?? null,
    tools: { git: false, gh: false, glab: false },
    reason: input.reason,
  };
}

// ---------- commit / send-pr ----------------------------------------------

/**
 * Validate the requested paths against a fresh `git status` and return the
 * de-duplicated list. Stale/unknown paths → 400 (task 0110 A5).
 */
interface CommitSelection {
  selectedPaths: string[];
  gitPathspecs: string[];
}

async function validateCommitSelection(
  workspaceRoot: string,
  requestedPaths: string[],
): Promise<CommitSelection> {
  const changes = await getWorkingTreeChanges(workspaceRoot);
  const changesByPath = new Map(changes.map((change) => [change.path, change]));
  const requested = Array.from(new Set(requestedPaths.map(validateRepoPathInput)));
  const stale = requested.filter((path) => !changesByPath.has(path));
  if (stale.length > 0) {
    throw new GitInputError(
      `Selected paths are not changed in the current workspace: ${stale.join(', ')}.`,
    );
  }
  const conflicted = requested.filter((path) => changesByPath.get(path)?.kind === 'conflicted');
  if (conflicted.length > 0) {
    throw new GitInputError(`Resolve conflicts before committing: ${conflicted.join(', ')}.`);
  }
  const gitPathspecs = new Set<string>();
  for (const path of requested) {
    const change = changesByPath.get(path);
    if (change?.kind === 'renamed' && change.origPath) {
      gitPathspecs.add(change.origPath);
    }
    gitPathspecs.add(path);
  }
  return { selectedPaths: requested, gitPathspecs: Array.from(gitPathspecs) };
}

function validateRepoPathInput(path: string): string {
  try {
    return normalizeRepoRelativePath(path);
  } catch (err) {
    throw new GitInputError(err instanceof Error ? err.message : String(err));
  }
}

function commitMessage(message: string | undefined, count: number): string {
  const trimmed = message?.trim();
  if (trimmed) return trimmed;
  return `sber-designer: update ${count} file${count === 1 ? '' : 's'}`;
}

/**
 * One button (task 0110 A6): fresh-validate → branch (only if on base) →
 * scoped commit → push → create-or-update PR. Returns the fresh status so the
 * web store adopts it in one round-trip. Non-selected files are never touched.
 */
async function runSendPr(input: z.infer<typeof SendPrInput>, author?: GitCommitAuthor) {
  const workspaceRoot = resolveWorkspace(input.workspacePath);
  await assertSupportedRepo(workspaceRoot);

  // 1. Fresh changes + validate the selection.
  const selection = await validateCommitSelection(workspaceRoot, input.paths);
  const message = commitMessage(input.message, selection.selectedPaths.length);

  let session = getProject().gitSession;
  if (session?.prUrl || session?.prNumber) {
    await refreshPrState(workspaceRoot).catch(() => undefined);
    session = getProject().gitSession;
  }
  const currentBranch = await getCurrentBranch(workspaceRoot);
  const baseBranch =
    session?.baseBranch ?? (await getDefaultBranch(workspaceRoot).catch(() => currentBranch));
  const hasOpenPr = Boolean(session?.prUrl && session.status === 'review-open');

  // 2. Pick the working branch. On the base branch → cut sd/<slug>. On an
  //    existing PR branch that we've drifted off → check it back out.
  let branch = currentBranch;
  if (hasOpenPr && session?.workingBranch) {
    if (session.workingBranch !== currentBranch) {
      await checkoutBranch(workspaceRoot, session.workingBranch);
    }
    branch = session.workingBranch;
  } else if (currentBranch === baseBranch || isProtectedBaseBranch(currentBranch)) {
    branch = await createWorkingBranch(workspaceRoot, input.title ?? message, baseBranch);
  } else if (session?.workingBranch && session.workingBranch !== currentBranch) {
    await checkoutBranch(workspaceRoot, session.workingBranch);
    branch = session.workingBranch;
  }

  // 3. Commit exactly the selected paths, then push.
  const commit = await scopedCommit(workspaceRoot, selection.gitPathspecs, message, author);
  await pushBranch(workspaceRoot, branch);

  // 4. Create the PR, or (when one already exists) let the push update it and
  //    optionally edit title/body.
  const remote = await detectRemote(workspaceRoot).catch(() => null);
  const provider = remote?.provider ?? ('unknown' as GitProvider);
  let prUrl = session?.prUrl ?? null;
  let prNumber = session?.prNumber;
  let compareUrl = session?.compareUrl ?? null;
  let note: string | null = null;

  if (hasOpenPr) {
    if (input.title || input.body) {
      await updatePrMeta(workspaceRoot, provider, prNumber, input.title, input.body);
    }
  } else {
    const created = await openPullRequest(workspaceRoot, provider, {
      title: input.title ?? message,
      body: input.body ?? autoPrBody(selection.selectedPaths),
      headBranch: branch,
      baseBranch,
      ...(input.draft !== undefined ? { draft: input.draft } : {}),
    });
    prUrl = created.prUrl;
    prNumber = created.prNumber ?? prNumber;
    compareUrl = created.compareUrl;
    note = created.note;
  }

  const commitSha = await revParse(workspaceRoot, 'HEAD').catch(() => session?.commitSha);
  session = await updateGitSession(workspaceRoot, {
    provider,
    remote: 'origin',
    remoteUrl: (await getRemoteUrl(workspaceRoot)) ?? session?.remoteUrl ?? '',
    baseBranch,
    workingBranch: branch,
    status: 'review-open',
    ...(prUrl ? { prUrl } : {}),
    ...(prNumber ? { prNumber } : {}),
    ...(compareUrl ? { compareUrl } : {}),
    ...(commitSha ? { commitSha } : {}),
    pushedAt: Date.now(),
    updatedAt: Date.now(),
  });

  return {
    ok: true as const,
    provider,
    branch,
    committed: commit.committed,
    committedCount: selection.selectedPaths.length,
    prUrl,
    prNumber: prNumber ?? null,
    compareUrl,
    note,
    session,
    status: await buildStatus(workspaceRoot),
  };
}

function gitCommitAuthorForRequest(c: Context): GitCommitAuthor | undefined {
  const user = getSessionUser(c);
  return user ? { name: user.displayName, email: user.email } : undefined;
}

class GitInputError extends Error {}

async function patchSessionAfterCommit(workspaceRoot: string): Promise<ProjectGitSession | null> {
  const session = getProject().gitSession;
  if (!session) return null;
  const currentBranch = await getCurrentBranch(workspaceRoot);
  if (currentBranch !== session.workingBranch) return session;
  const commitSha = await revParse(workspaceRoot, 'HEAD').catch(() => null);
  return updateGitSession(workspaceRoot, {
    ...(commitSha ? { commitSha } : {}),
    updatedAt: Date.now(),
  });
}

// ---------- misc helpers --------------------------------------------------

async function assertSupportedRepo(workspaceRoot: string): Promise<string> {
  const resolvedWorkspace = await realpath(resolve(workspaceRoot)).catch(() =>
    resolve(workspaceRoot),
  );
  if (!(await isGitRepo(resolvedWorkspace))) {
    throw new Error('The connected workspace is not a Git repository.');
  }
  const topLevel = await getGitTopLevel(resolvedWorkspace);
  if (topLevel !== resolvedWorkspace) {
    throw new Error(
      `Open the Git repository root before using Git/PR actions. Workspace: ${resolvedWorkspace}. Git root: ${topLevel}.`,
    );
  }
  return resolvedWorkspace;
}

/** Parse a query int with a default and clamp to [min, max]. */
function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function syncToBase(workspaceRoot: string): Promise<void> {
  if (await hasUncommitted(workspaceRoot)) {
    throw new Error('Commit or discard local changes before syncing to the base branch.');
  }
  const session = getProject().gitSession;
  const baseBranch = session?.baseBranch ?? (await getDefaultBranch(workspaceRoot));
  const checkout = await git(['checkout', baseBranch], { cwd: workspaceRoot });
  if (!checkout.ok) throw new Error(`git checkout failed: ${checkout.stderr.trim()}`);
  const pull = await git(['merge', '--ff-only', `origin/${baseBranch}`], { cwd: workspaceRoot });
  if (!pull.ok) throw new Error(`git fast-forward failed: ${pull.stderr.trim()}`);
  await clearGitSession();
}

async function isAncestor(
  workspaceRoot: string,
  maybeAncestor: string,
  descendant: string,
): Promise<boolean> {
  const r = await git(['merge-base', '--is-ancestor', maybeAncestor, descendant], {
    cwd: workspaceRoot,
  });
  return r.ok;
}

async function revParse(workspaceRoot: string, ref: string): Promise<string> {
  const r = await git(['rev-parse', ref], { cwd: workspaceRoot });
  if (!r.ok) throw new Error(`git rev-parse failed: ${r.stderr.trim()}`);
  return r.stdout.trim();
}

function resolveWorkspace(workspacePath?: string): string {
  const workspaceRoot = workspacePath ?? getState().workspacePath;
  if (!workspaceRoot) {
    throw new Error('No active workspace. Connect a project first.');
  }
  return workspaceRoot;
}

async function parseJson<T extends z.ZodTypeAny>(
  c: Context,
  schema: T,
): Promise<{ data: z.infer<T> } | { response: Response }> {
  const raw = await c.req.json().catch(() => ({}));
  const parse = schema.safeParse(raw);
  if (!parse.success) {
    return {
      response: c.json({ error: 'invalid_input', detail: parse.error.message }, 400),
    };
  }
  return { data: parse.data };
}

function gitError(
  c: Context,
  user: string,
  startedAt: number,
  action: string,
  err: unknown,
): Response {
  const message = err instanceof Error ? err.message : String(err);
  audit({
    kind: 'error',
    user,
    latencyMs: Date.now() - startedAt,
    errorMessage: `${action}: ${message}`,
  });
  if (err instanceof GitInputError) {
    return c.json({ error: 'git_error', detail: message }, 400);
  }
  return c.json({ error: 'git_failed', detail: message }, 422);
}

function generateBranchName(): string {
  return `sd/${timestampSlug()}`;
}

function isProtectedBaseBranch(branch: string): boolean {
  return (
    branch === 'main' ||
    branch === 'master' ||
    branch === 'develop' ||
    branch.startsWith('release/')
  );
}
