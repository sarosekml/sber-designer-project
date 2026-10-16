/** Git workspace endpoints: status, branches, sync, commit, PR lifecycle, graph. */
import type {
  GitBranchRef,
  GitChange,
  GitChangeCounts,
  GitChangeKind,
  GitCommitNode,
  GitFileDiff,
  GitGraphResponse,
  ProjectGitSession,
} from '@sber-designer/shared-types';

import { API_URL, ApiError, authHeaders, safeJson, withSignal } from './http';

export type GitProvider = 'github' | 'gitlab' | 'bitbucket' | 'unknown';

/** task 0110 A6: one button → branch + commit + push + create/update PR. */
export interface SendPrInput {
  paths: string[];
  message?: string;
  title?: string;
  body?: string;
  draft?: boolean;
}

export interface CommitInput {
  paths: string[];
  message?: string;
}

export interface BranchCreateInput {
  branch?: string;
  baseBranch?: string;
}

export interface BranchCheckoutInput {
  branch: string;
}

/**
 * Working-tree status v2 (task 0110). `changes` is every uncommitted change
 * read fresh from git — no ownership split, so a restart cannot desync it.
 */
export interface GitStatusResponse {
  ok: true;
  isGitRepo: boolean;
  boundaryOk: boolean;
  topLevel: string | null;
  workspaceRoot: string | null;
  provider: GitProvider;
  remote: string | null;
  remoteUrl: string | null;
  currentBranch: string | null;
  baseBranch: string | null;
  ahead: number;
  behind: number;
  changes: GitChange[];
  counts: GitChangeCounts;
  session: ProjectGitSession | null;
  tools: { git: boolean; gh: boolean; glab: boolean };
  reason: string | null;
}

export type {
  GitBranchRef,
  GitChange,
  GitChangeCounts,
  GitChangeKind,
  GitCommitNode,
  GitFileDiff,
  GitGraphResponse,
};

export interface SendPrResult {
  ok: true;
  /** Detected remote provider (Phase 6.4). */
  provider: GitProvider;
  branch: string;
  committed: boolean;
  committedCount: number;
  /** Set when the matching CLI was available and the MR/PR was opened. */
  prUrl: string | null;
  prNumber: string | null;
  /** Set when no CLI was found — clicking it opens the host's "create PR" page. */
  compareUrl?: string | null;
  note?: string | null;
  session?: ProjectGitSession;
  status?: GitStatusResponse;
}

export interface GitActionResult {
  ok: true;
  status: GitStatusResponse;
  session?: ProjectGitSession | null;
  branch?: string;
}

export interface CommitResult {
  ok: true;
  committed: boolean;
  paths: string[];
  session?: ProjectGitSession | null;
  status: GitStatusResponse;
}

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(
    `${API_URL}${path}`,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const errBody = await safeJson(res);
    throw new ApiError(errBody?.detail ?? `HTTP ${res.status}`, res.status, errBody?.error);
  }
  return (await res.json()) as T;
}

export async function getGitStatus(
  opts: { refreshPr?: boolean } = {},
  signal?: AbortSignal,
): Promise<GitStatusResponse> {
  const qs = opts.refreshPr ? '?refreshPr=true' : '';
  const res = await fetch(
    `${API_URL}/api/git/status${qs}`,
    withSignal({ headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as GitStatusResponse;
}

export function commitChanges(input: CommitInput, signal?: AbortSignal): Promise<CommitResult> {
  return postJson<CommitResult>('/api/git/commit', input, signal);
}

export function pushWorkingBranch(signal?: AbortSignal): Promise<GitActionResult> {
  return postJson<GitActionResult>('/api/git/push', {}, signal);
}

export function createGitBranch(
  input: BranchCreateInput,
  signal?: AbortSignal,
): Promise<GitActionResult> {
  return postJson<GitActionResult>('/api/git/branch/create', input, signal);
}

export function checkoutGitBranch(
  input: BranchCheckoutInput,
  signal?: AbortSignal,
): Promise<GitActionResult> {
  return postJson<GitActionResult>('/api/git/branch/checkout', input, signal);
}

export function syncGitRemote(
  input: { syncToBase?: boolean } = {},
  signal?: AbortSignal,
): Promise<GitActionResult> {
  return postJson<GitActionResult>('/api/git/sync', input, signal);
}

export function clearGitSession(signal?: AbortSignal): Promise<GitActionResult> {
  return postJson<GitActionResult>('/api/git/session/clear', {}, signal);
}

export function sendPr(input: SendPrInput, signal?: AbortSignal): Promise<SendPrResult> {
  return postJson<SendPrResult>('/api/git/send-pr', input, signal);
}

export async function getGitGraph(
  input: { limit?: number; all?: boolean; skip?: number } = {},
  signal?: AbortSignal,
): Promise<GitGraphResponse> {
  const params = new URLSearchParams();
  if (typeof input.limit === 'number') params.set('limit', String(input.limit));
  if (typeof input.skip === 'number') params.set('skip', String(input.skip));
  if (input.all === false) params.set('all', 'false');
  const qs = params.toString();
  const res = await fetch(
    `${API_URL}/api/git/graph${qs ? `?${qs}` : ''}`,
    withSignal({ headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as GitGraphResponse;
}

export async function listGitBranches(
  signal?: AbortSignal,
): Promise<{ ok: true; branches: GitBranchRef[] }> {
  const res = await fetch(
    `${API_URL}/api/git/branches`,
    withSignal({ headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as { ok: true; branches: GitBranchRef[] };
}

export async function getGitDiff(
  input: { base?: string; head?: string; path?: string; origPath?: string; staged?: boolean } = {},
  signal?: AbortSignal,
): Promise<GitFileDiff> {
  const params = new URLSearchParams();
  if (input.base) params.set('base', input.base);
  if (input.head) params.set('head', input.head);
  if (input.path) params.set('path', input.path);
  if (input.origPath) params.set('origPath', input.origPath);
  if (input.staged) params.set('staged', 'true');
  const qs = params.toString();
  const res = await fetch(
    `${API_URL}/api/git/diff${qs ? `?${qs}` : ''}`,
    withSignal({ headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as GitFileDiff;
}
