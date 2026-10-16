/** Run evidence: diagnostics, metrics, attempt-log links, attachments. */
import { type PromptAttachmentLimits } from '@sber-designer/llm-gateway';
import {
  normalizeAssistantTokenUsage,
  type PromptAttachmentEvidence,
  type PromptImageAttachmentEvidence,
  type PromptAttachmentUpload,
} from '@sber-designer/shared-types';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { resolveInside } from '@sber-designer/ast-bridge';
import { type AgentAttemptLogger, type AgentDevRunLogger } from '../../agent/dev-log';
import {
  agentRunManifestPath,
  type AgentRunManifest,
  type CompleteAgentRunInput,
} from '../../agent/run-recorder';
import { runRoot } from '../../agent/run-record/store';
import {
  readPromptAttachmentEvidenceFromContinuationMessages,
  writeRunContinuationContextSnapshot,
} from '../../agent/continuation-context';
import { appendRuntimeEventLogSafely } from '../../agent-runtimes/event-log';
import { type RuntimeUsageSummary } from '../../agent-runtimes/usage';
import { type AgentStreamEvent } from '../../agent/stream';
import {
  recordPromptAttachments,
  updateRunManifestPromptAttachments,
} from '../../prompt-attachments';
import { type EditorState } from '../../state-store';
import { activeTargetFromState } from './run-context';

export function runEvidenceDiagnostics(input: {
  diagnostics?: CompleteAgentRunInput['diagnostics'];
  attemptLogger: AgentAttemptLogger | null;
  devLogger: AgentDevRunLogger | null;
  agentRun: AgentRunManifest | null;
}): NonNullable<CompleteAgentRunInput['diagnostics']> {
  return {
    ...input.diagnostics,
    ...(input.attemptLogger
      ? {
          attemptId: input.attemptLogger.attemptId,
          attemptLogPath: input.attemptLogger.filePath,
        }
      : {}),
    ...(input.devLogger
      ? { debugLogPath: input.devLogger.filePath }
      : input.attemptLogger
        ? { debugLogPath: input.attemptLogger.filePath }
        : {}),
    ...(input.agentRun ? { runManifestPath: agentRunManifestPath(input.agentRun.runId) } : {}),
  };
}

export function runMetricsFromDoneEvent(
  event: Extract<AgentStreamEvent, { type: 'done' }>,
): CompleteAgentRunInput['metrics'] {
  const usage: RuntimeUsageSummary | undefined = event.usage ?? event.finalResponse.usage;
  const tokenUsage = normalizeAssistantTokenUsage(usage);
  return {
    iterations: event.iterations,
    ...tokenUsage,
    ...(usage?.costUsd !== undefined ? { costUsd: usage.costUsd } : {}),
  };
}

export async function linkAgentLogEvidence(
  attemptLogger: AgentAttemptLogger | null,
  devLogger: AgentDevRunLogger | null,
  agentRun: AgentRunManifest | null,
): Promise<void> {
  if (!attemptLogger || !devLogger || !agentRun) return;
  const runManifestPath = agentRunManifestPath(agentRun.runId);
  await Promise.all([
    attemptLogger.logLink({
      runId: agentRun.runId,
      devLogPath: devLogger.filePath,
      runManifestPath,
    }),
    devLogger.logLink({
      attemptId: attemptLogger.attemptId,
      attemptLogPath: attemptLogger.filePath,
      runManifestPath,
    }),
  ]).catch(() => undefined);
}

