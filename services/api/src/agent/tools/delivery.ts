/** Delivery tool: send_pr — branch, scoped commit, push, PR. */
import { z } from 'zod';

import { getProject, saveProject } from '../../project-store';
import {
  createAndCheckoutBranch,
  getCurrentBranch,
  getRemoteUrl,
  getWorkingTreeChanges,
  ghAvailable,
  ghCreatePr,
  normalizeRepoRelativePath,
  parseRemoteUrl,
  pushBranch,
  scopedCommit,
} from '../../git/git-worker';
import type { ServerTool } from '../types';

const SendPrInput = z
  .object({
    title: z.string().min(1).describe('PR title.'),
    body: z.string().default('').describe('PR description (markdown).'),
    branch: z.string().min(1).optional().describe('Branch name. Default: sd/<timestamp>.'),
    baseBranch: z.string().min(1).optional().describe('Base branch. Default: repo default.'),
    paths: z
      .array(z.string().min(1))
      .min(1)
      .optional()
      .describe('Repo-relative paths to commit. Default: every uncommitted change.'),
    pushOnly: z.boolean().default(false).describe('Skip opening a PR — push only.'),
  })
  .strict();

export const sendPr: ServerTool<
  z.infer<typeof SendPrInput>,
  { ok: true; branch: string; committed: boolean; prUrl: string | null; note?: string },
  z.input<typeof SendPrInput>
> = {
  name: 'send_pr',
  description:
    "Branch + commit + push + open a pull request through `gh`. Uses the user's git/gh credentials on the host. When gh is missing, pushes anyway and reports the branch name. Commits all uncommitted workspace changes (use apply_patch / write_file before calling).",
  inputSchema: SendPrInput,
  handler: async (input, ctx) => {
    if (!ctx.workspacePath) {
      throw new Error('No workspace connected.');
    }
    const baseHead = await getCurrentBranch(ctx.workspacePath);
    const branchName = input.branch ?? generateBranchName();
    await createAndCheckoutBranch(ctx.workspacePath, branchName, baseHead);
    const remoteUrl = (await getRemoteUrl(ctx.workspacePath)) ?? '';
    const provider = remoteUrl ? parseRemoteUrl(remoteUrl).provider : 'unknown';
    await saveProject({
      ...getProject(),
      gitSession: {
        provider,
        remote: 'origin',
        remoteUrl,
        baseBranch: input.baseBranch ?? baseHead,
        workingBranch: branchName,
        status: input.pushOnly ? 'branch' : 'review-open',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });
    const changes = await getWorkingTreeChanges(ctx.workspacePath);
    const requestedPaths =
      input.paths?.map(validateRepoPathInput) ?? changes.map((change) => change.path);
    const changedByPath = new Map(changes.map((change) => [change.path, change]));
    const stale = requestedPaths.filter((path) => !changedByPath.has(path));
    if (stale.length > 0) {
      throw new Error(
        `Selected paths are not changed in the current workspace: ${stale.join(', ')}.`,
      );
    }
    const conflicted = requestedPaths.filter(
      (path) => changedByPath.get(path)?.kind === 'conflicted',
    );
    if (conflicted.length > 0) {
      throw new Error(`Resolve conflicts before committing: ${conflicted.join(', ')}.`);
    }
    const commitPathspecs = new Set<string>();
    for (const path of requestedPaths) {
      const change = changedByPath.get(path);
      if (change?.kind === 'renamed' && change.origPath) commitPathspecs.add(change.origPath);
      commitPathspecs.add(path);
    }
    const commit = await scopedCommit(
      ctx.workspacePath,
      Array.from(commitPathspecs),
      input.title,
      ctx.userDisplayName ? { name: ctx.userDisplayName, email: ctx.user } : undefined,
    );
    await pushBranch(ctx.workspacePath, branchName);
    if (input.pushOnly) {
      return { ok: true, branch: branchName, committed: commit.committed, prUrl: null };
    }
    if (!(await ghAvailable())) {
      return {
        ok: true,
        branch: branchName,
        committed: commit.committed,
        prUrl: null,
        note: 'gh CLI not installed; branch pushed but PR not opened.',
      };
    }
    const pr = await ghCreatePr({
      workspaceRoot: ctx.workspacePath,
      title: input.title,
      body: input.body,
      headBranch: branchName,
      ...(input.baseBranch !== undefined ? { baseBranch: input.baseBranch } : {}),
    });
    await saveProject({
      ...getProject(),
      gitSession: {
        ...(getProject().gitSession ?? {
          provider,
          remote: 'origin',
          remoteUrl,
          baseBranch: input.baseBranch ?? baseHead,
          workingBranch: branchName,
          createdAt: Date.now(),
        }),
        status: 'review-open',
        prUrl: pr.url,
        pushedAt: Date.now(),
        updatedAt: Date.now(),
      },
    });
    return { ok: true, branch: branchName, committed: commit.committed, prUrl: pr.url };
  },
};

function generateBranchName(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace(/T/, '-').replace(/Z$/, '');
  return `sd/${ts}`;
}

function validateRepoPathInput(path: string): string {
  try {
    return normalizeRepoRelativePath(path);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : String(err));
  }
}

// ---------- screen_create / screen_remove (Phase 5.2c) -----------------
