/**
 * User-facing notices appended to an external-runtime turn (0136 R12 —
 * extracted from external.ts).
 *
 * When the product retries, repairs, or runs close to a context budget, the
 * transcript has to say so in the user's own terms — a silent retry reads as
 * the agent doing nothing. These builders own that wording, plus the
 * context-budget diagnostics the notices are derived from.
 */
import type { AgentContextBudgetPolicy } from '@sber-designer/llm-gateway';
import {
  type AgentRunContextBudgetDiagnostics,
  type AgentRunRuntimeMcpToolHealth,
  type CompleteAgentRunInput,
} from '../../agent/run-recorder';
import { type AgentStreamEvent } from '../../agent/stream';
import { appendNoticeToDoneEvent } from './sse';
import { formatRuntimeMcpHealthNotice } from './external-dispatch';
import { EXTERNAL_RUNTIME_CONTEXT_TOKEN_WARNING_THRESHOLD } from './external';

export function formatExternalRuntimeNoTargetRetryNotice(
  runtimeLabel: string,
  summary: string,
): string {
  const noVisibleWrite = summary.includes('no_visible_write');
  return [
    '',
    '',
    noVisibleWrite
      ? `sber-designer: ${runtimeLabel} made no first visible implementation write.`
      : `sber-designer: ${runtimeLabel} changed no allowed target files.`,
    noVisibleWrite
      ? 'Retrying a focused first-edit pass before marking the run failed.'
      : 'Retrying a focused edit pass before marking the run failed.',
    `Previous validation: ${summary}`,
    '',
  ].join('\n');
}

export function formatExternalRuntimeResumeRetryNotice(
  runtimeLabel: string,
  reason: string,
): string {
  return [
    '',
    '',
    `sber-designer: ${runtimeLabel} session resume failed.`,
    'Retrying once with a full-context handoff and a fresh runtime session.',
    `Previous error: ${reason}`,
    '',
  ].join('\n');
}

export function formatExternalRuntimeComponentGapRepairNotice(input: {
  runtimeLabel: string;
  role: string;
  reason: string;
}): string {
  return [
    '',
    '',
    `sber-designer: ${input.runtimeLabel} found a design-system gap for ${input.role}.`,
    'Running the single bounded retrieve → hydrate → repair pass.',
    `Reason: ${input.reason}`,
    '',
  ].join('\n');
}

export function formatExternalRuntimeRenderRepairNotice(input: {
  runtimeLabel: string;
  reason: string;
  changedFiles: string[];
  attempt: number;
  maxAttempts: number;
}): string {
  return [
    '',
    '',
    `sber-designer: ${input.runtimeLabel} render verification failed.`,
    `Running automatic repair pass ${input.attempt}/${input.maxAttempts}.`,
    `Reason: ${input.reason}`,
    `Changed files: ${input.changedFiles.join(', ') || 'unknown'}.`,
    '',
  ].join('\n');
}

export function formatExternalRuntimeCraftRepairNotice(input: {
  runtimeLabel: string;
  summary: string;
}): string {
  return [
    '',
    '',
    `sber-designer: ${input.runtimeLabel} left blocking craft findings.`,
    'Running the single bounded automatic craft repair.',
    `Reason: ${input.summary}`,
    '',
  ].join('\n');
}

export function appendRuntimeMcpHealthNotice<
  T extends {
    event: unknown;
    preEvents?: AgentStreamEvent[];
    status: CompleteAgentRunInput['status'];
    summary: string;
  },
>(
  finalized: T,
  health: AgentRunRuntimeMcpToolHealth | undefined,
  iteration: number,
  runManifestPath?: string | null,
): T {
  const notice = formatRuntimeMcpHealthNotice({ health, runManifestPath });
  if (!notice) return finalized;
  return {
    ...finalized,
    preEvents: [
      ...(finalized.preEvents ?? []),
      {
        type: 'text-delta',
        iteration,
        delta: notice,
      },
    ],
    event: appendNoticeToDoneEvent(
      finalized.event as Extract<AgentStreamEvent, { type: 'done' }>,
      notice,
    ),
    summary: `${finalized.summary} ${health?.detail ?? 'Project MCP tools were unavailable.'}`,
  };
}

export function appendContextBudgetNotice<
  T extends {
    event: unknown;
    preEvents?: AgentStreamEvent[];
    status: CompleteAgentRunInput['status'];
    summary: string;
  },
>(finalized: T, contextBudget: AgentRunContextBudgetDiagnostics | null, iteration: number): T {
  if (!contextBudget || contextBudget.status !== 'warning') return finalized;
  const notice = formatContextBudgetNotice(contextBudget);
  return {
    ...finalized,
    preEvents: [
      ...(finalized.preEvents ?? []),
      {
        type: 'text-delta',
        iteration,
        delta: notice,
      },
    ],
    event: appendNoticeToDoneEvent(
      finalized.event as Extract<AgentStreamEvent, { type: 'done' }>,
      notice,
    ),
    summary: `${finalized.summary} ${contextBudget.detail}`,
  };
}

export function contextBudgetDiagnosticsForDoneEvent(
  event: Extract<AgentStreamEvent, { type: 'done' }>,
  policy?: AgentContextBudgetPolicy,
): AgentRunContextBudgetDiagnostics | null {
  const thresholdTokens = resolveExternalRuntimeContextTokenWarningThreshold(policy);
  const usage = event.usage ?? {};
  const inputTokens = finiteTokenCount(usage.inputTokens);
  const outputTokens = finiteTokenCount(usage.outputTokens);
  const explicitTotalTokens = finiteTokenCount(usage.totalTokens);
  const totalTokens =
    explicitTotalTokens ??
    (inputTokens !== undefined && outputTokens !== undefined
      ? inputTokens + outputTokens
      : undefined);
  if (totalTokens === undefined || totalTokens <= thresholdTokens) return null;
  return {
    status: 'warning',
    thresholdTokens,
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    totalTokens,
    detail: `External runtime used ${formatTokenCount(totalTokens)} tokens, above the ${formatTokenCount(
      thresholdTokens,
    )} token warning threshold.`,
  };
}

export function resolveExternalRuntimeContextTokenWarningThreshold(
  policy?: AgentContextBudgetPolicy,
): number {
  if (policy?.warningTokens && policy.warningTokens > 0) return policy.warningTokens;
  const raw = process.env.SBER_DESIGNER_CONTEXT_TOKEN_WARNING_THRESHOLD;
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  return EXTERNAL_RUNTIME_CONTEXT_TOKEN_WARNING_THRESHOLD;
}

function finiteTokenCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : undefined;
}

function formatContextBudgetNotice(contextBudget: AgentRunContextBudgetDiagnostics): string {
  const totalTokens = contextBudget.totalTokens ?? 0;
  return [
    '',
    '',
    'sber-designer: Context budget warning.',
    `This external CLI run used ${formatTokenCount(
      totalTokens,
    )} tokens, above the ${formatTokenCount(
      contextBudget.thresholdTokens,
    )} token warning threshold.`,
    'Details: open the run manifest diagnostics.contextBudget before broadening future handoffs.',
  ].join('\n');
}

function formatTokenCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
