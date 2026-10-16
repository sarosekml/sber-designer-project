/** Terminal run feedback persisted for B5 observability and B4 preference memory. */
import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { resolveInside } from '@sber-designer/ast-bridge';
import { ensureProjectPreferencesDerived, PREFERENCE_EVENTS_PATH } from '../../project-preferences';
import {
  buildAgentRunDatasetRow,
  upsertAgentRunDatasetFeedback,
  type AgentRunDatasetFeedback,
} from './dataset';
import { readRunReceipts } from './receipts';
import { readRunManifest, requireRunId, runRoot, writeJson } from './store';

export const RUN_FEEDBACK_FILE = 'feedback.json';
export { PREFERENCE_EVENTS_PATH } from '../../project-preferences';

export interface AgentRunFeedback {
  version: 1;
  runId: string;
  rating: 'up' | 'down';
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export class AgentRunFeedbackError extends Error {
  constructor(
    readonly code: 'run_not_found' | 'run_not_terminal' | 'invalid_reason',
    message: string,
  ) {
    super(message);
    this.name = 'AgentRunFeedbackError';
  }
}

export async function readAgentRunFeedback(
  workspacePath: string,
  runId: string,
): Promise<AgentRunFeedback | null> {
  const path = resolveInside(runRoot(workspacePath, requireRunId(runId)), RUN_FEEDBACK_FILE);
  try {
    return normalizeStoredFeedback(JSON.parse(await readFile(path, 'utf8')), runId);
  } catch {
    return null;
  }
}

export async function saveAgentRunFeedback(input: {
  workspacePath: string;
  runId: string;
  rating: 'up' | 'down';
  reason?: string | null;
  now?: Date;
}): Promise<AgentRunFeedback> {
  const runId = requireRunId(input.runId);
  const manifest = await readRunManifest(input.workspacePath, runId);
  if (!manifest) {
    throw new AgentRunFeedbackError('run_not_found', `Agent run "${runId}" was not found.`);
  }
  if (manifest.status === 'running') {
    throw new AgentRunFeedbackError(
      'run_not_terminal',
      'Run feedback can be saved only after the agent run finishes.',
    );
  }
  const reason = normalizeReason(input.reason);
  const existing = await readAgentRunFeedback(input.workspacePath, runId);
  if (existing?.rating === input.rating && existing.reason === reason) {
    await ensureProjectPreferencesDerived(input.workspacePath).catch(() => undefined);
    return existing;
  }

  const timestamp = (input.now ?? new Date()).toISOString();
  const feedback: AgentRunFeedback = {
    version: 1,
    runId,
    rating: input.rating,
    reason,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  const feedbackPath = resolveInside(runRoot(input.workspacePath, runId), RUN_FEEDBACK_FILE);
  await writeJson(feedbackPath, feedback);

  const receipts = await readRunReceipts(input.workspacePath, runId);
  const datasetFeedback: AgentRunDatasetFeedback = {
    rating: feedback.rating,
    reason: feedback.reason,
    updated_at: feedback.updatedAt,
  };
  await upsertAgentRunDatasetFeedback({
    workspacePath: input.workspacePath,
    runId,
    feedback: datasetFeedback,
    fallbackRow: buildAgentRunDatasetRow(manifest, receipts),
  });
  await appendPreferenceFeedbackEvent(input.workspacePath, manifest, feedback);
  await ensureProjectPreferencesDerived(input.workspacePath).catch(() => undefined);
  return feedback;
}

async function appendPreferenceFeedbackEvent(
  workspacePath: string,
  manifest: NonNullable<Awaited<ReturnType<typeof readRunManifest>>>,
  feedback: AgentRunFeedback,
): Promise<void> {
  const path = resolveInside(workspacePath, PREFERENCE_EVENTS_PATH);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(
    path,
    `${JSON.stringify({
      version: 1,
      event_id: `run-feedback-${randomUUID()}`,
      type: 'run_feedback',
      created_at: feedback.updatedAt,
      run_id: feedback.runId,
      sentiment: feedback.rating === 'up' ? 'accept' : 'reject',
      reason: feedback.reason,
      screen_id: manifest.activeScreen?.id ?? null,
      screen_name: manifest.activeScreen?.name ?? null,
    })}\n`,
    'utf8',
  );
}

function normalizeStoredFeedback(value: unknown, runId: string): AgentRunFeedback | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<AgentRunFeedback>;
  if (
    record.version !== 1 ||
    record.runId !== runId ||
    (record.rating !== 'up' && record.rating !== 'down') ||
    typeof record.createdAt !== 'string' ||
    typeof record.updatedAt !== 'string'
  ) {
    return null;
  }
  return {
    version: 1,
    runId,
    rating: record.rating,
    reason: typeof record.reason === 'string' && record.reason.trim() ? record.reason.trim() : null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function normalizeReason(value: string | null | undefined): string | null {
  if (value === null || value === undefined || !value.trim()) return null;
  const reason = value.trim();
  if (reason.length > 240) {
    throw new AgentRunFeedbackError(
      'invalid_reason',
      'Run feedback reason is limited to 240 characters.',
    );
  }
  return reason;
}
