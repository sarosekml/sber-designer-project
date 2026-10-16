/** Project-owned normalized dataset rows for completed agent runs (0114 B5). */
import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { resolveInside } from '@sber-designer/ast-bridge';
import type { AgentRunManifest, AgentToolReceipt } from './types';

export const RUNS_DATASET_PATH = '.sber-designer/runs-dataset.jsonl';
const datasetMutations = new Map<string, Promise<void>>();

export interface AgentRunDatasetFeedback {
  rating: 'up' | 'down';
  reason: string | null;
  updated_at: string;
}

export interface AgentRunDatasetReview {
  reviewer: string;
  reviewed_at: string;
}

export interface AgentRunDatasetRow {
  version: 1;
  run_id: string;
  started_at: string;
  completed_at: string;
  status: AgentRunManifest['status'];
  route: AgentRunManifest['route'];
  provider: string | null;
  model: string | null;
  runtime_kind: AgentRunManifest['runtimeKind'];
  project_name: string | null;
  profile: NonNullable<AgentRunManifest['projectProfile']>['kind'] | null;
  screen_id: string | null;
  screen_name: string | null;
  screen_ids?: string[];
  screen_attribution?: Record<string, 'active-screen' | 'receipt' | 'changed-files'>;
  session_mode?: string | null;
  cost_usd?: number | null;
  attachments?: Array<{
    kind: 'image' | 'text';
    name: string;
    document_kind?: 'html' | 'css' | 'markdown' | 'json' | 'yaml' | 'plain';
    mime_type: string;
    size: number;
    sha256: string;
  }> | null;
  logs?: {
    run_dir: string;
    attempt_log?: string;
    debug_log?: string;
  } | null;
  gates: {
    craft: string | null;
    render: string | null;
    source_integrity: string | null;
    design_system_fit: string | null;
    design_mode_compatibility: string | null;
  };
  reuse: {
    ratio: number | null;
    earned: number | null;
    total: number | null;
    label: string | null;
    expected: number;
    used: number;
    missing: number;
  } | null;
  craft_blocking: number | null;
  jury_composite: number | null;
  token_usage: {
    total: number | null;
    input: number | null;
    output: number | null;
    iterations: number | null;
  };
  feedback: AgentRunDatasetFeedback | null;
  review: AgentRunDatasetReview | null;
}

