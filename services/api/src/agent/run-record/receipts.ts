/** Tool receipts: record, read, and summarize component reuse. */
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveInside } from '@sber-designer/ast-bridge';
import type { ComponentReuseRunSummary } from '@sber-designer/shared-types';
import type { AgentToolReceipt, RecordToolReceiptInput } from './types';
import {
  appendTimeline,
  createReceiptId,
  requireRunId,
  requireWorkspacePath,
  runRoot,
  touchManifest,
  uniqueSorted,
  writeJson,
} from './store';

export async function recordToolReceipt(input: RecordToolReceiptInput): Promise<AgentToolReceipt> {
  const workspacePath = requireWorkspacePath(input.workspacePath);
  const runId = requireRunId(input.runId);
  const now = Date.now();
  const receiptId = createReceiptId(input.tool);
  const receipt: AgentToolReceipt = {
    version: 1,
    runId,
    receiptId,
    tool: input.tool,
    status: input.status,
    changedFiles: [...(input.changedFiles ?? [])],
    summary: input.summary ?? null,
    metadata: input.metadata ?? {},
    createdAt: now,
  };
  const root = runRoot(workspacePath, runId);
  await mkdir(resolveInside(root, 'receipts'), { recursive: true });
  await writeJson(resolveInside(root, join('receipts', `${receiptId}.json`)), receipt);
  await touchManifest(workspacePath, runId, now);
  await appendTimeline(workspacePath, runId, {
    type: 'tool_receipt',
    runId,
    receiptId,
    tool: input.tool,
    status: input.status,
    changedFiles: receipt.changedFiles,
    ...(receipt.summary ? { summary: receipt.summary } : {}),
    createdAt: now,
  });
  return receipt;
}

export async function recordToolReceiptSafely(input: RecordToolReceiptInput): Promise<void> {
  if (!input.workspacePath || !input.runId) return;
  await recordToolReceipt(input).catch(() => undefined);
}

export function summarizeComponentReuseFromReceipts(
  receipts: AgentToolReceipt[],
): ComponentReuseRunSummary | null {
  const summaries = receipts
    .map((receipt) => receipt.metadata?.componentReuse)
    .filter((value): value is ComponentReuseReceiptSummary =>
      Boolean(value && typeof value === 'object'),
    );
  if (summaries.length === 0) return null;
  const expected = uniqueSorted(summaries.flatMap((summary) => stringArray(summary.expected)));
  const used = uniqueSorted(summaries.flatMap((summary) => stringArray(summary.used)));
  const missing = uniqueSorted(summaries.flatMap((summary) => stringArray(summary.missing)));
  const exact = uniqueSorted(summaries.flatMap((summary) => stringArray(summary.exact)));
  const substituted = uniqueComponentReuseObjects(
    summaries.flatMap((summary) => componentReuseSubstitutionArray(summary.substituted)),
  );
  const skipped = uniqueComponentReuseObjects(
    summaries.flatMap((summary) => componentReuseSkippedArray(summary.skipped)),
  );
  const requiredRoles = uniqueSorted(
    summaries.flatMap((summary) => stringArray(summary.requiredRoles)),
  );
  const usedComponentIds = uniqueSorted(
    summaries.flatMap((summary) => stringArray(summary.usedComponentIds)),
  );
  const missingRequiredRoles = uniqueSorted(
    summaries.flatMap((summary) => stringArray(summary.missingRequiredRoles)),
  );
  const designSystemGaps = uniqueSorted(
    summaries.flatMap((summary) => stringArray(summary.designSystemGaps)),
  );
  const optionalSkipped = uniqueComponentReuseObjects(
    summaries.flatMap((summary) => componentReuseSkippedArray(summary.optionalSkipped)),
  );
  const score = mergeComponentReuseScore(
    summaries
      .map((summary) => componentReuseScore(summary.score))
      .filter((value): value is NonNullable<ComponentReuseRunSummary['score']> => Boolean(value)),
  );
  if (
    expected.length === 0 &&
    used.length === 0 &&
    missing.length === 0 &&
    exact.length === 0 &&
    substituted.length === 0 &&
    skipped.length === 0 &&
    requiredRoles.length === 0 &&
    usedComponentIds.length === 0 &&
    missingRequiredRoles.length === 0 &&
    designSystemGaps.length === 0 &&
    optionalSkipped.length === 0
  ) {
    return null;
  }
  return {
    expected,
    used,
    missing,
    ...(exact.length > 0 ? { exact } : {}),
    ...(substituted.length > 0 ? { substituted } : {}),
    ...(skipped.length > 0 ? { skipped } : {}),
    ...(requiredRoles.length > 0 ? { requiredRoles } : {}),
    ...(usedComponentIds.length > 0 ? { usedComponentIds } : {}),
    ...(missingRequiredRoles.length > 0 ? { missingRequiredRoles } : {}),
    ...(designSystemGaps.length > 0 ? { designSystemGaps } : {}),
    ...(optionalSkipped.length > 0 ? { optionalSkipped } : {}),
    ...(score ? { score } : {}),
  };
}

