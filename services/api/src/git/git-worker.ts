/**
 * Thin wrapper around `git` and `gh` CLIs (Phase 3.4).
 *
 * Why exec instead of nodegit / isomorphic-git: matches what every dev
 * already has installed, doesn't duplicate auth (uses the user's
 * existing git credentials and `gh` auth), zero new deps. Trade-off
 * is platform-availability — we expect git + gh in PATH on the host
 * running services/api. Phase 4 swaps in a Docker image with both
 * baked in.
 *
 * Every call is workspace-scoped (cwd === workspaceRoot). No env-var
 * tweaks; we let gh / git pick up GITHUB_TOKEN / SSH agents naturally.
 */
import { spawn } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type {
  GitBranchRef,
  GitChange,
  GitChangeKind,
  GitCommitNode,
  GitFileDiffEntry,
} from '@sber-designer/shared-types';

import { parsePorcelainV2 } from './porcelain';
import { parseRemoteUrl, type RemoteInfo } from './git-remote';

export type { GitChange, GitChangeKind };
export {
  buildCommitUrl,
  buildCompareUrl,
  parseRemoteUrl,
  type GitProvider,
  type RemoteInfo,
} from './git-remote';

export interface GitExecResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

export interface GitCommitAuthor {
  name: string;
  email: string;
}

interface RunOptions {
  cwd: string;
  /** Stop the process after this many ms. Default: 30 s. */
  timeoutMs?: number;
}

async function runCommand(
  command: string,
  args: string[],
  opts: RunOptions,
): Promise<GitExecResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    const timer = setTimeout(() => {
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }
    }, opts.timeoutMs ?? 30_000);

    let stdout = '';
    let stderr = '';
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => (stdout += chunk));
    child.stderr?.on('data', (chunk) => (stderr += chunk));

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        stdout,
        stderr: stderr || err.message,
        code: null,
      });
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout, stderr, code });
    });
  });
}

export async function git(args: string[], opts: RunOptions): Promise<GitExecResult> {
  return runCommand('git', args, opts);
}

export async function gh(args: string[], opts: RunOptions): Promise<GitExecResult> {
  return runCommand('gh', args, opts);
}

/** GitLab official CLI. Same shape as gh; auth via `glab auth login`. */
export async function glab(args: string[], opts: RunOptions): Promise<GitExecResult> {
  return runCommand('glab', args, opts);
}

// ---------- High-level helpers --------------------------------------------

export async function getCurrentBranch(workspaceRoot: string): Promise<string> {
  const r = await git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: workspaceRoot });
  if (!r.ok) throw new Error(`git rev-parse failed: ${r.stderr.trim()}`);
  return r.stdout.trim();
}

export async function isGitRepo(workspaceRoot: string): Promise<boolean> {
  const r = await git(['rev-parse', '--is-inside-work-tree'], { cwd: workspaceRoot });
  return r.ok && r.stdout.trim() === 'true';
}

export async function getGitTopLevel(workspaceRoot: string): Promise<string | null> {
  const r = await git(['rev-parse', '--show-toplevel'], { cwd: workspaceRoot });
  if (!r.ok) return null;
  const topLevel = resolve(r.stdout.trim());
  return realpath(topLevel).catch(() => topLevel);
}

export async function getRemoteUrl(
  workspaceRoot: string,
  remote = 'origin',
): Promise<string | null> {
  const r = await git(['config', '--get', `remote.${remote}.url`], { cwd: workspaceRoot });
  return r.ok ? r.stdout.trim() : null;
}