export async function recordPromptAttachmentsForRun(input: {
  workspacePath: string | null | undefined;
  agentRun: AgentRunManifest | null;
  attachments: PromptAttachmentUpload[];
  limits: PromptAttachmentLimits;
  messages: { id?: string; role: string; content: unknown }[];
  state: EditorState;
  sessionId: string;
  screenId: string;
}): Promise<PromptAttachmentEvidence[]> {
  if (!input.workspacePath || !input.agentRun) return [];
  const recordedEvidence = await recordPromptAttachments({
    workspacePath: input.workspacePath,
    runId: input.agentRun.runId,
    attachments: input.attachments,
    limits: input.limits,
  });
  const carriedEvidence =
    recordedEvidence.length > 0
      ? []
      : await readPromptAttachmentEvidenceFromContinuationMessages({
          workspacePath: input.workspacePath,
          messages: input.messages,
        });
  const evidence = recordedEvidence.length > 0 ? recordedEvidence : carriedEvidence;
  if (carriedEvidence.length > 0) {
    await updateRunManifestPromptAttachments(
      input.workspacePath,
      input.agentRun.runId,
      carriedEvidence,
    );
  }
  await writeRunContinuationContextSnapshot({
    workspacePath: input.workspacePath,
    runId: input.agentRun.runId,
    sessionId: input.sessionId,
    screenId: input.screenId,
    messages: input.messages,
    activeTarget: activeTargetFromState(input.state),
    attachments: evidence,
    runStatus: 'running',
  });
  return evidence;
}

export function codexImagePaths(attachments: PromptAttachmentEvidence[]): string[] {
  return attachments
    .filter((attachment) => attachment.kind !== 'text' && attachment.mimeType !== 'image/svg+xml')
    .map((attachment) => attachment.runPath);
}

export interface ExternalRuntimeAttachmentDelivery {
  id: string;
  kind: 'image';
  name: string;
  mimeType: string;
  size: number;
  sha256: string;
  runPath: string;
  deliveryMode: string;
  deliveredAsNativeInput: boolean;
  width?: number;
  height?: number;
}

export function externalRuntimeAttachmentDeliveries(input: {
  attachments: PromptAttachmentEvidence[];
  deliveryMode: string;
  imagePaths: string[];
}): ExternalRuntimeAttachmentDelivery[] {
  const delivered = new Set(input.imagePaths);
  return input.attachments
    .filter(
      (attachment): attachment is PromptImageAttachmentEvidence =>
        attachment.kind !== 'text' && attachment.mimeType !== 'image/svg+xml',
    )
    .map((attachment) => ({
      id: attachment.id,
      kind: 'image' as const,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      sha256: attachment.sha256,
      runPath: attachment.runPath,
      deliveryMode: delivered.has(attachment.runPath) ? input.deliveryMode : 'none',
      deliveredAsNativeInput:
        delivered.has(attachment.runPath) &&
        (input.deliveryMode === 'cli_native_arg' || input.deliveryMode === 'cli_native_file'),
      ...(attachment.width !== undefined ? { width: attachment.width } : {}),
      ...(attachment.height !== undefined ? { height: attachment.height } : {}),
    }));
}

export async function recordExternalRuntimeAttachmentDelivery(input: {
  workspacePath: string | null;
  agentRun: AgentRunManifest | null;
  runtime: string;
  deliveryMode: string;
  imagePaths: string[];
  attachments: PromptAttachmentEvidence[];
}): Promise<void> {
  if (!input.workspacePath || !input.agentRun) return;
  const deliveries = externalRuntimeAttachmentDeliveries({
    attachments: input.attachments,
    deliveryMode: input.deliveryMode,
    imagePaths: input.imagePaths,
  });
  if (deliveries.length === 0) return;
  const manifestPath = resolveInside(
    runRoot(input.workspacePath, input.agentRun.runId),
    'external-runtime/attachments.json',
  );
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    `${JSON.stringify({ version: 1, attachments: deliveries }, null, 2)}\n`,
    'utf8',
  );
  await appendRuntimeEventLogSafely({
    workspacePath: input.workspacePath,
    runId: input.agentRun.runId,
    runtime: input.runtime,
    event: {
      type: 'external-runtime-diagnostic',
      name: 'image_input_delivered',
      data: {
        imageCount: deliveries.length,
        deliveryMode: input.deliveryMode,
        imagePaths: input.imagePaths,
      },
    },
  });
}

export function formatPromptAttachmentValidationWarnings(
  warnings: { code: string; detail: string }[],
): string[] {
  return warnings.map((warning) => `${warning.code}: ${warning.detail}`);
}