type ComponentReuseReceiptSummary = {
  expected?: unknown;
  used?: unknown;
  missing?: unknown;
  exact?: unknown;
  substituted?: unknown;
  skipped?: unknown;
  requiredRoles?: unknown;
  usedComponentIds?: unknown;
  missingRequiredRoles?: unknown;
  designSystemGaps?: unknown;
  optionalSkipped?: unknown;
  score?: unknown;
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function componentReuseSubstitutionArray(
  value: unknown,
): NonNullable<ComponentReuseRunSummary['substituted']> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (typeof record.role !== 'string' || typeof record.expected !== 'string') return [];
    return [
      {
        role: record.role,
        expected: record.expected,
        ...(typeof record.componentId === 'string' ? { componentId: record.componentId } : {}),
        used: stringArray(record.used),
      },
    ];
  });
}

function componentReuseSkippedArray(
  value: unknown,
): NonNullable<ComponentReuseRunSummary['skipped']> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (typeof record.role !== 'string' || typeof record.expected !== 'string') return [];
    return [
      {
        role: record.role,
        expected: record.expected,
        ...(typeof record.componentId === 'string' ? { componentId: record.componentId } : {}),
      },
    ];
  });
}

function componentReuseScore(value: unknown): ComponentReuseRunSummary['score'] | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.earned !== 'number' || typeof record.total !== 'number') return null;
  return {
    earned: record.earned,
    total: record.total,
    label:
      typeof record.label === 'string'
        ? record.label
        : `${Number.isInteger(record.earned) ? record.earned : record.earned.toFixed(1)}/${record.total}`,
  };
}

function uniqueComponentReuseObjects<T extends { role: string; expected: string }>(
  values: T[],
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const value of values) {
    const key = `${value.role}\u0000${value.expected}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result.sort((a, b) => a.expected.localeCompare(b.expected));
}

function mergeComponentReuseScore(
  scores: NonNullable<ComponentReuseRunSummary['score']>[],
): ComponentReuseRunSummary['score'] | null {
  if (scores.length === 0) return null;
  const earned = Math.round(scores.reduce((sum, score) => sum + score.earned, 0) * 10) / 10;
  const total = scores.reduce((sum, score) => sum + score.total, 0);
  return {
    earned,
    total,
    label: `${Number.isInteger(earned) ? earned : earned.toFixed(1)}/${total}`,
  };
}

export async function readAgentRunReceipts(
  workspacePath: string,
  runId: string,
): Promise<AgentToolReceipt[]> {
  return readRunReceipts(workspacePath, runId);
}

export async function readRunReceipts(
  workspacePath: string,
  runId: string,
): Promise<AgentToolReceipt[]> {
  const receiptsRoot = resolveInside(runRoot(workspacePath, runId), 'receipts');
  let files: string[] = [];
  try {
    files = await readdir(receiptsRoot);
  } catch {
    return [];
  }
  const receipts: AgentToolReceipt[] = [];
  for (const file of files.filter((name) => name.endsWith('.json')).sort()) {
    try {
      receipts.push(JSON.parse(await readFile(resolveInside(receiptsRoot, file), 'utf8')));
    } catch {
      // Ignore malformed receipts in handoff generation; the raw file remains available.
    }
  }
  return receipts;
}
