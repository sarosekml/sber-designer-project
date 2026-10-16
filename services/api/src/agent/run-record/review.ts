/** Explicit reviewer acknowledgement for terminal needs_review runs. */
import { readFile } from 'node:fs/promises';
import { resolveInside } from '@sber-designer/ast-bridge';
import type { AgentRunReviewAnnotation } from '@sber-designer/shared-types';

import { buildAgentRunDatasetRow, upsertAgentRunDatasetReview } from './dataset';
import { readRunReceipts } from './receipts';
import { readRunManifest, requireRunId, runRoot, writeJson } from './store';

export const RUN_REVIEW_FILE = 'review.json';

export class AgentRunReviewError extends Error {
  constructor(
    readonly code: 'run_not_found' | 'run_not_reviewable',
    message: string,
  ) {
    super(message);
    this.name = 'AgentRunReviewError';
  }
}

export async function readAgentRunReview(
  workspacePath: string,
  runId: string,
): Promise<AgentRunReviewAnnotation | null> {
  const normalizedRunId = requireRunId(runId);
  const path = resolveInside(runRoot(workspacePath, normalizedRunId), RUN_REVIEW_FILE);
  try {
    return normalizeReview(JSON.parse(await readFile(path, 'utf8')), normalizedRunId);
  } catch {
    return null;
  }
}

export async function markAgentRunReviewed(input: {
  workspacePath: string;
  runId: string;
  reviewer: string;
  now?: Date;
}): Promise<AgentRunReviewAnnotation> {
  const runId = requireRunId(input.runId);
  const manifest = await readRunManifest(input.workspacePath, runId);
  if (!manifest) {
    throw new AgentRunReviewError('run_not_found', `Agent run "${runId}" was not found.`);
  }
  if (manifest.status !== 'needs_review') {
    throw new AgentRunReviewError(
      'run_not_reviewable',
      `Only needs_review runs can be marked reviewed; this run is ${manifest.status}.`,
    );
  }
  const existing = await readAgentRunReview(input.workspacePath, runId);
  if (existing) return existing;
  const review: AgentRunReviewAnnotation = {
    version: 1,
    runId,
    reviewer: input.reviewer.trim() || 'unknown',
    reviewedAt: (input.now ?? new Date()).toISOString(),
  };
  await writeJson(resolveInside(runRoot(input.workspacePath, runId), RUN_REVIEW_FILE), review);
  const receipts = await readRunReceipts(input.workspacePath, runId);
  await upsertAgentRunDatasetReview({
    workspacePath: input.workspacePath,
    runId,
    review: { reviewer: review.reviewer, reviewed_at: review.reviewedAt },
    fallbackRow: buildAgentRunDatasetRow(manifest, receipts),
  });
  return review;
}

function normalizeReview(value: unknown, runId: string): AgentRunReviewAnnotation | null {
  if (!value || typeof value !== 'object') return null;
  const review = value as Partial<AgentRunReviewAnnotation>;
  if (
    review.version !== 1 ||
    review.runId !== runId ||
    typeof review.reviewer !== 'string' ||
    !review.reviewer.trim() ||
    typeof review.reviewedAt !== 'string'
  ) {
    return null;
  }
  return { version: 1, runId, reviewer: review.reviewer.trim(), reviewedAt: review.reviewedAt };
}