export function buildAgentRunDatasetRow(
  manifest: AgentRunManifest,
  receipts: readonly AgentToolReceipt[],
): AgentRunDatasetRow {
  const craft = latestReceipt(receipts, 'validate_screen_craft');
  const craftMetadata = craft?.metadata ?? {};
  const categoryResults = objectValue(craftMetadata.categoryResults);
  const reuse = objectValue(craftMetadata.componentReuse) ?? objectValue(manifest.componentReuse);
  const score = objectValue(reuse?.score);
  const earned = finiteNumber(score?.earned);
  const total = finiteNumber(score?.total);
  return {
    version: 1,
    run_id: manifest.runId,
    started_at: isoTimestamp(manifest.metrics?.startedAt ?? manifest.createdAt),
    completed_at: isoTimestamp(
      manifest.metrics?.completedAt ?? manifest.completedAt ?? manifest.updatedAt,
    ),
    status: manifest.status,
    route: manifest.route,
    provider: manifest.provider,
    model: manifest.model,
    runtime_kind: manifest.runtimeKind,
    project_name: manifest.projectName,
    profile: manifest.projectProfile?.kind ?? null,
    screen_id: manifest.activeScreen?.id ?? null,
    screen_name: manifest.activeScreen?.name ?? null,
    screen_ids:
      manifest.affectedScreenIds ?? (manifest.activeScreen ? [manifest.activeScreen.id] : []),
    screen_attribution:
      manifest.affectedScreenAttribution ??
      (manifest.activeScreen ? { [manifest.activeScreen.id]: 'active-screen' } : {}),
    session_mode: manifest.sessionMode ?? null,
    cost_usd: finiteNumber(manifest.metrics?.costUsd),
    attachments: (manifest.promptAttachments ?? []).map((attachment) => ({
      kind: attachment.kind === 'text' ? 'text' : 'image',
      name: attachment.name,
      ...(attachment.kind === 'text' ? { document_kind: attachment.documentKind } : {}),
      mime_type: attachment.mimeType,
      size: attachment.size,
      sha256: attachment.sha256,
    })),
    logs: {
      run_dir: `.sber-designer/runs/${manifest.runId}`,
      ...optionalLogPath(
        'attempt_log',
        manifest.workspacePath,
        manifest.diagnostics?.attemptLogPath,
      ),
      ...optionalLogPath('debug_log', manifest.workspacePath, manifest.diagnostics?.debugLogPath),
    },
    gates: {
      craft: stringValue(craftMetadata.status),
      render: manifest.diagnostics?.renderProof?.status ?? null,
      source_integrity: categoryStatus(categoryResults, 'sourceIntegrity'),
      design_system_fit: categoryStatus(categoryResults, 'designSystemFit'),
      design_mode_compatibility: categoryStatus(categoryResults, 'designModeCompatibility'),
    },
    reuse: reuse
      ? {
          ratio: earned !== null && total !== null && total > 0 ? round(earned / total) : null,
          earned,
          total,
          label: stringValue(score?.label),
          expected: stringArrayLength(reuse.expected),
          used: stringArrayLength(reuse.used),
          missing: stringArrayLength(reuse.missing),
        }
      : null,
    craft_blocking: nonnegativeInteger(craftMetadata.blocking),
    jury_composite: latestJuryComposite(manifest, receipts),
    // Design Jury usage is already folded into manifest.metrics by the
    // terminal event merger. Never add diagnostics.designJury again here.
    token_usage: {
      total: nonnegativeInteger(manifest.metrics?.totalTokens),
      input: nonnegativeInteger(manifest.metrics?.inputTokens),
      output: nonnegativeInteger(manifest.metrics?.outputTokens),
      iterations: nonnegativeInteger(manifest.metrics?.iterations),
    },
    feedback: null,
    review: null,
  };
}

function optionalLogPath(
  key: 'attempt_log' | 'debug_log',
  workspacePath: string,
  path: string | undefined,
): Partial<Record<'attempt_log' | 'debug_log', string>> {
  if (!path?.trim()) return {};
  const normalized = workspaceRelativeLogPath(workspacePath, path.trim());
  return { [key]: normalized };
}