export async function getDefaultBranch(workspaceRoot: string, remote = 'origin'): Promise<string> {
  const remoteHead = await git(
    ['symbolic-ref', '--quiet', '--short', `refs/remotes/${remote}/HEAD`],
    { cwd: workspaceRoot },
  );
  if (remoteHead.ok && remoteHead.stdout.trim()) {
    return remoteHead.stdout.trim().replace(new RegExp(`^${escapeRegExp(remote)}/`), '');
  }

  for (const candidate of ['main', 'master']) {
    if (await hasBranch(workspaceRoot, candidate)) return candidate;
  }

  const configured = await git(['config', '--get', 'init.defaultBranch'], { cwd: workspaceRoot });
  if (configured.ok && configured.stdout.trim()) return configured.stdout.trim();
  return getCurrentBranch(workspaceRoot);
}

export interface AheadBehind {
  ahead: number;
  behind: number;
}

export async function getAheadBehind(
  workspaceRoot: string,
  baseRef: string,
  headRef = 'HEAD',
): Promise<AheadBehind> {
  const r = await git(['rev-list', '--left-right', '--count', `${baseRef}...${headRef}`], {
    cwd: workspaceRoot,
  });
  if (!r.ok) return { ahead: 0, behind: 0 };
  const [behindRaw, aheadRaw] = r.stdout.trim().split(/\s+/);
  return {
    behind: Number.parseInt(behindRaw ?? '0', 10) || 0,
    ahead: Number.parseInt(aheadRaw ?? '0', 10) || 0,
  };
}

// ---------- Task 0110: working-tree changes (porcelain v2) --------------
// `GitChange` / `GitChangeKind` live in @sber-designer/shared-types; the pure
// parser lives in ./porcelain. Both are re-exported above for existing importers.

/**
 * All uncommitted working-tree changes, read fresh from git — the single
 * source of truth for the Source Control panel (task 0110). No editor-owned
 * state survives a restart because git itself is the state (rule 11).
 *
 * Uses `--porcelain=v2 -z`: v2 gives explicit index (X) vs worktree (Y)
 * status, and `-z` NUL-delimits records without shell-quoting, so paths with
 * spaces or non-ASCII (Cyrillic) round-trip verbatim.
 */
export async function getWorkingTreeChanges(workspaceRoot: string): Promise<GitChange[]> {
  const r = await git(['status', '--porcelain=v2', '-z', '--untracked-files=all'], {
    cwd: workspaceRoot,
  });
  if (!r.ok) throw new Error(`git status failed: ${r.stderr.trim()}`);
  return parsePorcelainV2(r.stdout);
}

export async function hasUncommitted(workspaceRoot: string): Promise<boolean> {
  const r = await git(['status', '--porcelain'], { cwd: workspaceRoot });
  if (!r.ok) throw new Error(`git status failed: ${r.stderr.trim()}`);
  return r.stdout.trim().length > 0;
}

export async function hasBranch(workspaceRoot: string, branch: string): Promise<boolean> {
  const r = await git(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], {
    cwd: workspaceRoot,
  });
  return r.ok;
}

