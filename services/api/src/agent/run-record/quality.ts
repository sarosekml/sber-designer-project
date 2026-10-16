import type {
  RunQualitySummary,
  RunQualityTerminalStatus,
  RunRedesignFidelitySummary,
  ScreenReadinessCategoryId,
  ScreenReadinessCategoryStatus,
} from '@sber-designer/shared-types';

import { readRunReceipts, recordToolReceiptSafely } from './receipts';
import type { AgentRunDiagnostics, AgentToolReceipt } from './types';

export async function buildAndRecordRunQualitySummary(input: {
  workspacePath: string | null;
  runId: string | null | undefined;
  terminalStatus: RunQualityTerminalStatus;
  diagnostics?: AgentRunDiagnostics | null;
}): Promise<RunQualitySummary> {
  const receipts =
    input.workspacePath && input.runId
      ? await readRunReceipts(input.workspacePath, input.runId).catch(() => [])
      : [];
  const summary = buildRunQualitySummary({
    terminalStatus: input.terminalStatus,
    ...(input.diagnostics !== undefined ? { diagnostics: input.diagnostics } : {}),
    receipts,
  });
  await recordToolReceiptSafely({
    workspacePath: input.workspacePath,
    runId: input.runId,
    tool: 'quality_summary',
    status:
      summary.terminalStatus === 'failed' || summary.remainingFindings.blocking > 0
        ? 'error'
        : 'ok',
    summary: formatRunQualitySummary(summary),
    metadata: { qualitySummary: summary },
  });
  return summary;
}

export function buildRunQualitySummary(input: {
  terminalStatus: RunQualityTerminalStatus;
  diagnostics?: AgentRunDiagnostics | null;
  receipts: readonly AgentToolReceipt[];
}): RunQualitySummary {
  const craft = latestReceipt(input.receipts, 'validate_screen_craft');
  const designMode = latestReceipt(input.receipts, 'validate_design_screen');
  const fidelity = latestReceipt(input.receipts, 'screen_redesign_fidelity');
  const repairReceipts = input.receipts.filter(
    (receipt) => receipt.tool === 'automatic_craft_repair',
  );
  const repairSucceeded = booleanValue(repairReceipts.at(-1)?.metadata.succeeded);
  const categories = readinessCategories(craft?.metadata.categoryResults);
  const craftStatus = craftStatusFromReceipt(craft);
  const findings = {
    blocking: nonnegativeInteger(craft?.metadata.blocking) ?? 0,
    shouldFix: nonnegativeInteger(craft?.metadata.shouldFix) ?? 0,
    advisory: nonnegativeInteger(craft?.metadata.advisory) ?? 0,
  };
  const designModeStatus = designModeStatusFromReceipt(designMode);
  const renderStatus = input.diagnostics?.renderProof?.status ?? 'unavailable';
  const jury = input.diagnostics?.designJury;
  const redesignFidelity = redesignFidelityFromReceipt(fidelity);
  const skippedChecks = [
    ...categories
      .filter((category) => category.status === 'skipped')
      .map((category) => category.id),
    ...(designModeStatus === 'unavailable' ? ['designModeCompatibility'] : []),
    ...(renderStatus === 'unavailable' || renderStatus === 'pending' ? ['renderHealth'] : []),
    ...(redesignFidelity?.status === 'unavailable' ? ['screenRedesignFidelity'] : []),
  ];
  return {
    version: 1,
    terminalStatus: input.terminalStatus,
    repair: {
      attempted: repairReceipts.length > 0,
      attempts: repairReceipts.length,
      succeeded: repairReceipts.length > 0 ? repairSucceeded : null,
    },
    remainingFindings: findings,
    skippedChecks: [...new Set(skippedChecks)],
    craft: { status: craftStatus, categories },
    designMode: { status: designModeStatus },
    render: {
      status: renderStatus,
      ...(input.diagnostics?.renderProof?.reason
        ? { reason: input.diagnostics.renderProof.reason }
        : {}),
    },
    jury: jury
      ? {
          status: jury.status,
          rounds: jury.rounds,
          revisionAttempted: jury.revisionAttempted,
        }
      : { status: 'not_run', rounds: 0, revisionAttempted: false },
    ...(redesignFidelity ? { redesignFidelity } : {}),
  };
}

export function formatRunQualitySummary(summary: RunQualitySummary): string {
  const repair = summary.repair.attempted
    ? summary.repair.succeeded
      ? 'repair succeeded'
      : 'repair attempted'
    : 'no repair';
  const findings = summary.remainingFindings;
  const jury =
    summary.jury.status === 'not_run'
      ? 'Jury not run'
      : `Jury ${summary.jury.status}${summary.jury.revisionAttempted ? ' after revision' : ''}`;
  return [
    `Quality: ${repair}`,
    `${findings.blocking} blocking · ${findings.shouldFix} should-fix · ${findings.advisory} advisory`,
    summary.skippedChecks.length > 0
      ? `skipped ${summary.skippedChecks.join(', ')}`
      : 'no skipped checks',
    jury,
  ].join(' · ');
}

function latestReceipt(
  receipts: readonly AgentToolReceipt[],
  tool: string,
): AgentToolReceipt | null {
  return (
    [...receipts]
      .filter((receipt) => receipt.tool === tool)
      .sort((left, right) => left.createdAt - right.createdAt)
      .at(-1) ?? null
  );
}

function craftStatusFromReceipt(
  receipt: AgentToolReceipt | null,
): RunQualitySummary['craft']['status'] {
  const status = stringValue(receipt?.metadata.status);
  return status === 'passed' ||
    status === 'findings' ||
    status === 'blocked' ||
    status === 'missing'
    ? status
    : 'missing';
}

function designModeStatusFromReceipt(
  receipt: AgentToolReceipt | null,
): RunQualitySummary['designMode']['status'] {
  const status = stringValue(receipt?.metadata.status);
  return status === 'compatible' || status === 'needs-review' || status === 'missing'
    ? status
    : 'unavailable';
}

function readinessCategories(value: unknown): RunQualitySummary['craft']['categories'] {
  const categories = objectValue(value);
  if (!categories) return [];
  return Object.entries(categories).flatMap(([id, raw]) => {
    const status = stringValue(objectValue(raw)?.status);
    if (!isReadinessCategoryId(id) || !isReadinessStatus(status)) return [];
    return [{ id, status }];
  });
}

function redesignFidelityFromReceipt(
  receipt: AgentToolReceipt | null,
): RunRedesignFidelitySummary | null {
  const value = objectValue(receipt?.metadata.redesignFidelity);
  const status = stringValue(value?.status);
  if (status !== 'passed' && status !== 'failed' && status !== 'unavailable') return null;
  return {
    status,
    changedComposition: booleanValue(value?.changedComposition) ?? false,
    missingSections: stringArray(value?.missingSections),
    missingFacts: stringArray(value?.missingFacts),
    missingActions: stringArray(value?.missingActions),
    missingStates: stringArray(value?.missingStates),
    missingRoutes: stringArray(value?.missingRoutes),
  };
}

function isReadinessCategoryId(value: string): value is ScreenReadinessCategoryId {
  return [
    'sourceIntegrity',
    'renderHealth',
    'designSystemFit',
    'dataHonesty',
    'operationalUxStates',
    'accessibilityBasics',
    'responsiveVisualSanity',
    'designModeCompatibility',
  ].includes(value);
}

function isReadinessStatus(value: string | null): value is ScreenReadinessCategoryStatus {
  return ['passed', 'findings', 'blocked', 'disabled', 'skipped', 'missing'].includes(value ?? '');
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function nonnegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}