function workspaceRelativeLogPath(workspacePath: string, path: string): string {
  if (!isAbsolute(path)) return path.replace(/\\/gu, '/').replace(/^\.\//u, '');
  const workspaceRelative = relative(resolve(workspacePath), resolve(path));
  return !workspaceRelative.startsWith('..') && !isAbsolute(workspaceRelative)
    ? workspaceRelative.replace(/\\/gu, '/')
    : path;
}

export async function appendAgentRunDatasetRowOnce(
  workspacePath: string,
  row: AgentRunDatasetRow,
): Promise<boolean> {
  const path = resolveInside(workspacePath, RUNS_DATASET_PATH);
  return serializeDatasetMutation(path, async () => {
    const existing = await readFile(path, 'utf8').catch(() => '');
    if (datasetContainsRun(existing, row.run_id)) return false;
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify(row)}\n`, 'utf8');
    return true;
  });
}

export async function upsertAgentRunDatasetFeedback(input: {
  workspacePath: string;
  runId: string;
  feedback: AgentRunDatasetFeedback;
  fallbackRow: AgentRunDatasetRow;
}): Promise<void> {
  const path = resolveInside(input.workspacePath, RUNS_DATASET_PATH);
  await serializeDatasetMutation(path, async () => {
    const contents = await readFile(path, 'utf8').catch(() => '');
    const lines = contents.split(/\r?\n/gu).filter((line) => line.trim());
    let found = false;
    const updated = lines.map((line) => {
      try {
        const row = JSON.parse(line) as Record<string, unknown>;
        if (row.run_id !== input.runId) return line;
        found = true;
        return JSON.stringify({ ...row, feedback: input.feedback });
      } catch {
        return line;
      }
    });
    if (!found) {
      updated.push(JSON.stringify({ ...input.fallbackRow, feedback: input.feedback }));
    }
    await mkdir(dirname(path), { recursive: true });
    const temporaryPath = resolveInside(
      input.workspacePath,
      `${RUNS_DATASET_PATH}.${randomUUID()}.tmp`,
    );
    await writeFile(temporaryPath, `${updated.join('\n')}\n`, 'utf8');
    await rename(temporaryPath, path);
  });
}

export async function upsertAgentRunDatasetReview(input: {
  workspacePath: string;
  runId: string;
  review: AgentRunDatasetReview;
  fallbackRow: AgentRunDatasetRow;
}): Promise<void> {
  const path = resolveInside(input.workspacePath, RUNS_DATASET_PATH);
  await serializeDatasetMutation(path, async () => {
    const contents = await readFile(path, 'utf8').catch(() => '');
    const lines = contents.split(/\r?\n/gu).filter((line) => line.trim());
    let found = false;
    const updated = lines.map((line) => {
      try {
        const row = JSON.parse(line) as Record<string, unknown>;
        if (row.run_id !== input.runId) return line;
        found = true;
        return JSON.stringify({ ...row, review: input.review });
      } catch {
        return line;
      }
    });
    if (!found) updated.push(JSON.stringify({ ...input.fallbackRow, review: input.review }));
    await mkdir(dirname(path), { recursive: true });
    const temporaryPath = resolveInside(
      input.workspacePath,
      `${RUNS_DATASET_PATH}.${randomUUID()}.tmp`,
    );
    await writeFile(temporaryPath, `${updated.join('\n')}\n`, 'utf8');
    await rename(temporaryPath, path);
  });
}

function datasetContainsRun(contents: string, runId: string): boolean {
  return contents.split(/\r?\n/gu).some((line) => {
    if (!line.trim()) return false;
    try {
      const parsed = JSON.parse(line) as { run_id?: unknown };
      return parsed.run_id === runId;
    } catch {
      return false;
    }
  });
}

function latestJuryComposite(
  manifest: AgentRunManifest,
  receipts: readonly AgentToolReceipt[],
): number | null {
  const diagnosticScore = juryScore(manifest.diagnostics?.designJury?.juryComposite);
  if (diagnosticScore !== null) return diagnosticScore;
  let latest: number | null = null;
  for (const receipt of [...receipts].sort((a, b) => a.createdAt - b.createdAt)) {
    if (receipt.tool !== 'jury_round' || receipt.status !== 'ok') continue;
    const metadata = receipt.metadata;
    const score =
      juryScore(metadata.juryComposite) ?? juryScore(objectValue(metadata.designJury)?.composite);
    if (score !== null) latest = score;
  }
  return latest;
}

function latestReceipt(
  receipts: readonly AgentToolReceipt[],
  tool: string,
): AgentToolReceipt | null {
  return (
    [...receipts]
      .filter((receipt) => receipt.tool === tool)
      .sort((a, b) => a.createdAt - b.createdAt)
      .at(-1) ?? null
  );
}

function categoryStatus(
  categories: Record<string, unknown> | null,
  category: string,
): string | null {
  return stringValue(objectValue(categories?.[category])?.status);
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nonnegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function juryScore(value: unknown): number | null {
  const score = finiteNumber(value);
  return score !== null && score >= 0 && score <= 10 ? score : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string').length : 0;
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function isoTimestamp(value: number): string {
  return new Date(value).toISOString();
}

async function serializeDatasetMutation<T>(path: string, mutate: () => Promise<T>): Promise<T> {
  const previous = datasetMutations.get(path) ?? Promise.resolve();
  const operation = previous.catch(() => undefined).then(mutate);
  const tail = operation.then(
    () => undefined,
    () => undefined,
  );
  datasetMutations.set(path, tail);
  try {
    return await operation;
  } finally {
    if (datasetMutations.get(path) === tail) datasetMutations.delete(path);
  }
}