export function normalizeBranchName(input: string): string {
  const branch = input.trim().replace(/\s+/g, '-').toLowerCase();
  const invalid =
    !branch ||
    branch.startsWith('/') ||
    branch.endsWith('/') ||
    branch.startsWith('-') ||
    branch.endsWith('.') ||
    branch.includes('..') ||
    branch.includes('@{') ||
    branch.includes('//') ||
    branch.endsWith('.lock') ||
    /[~^:?*[\\\x00-\x20\x7f]/.test(branch);
  if (invalid) {
    throw new Error('Invalid branch name. Use letters, numbers, dashes, underscores and slashes.');
  }
  return branch;
}

export async function createAndCheckoutBranch(
  workspaceRoot: string,
  branch: string,
  baseRef?: string,
): Promise<string> {
  const normalized = normalizeBranchName(branch);
  if (await hasBranch(workspaceRoot, normalized)) {
    throw new Error(`Branch already exists: ${normalized}`);
  }
  const args = baseRef ? ['checkout', '-b', normalized, baseRef] : ['checkout', '-b', normalized];
  const r = await git(args, { cwd: workspaceRoot });
  if (!r.ok) throw new Error(`git checkout failed: ${r.stderr.trim()}`);
  return normalized;
}

export async function checkoutBranch(workspaceRoot: string, branch: string): Promise<void> {
  const normalized = normalizeBranchName(branch);
  const args = ['checkout', normalized];
  const r = await git(args, { cwd: workspaceRoot });
  if (!r.ok) throw new Error(`git checkout failed: ${r.stderr.trim()}`);
}

export async function commitAll(
  workspaceRoot: string,
  message: string,
  author?: GitCommitAuthor,
): Promise<{ committed: boolean; stdout: string }> {
  const dirty = await hasUncommitted(workspaceRoot);
  if (!dirty) return { committed: false, stdout: 'no changes' };
  const add = await git(['add', '-A'], { cwd: workspaceRoot });
  if (!add.ok) throw new Error(`git add failed: ${add.stderr.trim()}`);
  const commit = await git(['commit', '-m', message, ...gitAuthorArgs(author)], {
    cwd: workspaceRoot,
  });
  if (!commit.ok) throw new Error(`git commit failed: ${commit.stderr.trim()}`);
  return { committed: true, stdout: commit.stdout };
}

/**
 * Commit only the given paths (task 0110). `git add -- <paths>` stages them
 * first — this is what makes untracked and deleted paths committable — and the
 * final `git commit -m … -- <paths>` is a pathspec-scoped commit, so any other
 * files the user may have staged are left untouched.
 */
export async function scopedCommit(
  workspaceRoot: string,
  paths: string[],
  message: string,
  author?: GitCommitAuthor,
): Promise<{ committed: boolean; stdout: string; paths: string[] }> {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  if (uniquePaths.length === 0) {
    return { committed: false, stdout: 'no paths', paths: [] };
  }
  const existingPaths: string[] = [];
  const missingPaths: string[] = [];
  for (const path of uniquePaths) {
    if (await pathExists(resolve(workspaceRoot, path))) existingPaths.push(path);
    else missingPaths.push(path);
  }
  if (existingPaths.length > 0) {
    const add = await git(['add', '--', ...existingPaths], { cwd: workspaceRoot });
    if (!add.ok) throw new Error(`git add failed: ${add.stderr.trim()}`);
  }
  if (missingPaths.length > 0) {
    const removeDeleted = await git(['rm', '--cached', '--ignore-unmatch', '--', ...missingPaths], {
      cwd: workspaceRoot,
    });
    if (!removeDeleted.ok)
      throw new Error(`git rm --cached failed: ${removeDeleted.stderr.trim()}`);
  }

  const diff = await git(['diff', '--cached', '--quiet', '--', ...uniquePaths], {
    cwd: workspaceRoot,
  });
  if (diff.ok) {
    return { committed: false, stdout: 'no changes', paths: uniquePaths };
  }
  if (diff.code !== 1) {
    throw new Error(`git diff --cached failed: ${diff.stderr.trim()}`);
  }

  const commit = await git(
    ['commit', '-m', message, ...gitAuthorArgs(author), '--', ...uniquePaths],
    {
      cwd: workspaceRoot,
    },
  );
  if (!commit.ok) throw new Error(`git commit failed: ${commit.stderr.trim()}`);
  return { committed: true, stdout: commit.stdout, paths: uniquePaths };
}

/**
 * Git accepts author identity as one argv value, but still parses angle brackets and
 * line breaks inside it. Keep the worker as the trust boundary even though account
 * registration already validates these fields (epic 0400, R-15).
 */
export function sanitizeGitCommitAuthor(author: GitCommitAuthor): GitCommitAuthor {
  const name = author.name
    .replace(/[<>\p{Cc}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  const email = author.email.trim().toLocaleLowerCase('en-US');
  if (name.length < 2 || name.length > 64) {
    throw new Error('Git author name must contain 2–64 characters after sanitization.');
  }
  if (email.length > 320 || !/^[^\s<>@]+@[^\s<>@]+$/u.test(email)) {
    throw new Error('Git author email is invalid.');
  }
  return { name, email };
}

function gitAuthorArgs(author: GitCommitAuthor | undefined): string[] {
  if (!author) return [];
  const safe = sanitizeGitCommitAuthor(author);
  return ['--author', `${safe.name} <${safe.email}>`];
}

async function pathExists(path: string): Promise<boolean> {
  return stat(path)
    .then(() => true)
    .catch(() => false);
}

export async function pushBranch(
  workspaceRoot: string,
  branch: string,
  remote = 'origin',
): Promise<void> {
  const r = await git(['push', '-u', remote, branch], { cwd: workspaceRoot, timeoutMs: 60_000 });
  if (!r.ok) throw new Error(`git push failed: ${r.stderr.trim()}`);
}

export async function fetchRemote(workspaceRoot: string, remote = 'origin'): Promise<void> {
  const r = await git(['fetch', remote, '--prune'], { cwd: workspaceRoot, timeoutMs: 60_000 });
  if (!r.ok) throw new Error(`git fetch failed: ${r.stderr.trim()}`);
}

// CLI availability rarely changes within a process lifetime, but the status
// bar (task 0096) refreshes git status often. Probing `gh`/`glab --version`
// on every /status spawns processes needlessly, so cache the result.
let ghAvailableCache: boolean | undefined;
let glabAvailableCache: boolean | undefined;

/** Test seam: reset the cached CLI-availability probes. */
export function resetCliAvailabilityCache(): void {
  ghAvailableCache = undefined;
  glabAvailableCache = undefined;
}

export async function ghAvailable(): Promise<boolean> {
  if (ghAvailableCache !== undefined) return ghAvailableCache;
  // `gh --version` is fast and always succeeds when gh is installed.
  const r = await runCommand('gh', ['--version'], { cwd: process.cwd(), timeoutMs: 5_000 });
  ghAvailableCache = r.ok;
  return ghAvailableCache;
}

export interface GhCreatePrInput {
  workspaceRoot: string;
  title: string;
  body: string;
  baseBranch?: string;
  headBranch: string;
  draft?: boolean;
}

export interface GhCreatePrResult {
  url: string;
}

export async function ghCreatePr(input: GhCreatePrInput): Promise<GhCreatePrResult> {
  const args = [
    'pr',
    'create',
    '--title',
    input.title,
    '--body',
    input.body,
    '--head',
    input.headBranch,
  ];
  if (input.baseBranch) args.push('--base', input.baseBranch);
  if (input.draft) args.push('--draft');
  const r = await gh(args, { cwd: input.workspaceRoot, timeoutMs: 60_000 });
  if (!r.ok) {
    throw new Error(
      `gh pr create failed: ${r.stderr.trim() || r.stdout.trim() || `code ${r.code}`}`,
    );
  }
  // gh writes the PR URL to stdout on success.
  const url = r.stdout.trim().split('\n').pop() ?? '';
  return { url };
}

// ---------- Phase 6.4: provider detection + GitLab / Bitbucket ----------

export async function detectRemote(workspaceRoot: string, remote = 'origin'): Promise<RemoteInfo> {
  const r = await git(['config', '--get', `remote.${remote}.url`], { cwd: workspaceRoot });
  if (!r.ok) throw new Error(`git config remote.${remote}.url failed: ${r.stderr.trim()}`);
  return parseRemoteUrl(r.stdout.trim());
}

export async function glabAvailable(): Promise<boolean> {
  if (glabAvailableCache !== undefined) return glabAvailableCache;
  const r = await runCommand('glab', ['--version'], { cwd: process.cwd(), timeoutMs: 5_000 });
  glabAvailableCache = r.ok;
  return glabAvailableCache;
}

export interface GlabCreateMrInput {
  workspaceRoot: string;
  title: string;
  body: string;
  baseBranch?: string;
  headBranch: string;
  draft?: boolean;
}

export interface GlabCreateMrResult {
  url: string;
}

export async function glabCreateMr(input: GlabCreateMrInput): Promise<GlabCreateMrResult> {
  const args = [
    'mr',
    'create',
    '--title',
    input.title,
    '--description',
    input.body,
    '--source-branch',
    input.headBranch,
    '--yes', // skip the interactive confirmation
  ];
  if (input.baseBranch) args.push('--target-branch', input.baseBranch);
  if (input.draft) args.push('--draft');
  const r = await glab(args, { cwd: input.workspaceRoot, timeoutMs: 60_000 });
  if (!r.ok) {
    throw new Error(
      `glab mr create failed: ${r.stderr.trim() || r.stdout.trim() || `code ${r.code}`}`,
    );
  }
  // glab prints the MR URL on success — find the first https:// occurrence.
  const out = `${r.stdout}\n${r.stderr}`;
  const url = /https?:\/\/\S+/.exec(out)?.[0] ?? '';
  return { url };
}

// ---------- Task 0096: Git Graph + diff data ----------------------------

export interface CommitGraphOptions {
  limit?: number;
  all?: boolean;
  skip?: number;
}

/**
 * Read commit history for the Git Graph viewer. Fields are separated by the
 * ASCII unit separator (0x1f) and records by the record separator (0x1e),
 * which never appear in commit messages, so parsing is robust against
 * arbitrary subjects/refs. Lane layout is computed client-side.
 */
export async function getCommitGraph(
  workspaceRoot: string,
  opts: CommitGraphOptions = {},
): Promise<GitCommitNode[]> {
  const fmt = ['%H', '%P', '%D', '%an', '%ae', '%aI', '%s'].join('%x1f');
  const args = ['log', `--pretty=format:${fmt}%x1e`, '--date-order'];
  if (opts.all) args.push('--all');
  if (typeof opts.limit === 'number' && opts.limit > 0) args.push('-n', String(opts.limit));
  if (typeof opts.skip === 'number' && opts.skip > 0) args.push(`--skip=${opts.skip}`);
  const r = await git(args, { cwd: workspaceRoot, timeoutMs: 30_000 });
  if (!r.ok) throw new Error(`git log failed: ${r.stderr.trim()}`);
  return parseCommitGraph(r.stdout);
}

/** Exported for unit tests: parse the record/unit-separated `git log` output. */
export function parseCommitGraph(stdout: string): GitCommitNode[] {
  return stdout
    .split('\x1e')
    .map((rec) => rec.replace(/^\r?\n/, ''))
    .filter((rec) => rec.trim().length > 0)
    .map((rec) => {
      const parts = rec.split('\x1f');
      const sha = parts[0] ?? '';
      const parents = parts[1] ?? '';
      const refs = parts[2] ?? '';
      const author = parts[3] ?? '';
      const authorEmail = parts[4] ?? '';
      const date = parts[5] ?? '';
      const subject = parts[6] ?? '';
      return {
        sha,
        parents: parents ? parents.split(' ').filter(Boolean) : [],
        refs: refs
          ? refs
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        author,
        authorEmail,
        date,
        subject,
      };
    });
}

/** List local and remote branch heads for the picker / graph (task 0096). */
export async function listBranches(workspaceRoot: string): Promise<GitBranchRef[]> {
  // for-each-ref does not interpret `%x1f`, so use literal tabs — git refnames
  // can never contain a tab, space, or other control character.
  const fmt = ['%(refname)', '%(objectname)', '%(HEAD)', '%(upstream:short)'].join('\t');
  const r = await git(['for-each-ref', `--format=${fmt}`, 'refs/heads', 'refs/remotes'], {
    cwd: workspaceRoot,
  });
  if (!r.ok) throw new Error(`git for-each-ref failed: ${r.stderr.trim()}`);
  return r.stdout
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const refname = parts[0] ?? '';
      const sha = parts[1] ?? '';
      const head = parts[2] ?? '';
      const upstream = parts[3] ?? '';
      const isRemote = refname.startsWith('refs/remotes/');
      const name = refname.replace(/^refs\/heads\//, '').replace(/^refs\/remotes\//, '');
      return {
        name,
        sha,
        isCurrent: head === '*',
        isRemote,
        ...(upstream ? { upstream } : {}),
      };
    })
    .filter((b) => !(b.isRemote && b.name.endsWith('/HEAD')));
}

export interface FileDiffOptions {
  /** Base ref/sha. With `head`, diffs `base..head`; alone, diffs working tree vs base. */
  base?: string;
  head?: string;
  /** When set, also return the unified patch for this single path. */
  path?: string;
  /** Diff the index instead of the working tree. */
  staged?: boolean;
}

const MAX_PATCH_BYTES = 200_000;

/**
 * File-level diff for the graph commit-details panel and the optional Send PR
 * diff preview (task 0096). Returns numstat-derived entries and, when a
 * `path` is given, the (size-capped) unified patch for that file.
 */
export async function getFileDiff(
  workspaceRoot: string,
  opts: FileDiffOptions = {},
): Promise<{ files: GitFileDiffEntry[]; patch?: string; truncated?: boolean }> {
  const safePath = opts.path ? normalizeRepoRelativePath(opts.path) : undefined;
  const range: string[] = [];
  if (opts.base && opts.head) range.push(`${opts.base}..${opts.head}`);
  else if (opts.base) range.push(opts.base);

  const numstatArgs = ['diff', '--numstat', '--no-color'];
  if (opts.staged) numstatArgs.push('--cached');
  numstatArgs.push(...range);
  const numstat = await git(numstatArgs, { cwd: workspaceRoot, timeoutMs: 30_000 });
  if (!numstat.ok) throw new Error(`git diff --numstat failed: ${numstat.stderr.trim()}`);

  const nameStatusArgs = ['diff', '--name-status', '--no-color'];
  if (opts.staged) nameStatusArgs.push('--cached');
  nameStatusArgs.push(...range);
  const nameStatus = await git(nameStatusArgs, { cwd: workspaceRoot, timeoutMs: 30_000 });
  const statusByPath = parseNameStatus(nameStatus.ok ? nameStatus.stdout : '');

  const files = parseNumstat(numstat.stdout, statusByPath);

  let patch: string | undefined;
  let truncated: boolean | undefined;
  if (safePath) {
    const patchArgs = ['diff', '--no-color'];
    if (opts.staged) patchArgs.push('--cached');
    patchArgs.push(...range, '--', safePath);
    const p = await git(patchArgs, { cwd: workspaceRoot, timeoutMs: 30_000 });
    let raw = p.ok ? p.stdout : '';
    // Untracked files never appear in `git diff`. For a working-tree path (no
    // explicit range) that produced nothing and is untracked, synthesise an
    // added-file patch with `--no-index` against /dev/null. This reads only —
    // it never writes to the index (task 0110 A4, rule D4.34 of 0107).
    if (!raw && range.length === 0 && (await isUntracked(workspaceRoot, safePath))) {
      await assertPathWithinWorkspace(workspaceRoot, safePath);
      const noIndex = await git(['diff', '--no-color', '--no-index', '--', '/dev/null', safePath], {
        cwd: workspaceRoot,
        timeoutMs: 30_000,
      });
      // `--no-index` exits 1 when the files differ — that is success, not error.
      if (noIndex.ok || noIndex.code === 1) raw = noIndex.stdout;
    }
    if (raw.length > MAX_PATCH_BYTES) {
      patch = raw.slice(0, MAX_PATCH_BYTES);
      truncated = true;
    } else if (raw) {
      patch = raw;
    }
  }
  return {
    files,
    ...(patch !== undefined ? { patch } : {}),
    ...(truncated ? { truncated } : {}),
  };
}

export function normalizeRepoRelativePath(input: string): string {
  if (!input || hasControlCharacter(input)) {
    throw new Error('Expected a repo-relative path.');
  }
  if (input.includes('\\') || isAbsolute(input) || /^[A-Za-z]:/u.test(input)) {
    throw new Error('Expected a repo-relative path.');
  }
  const segments = input.split('/');
  if (segments.some((segment) => segment === '..')) {
    throw new Error('Expected a repo-relative path inside the workspace.');
  }
  const normalized = segments.filter((segment) => segment.length > 0).join('/');
  if (!normalized || normalized === '.') {
    throw new Error('Expected a repo-relative path.');
  }
  return normalized;
}

function hasControlCharacter(input: string): boolean {
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

async function assertPathWithinWorkspace(workspaceRoot: string, repoPath: string): Promise<void> {
  const root = await realpath(resolve(workspaceRoot)).catch(() => resolve(workspaceRoot));
  const absolute = resolve(root, repoPath);
  const candidate = await realpath(absolute).catch(async () => {
    const parent = await realpath(dirname(absolute)).catch(() => root);
    return parent;
  });
  if (!isInside(root, candidate)) {
    throw new Error('Expected a repo-relative path inside the workspace.');
  }
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/** True when `path` is not tracked in the index (used to gate the --no-index diff). */
async function isUntracked(workspaceRoot: string, path: string): Promise<boolean> {
  const r = await git(['ls-files', '--error-unmatch', '--', path], { cwd: workspaceRoot });
  return !r.ok;
}

/** Exported for tests: parse `git diff --numstat` into diff entries. */
export function parseNumstat(
  stdout: string,
  statusByPath: Map<string, string> = new Map(),
): GitFileDiffEntry[] {
  return stdout
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const cols = line.split('\t');
      const addRaw = cols[0] ?? '0';
      const delRaw = cols[1] ?? '0';
      let path = cols.slice(2).join('\t');
      path = normalizeNumstatPath(path);
      const binary = addRaw === '-' && delRaw === '-';
      return {
        path: unquoteGitPath(path),
        status: statusByPath.get(path) ?? statusByPath.get(unquoteGitPath(path)) ?? 'modified',
        additions: binary ? 0 : Number.parseInt(addRaw, 10) || 0,
        deletions: binary ? 0 : Number.parseInt(delRaw, 10) || 0,
        binary,
      };
    });
}

function normalizeNumstatPath(path: string): string {
  const braceRename = /^(.*)\{(.+?) => (.+?)\}(.*)$/u.exec(path);
  if (braceRename) {
    return `${braceRename[1] ?? ''}${braceRename[3] ?? ''}${braceRename[4] ?? ''}`;
  }
  const tabRename = /^(.+)\t(.+)$/u.exec(path);
  if (tabRename) return tabRename[2] ?? path;
  const arrow = path.indexOf(' => ');
  if (arrow >= 0) return path.slice(arrow + 4).replace(/}$/, '');
  return path;
}

function parseNameStatus(stdout: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const code = parts[0] ?? '';
    const path = parts[parts.length - 1] ?? '';
    map.set(path, statusCodeToWord(code));
  }
  return map;
}

function statusCodeToWord(code: string): string {
  switch (code[0]) {
    case 'A':
      return 'added';
    case 'M':
      return 'modified';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    case 'C':
      return 'copied';
    case 'T':
      return 'type-changed';
    default:
      return 'modified';
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function unquoteGitPath(value: string): string {
  if (!value.startsWith('"') || !value.endsWith('"')) return value;
  try {
    return JSON.parse(value) as string;
  } catch {
    return value.slice(1, -1);
  }
}
