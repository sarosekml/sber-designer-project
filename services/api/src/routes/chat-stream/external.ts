/**
 * External CLI runtime handoff: prompt/context preparation, streaming,
 * watchdog, retry notices and finalization.
 */
import type { AgentContextBudgetPolicy } from '@sber-designer/llm-gateway';
import { type ScreenReadinessProfileInput } from '@sber-designer/shared-types';
import { createAgentAttemptLogger, type AgentAttemptLogger } from '../../agent/dev-log';
import {
  agentRunManifestPath,
  buildAndRecordRunQualitySummary,
  completeAgentRun,
  readRecordedComponentPack,
  recordRunTranscriptSafely,
  recordToolReceiptSafely,
  type AgentRunManifest,
  type AgentRunRuntimeSessionDiagnostics,
  type CompleteAgentRunInput,
} from '../../agent/run-recorder';
import { type AgentStreamEvent } from '../../agent/stream';
import { type AgentRunLease, type AgentRunRuntimeKind } from '../../agent/run-coordinator';
import { loadAgentKit } from '../../agent-kit/loader';
import { appendRuntimeEventLogSafely } from '../../agent-runtimes/event-log';
import { isRuntimePromptBudgetError } from '../../agent-runtimes/prompt-delivery';
import {
  type AgentKitHandoffResult,
  type ExternalRuntimeKind,
} from '../../agent-runtimes/agent-kit-handoff';
import { type RuntimeTargetSnapshot } from '../../agent-runtimes/change-validation';
import { isCliRuntimeProvider } from '../../agent-model-target';
import { type TaskRelevantComponentPack } from '../../component-intelligence/component-pack';
import { type EditorState } from '../../state-store';
import { appendNoticeToDoneEvent, withExternalRunMetadata, writeSSE } from './sse';
import { classifyRuntimeFailure } from '../../agent-runtimes/failure-taxonomy';
import type { ScreenCraftProfile } from '../../generation-mode';
import { componentPackRunSummary } from './run-context';
import { runMetricsFromDoneEvent } from './evidence';
import {
  type ExternalRuntimeVisualSnapshot,
  formatRunStatusBanner,
  readComponentReuseSummaryForRun,
} from './render-health';
import {
  finalizeExternalRuntimeDone,
  type ExternalRuntimeDoneFinalizationResult,
} from './external-finalization';
import {
  appendContextBudgetNotice,
  appendRuntimeMcpHealthNotice,
  contextBudgetDiagnosticsForDoneEvent,
  formatExternalRuntimeComponentGapRepairNotice,
  formatExternalRuntimeCraftRepairNotice,
  formatExternalRuntimeNoTargetRetryNotice,
  formatExternalRuntimeRenderRepairNotice,
  formatExternalRuntimeResumeRetryNotice,
} from './external-notices';

// Facade: these moved to ./external-prepare and ./external-notices in
// 0136 R12. './external' stays the import path for existing consumers.
export {
  prepareExternalRuntimeAgentKitContext,
  prepareExternalRuntimePrompt,
  prepareExternalRuntimeRun,
  resolvePreviousStableContextForHandoff,
} from './external-prepare';
export { resolveExternalRuntimeContextTokenWarningThreshold } from './external-notices';

export const EXTERNAL_RUNTIME_STAGE_WATCHDOG_MS = 10 * 60 * 1000;
export const EXTERNAL_RUNTIME_CONTEXT_TOKEN_WARNING_THRESHOLD = 200_000;
const EXTERNAL_RUNTIME_ITERATOR_CLOSE_TIMEOUT_MS = 100;

class ExternalRuntimeStageWatchdogError extends Error {
  readonly code = 'runtime_timeout';
}

export interface ExternalRuntimeRunContext {
  workspacePath: string | null;
  agentRun: AgentRunManifest | null;
  snapshots: RuntimeTargetSnapshot[];
  visualSnapshot: ExternalRuntimeVisualSnapshot;
}

interface ExternalRuntimeStreamInput {
  stream: {
    writeSSE(input: { data: string }): Promise<unknown> | unknown;
  };
  runtimeLabel: string;
  workspacePath: string | null;
  agentRun: AgentRunManifest | null;
  runDiagnostics?: CompleteAgentRunInput['diagnostics'];
  snapshots: RuntimeTargetSnapshot[];
  canvasUrl: string | null;
  visualSnapshot: ExternalRuntimeVisualSnapshot;
  componentPack?: TaskRelevantComponentPack | null;
  screenReadiness?: ScreenReadinessProfileInput | null;
  screenCraftProfile?: ScreenCraftProfile;
  selection?: EditorState['selection'] | null;
  events: AsyncIterable<AgentStreamEvent>;
  contextBudgetPolicy?: AgentContextBudgetPolicy;
  stageWatchdogMs?: number;
  signal?: AbortSignal;
  abortRuntime?: (reason: Error) => void;
  retryOnResumeFailure?: (input: {
    reason: string;
    attempt: number;
  }) => AsyncIterable<AgentStreamEvent>;
  retryOnNoTargetChanges?: (input: {
    summary: string;
    attempt: number;
  }) => AsyncIterable<AgentStreamEvent>;
  repairOnComponentGap?: (input: {
    role: string;
    reason: string;
    attempt: number;
    maxAttempts: number;
  }) => AsyncIterable<AgentStreamEvent>;
  repairOnRenderFailure?: (input: {
    reason: string;
    changedFiles: string[];
    attempt: number;
    maxAttempts: number;
  }) => AsyncIterable<AgentStreamEvent>;
  repairOnCraftFailure?: (input: {
    summary: string;
    findings: unknown[];
    attempt: number;
    maxAttempts: number;
  }) => AsyncIterable<AgentStreamEvent>;
  finalizeWithDesignJury?: (
    finalized: ExternalRuntimeDoneFinalizationResult,
    componentPack: TaskRelevantComponentPack | null | undefined,
  ) => Promise<ExternalRuntimeDoneFinalizationResult>;
  onTerminalStatus?: (input: {
    status: CompleteAgentRunInput['status'];
    summary: string;
    diagnostics?: CompleteAgentRunInput['diagnostics'];
    runtimeSession?: AgentRunRuntimeSessionDiagnostics | null;
  }) => Promise<void> | void;
}

export interface ExternalRuntimeAgentKitContext {
  kit: Awaited<ReturnType<typeof loadAgentKit>>;
  primaryAgentName: string;
  requestedAgentName?: string;
}

export function runtimeKindForProvider(provider: string): AgentRunRuntimeKind {
  return isCliRuntimeProvider(provider) ? 'cli' : 'api';
}

export function createRuntimeStdoutNoiseCounter(): {
  record: (reason: string) => void;
  snapshot: () => Record<string, number>;
} {
  const counts = new Map<string, number>();
  return {
    record: (reason) => {
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    },
    snapshot: () =>
      Object.fromEntries(
        [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)),
      ),
  };
}

export async function logRuntimeStdoutNoiseSummary(
  logger: Awaited<ReturnType<typeof createAgentAttemptLogger>>,
  runtime: ExternalRuntimeKind,
  counter: ReturnType<typeof createRuntimeStdoutNoiseCounter>,
): Promise<void> {
  const counts = counter.snapshot();
  if (Object.keys(counts).length === 0) return;
  await logger?.log('runtime.stdout_noise.filtered', {
    runtime,
    counts,
  });
}

export function runtimeAttemptLogger(
  logger: AgentAttemptLogger | null,
): ((event: string, data: Record<string, unknown>) => Promise<void>) | undefined {
  if (!logger) return undefined;
  return async (event, data) => {
    await logger.log(`runtime.${event}`, data);
  };
}

export async function writeExternalRuntimeContextEvent(
  stream: { writeSSE(input: { data: string }): Promise<unknown> | unknown },
  runtime: string,
  agentRun: AgentRunManifest | null,
  handoff: AgentKitHandoffResult,
): Promise<void> {
  await writeSSE(stream, {
    type: 'external-runtime-context',
    runtime,
    agent: handoff.agentName,
    skillInventoryCount: handoff.skillInventory.length,
    ...(handoff.runtimeWarnings.length > 0 ? { runtimeWarnings: handoff.runtimeWarnings } : {}),
    stableContextDigest: handoff.stableContextDigest,
    stableContextBytes: handoff.stableContextBytes,
    kitStableDigest: handoff.kitStableDigest,
    kitStableBytes: handoff.kitStableBytes,
    taskBytes: handoff.taskBytes,
    stableContextReuse: handoff.stableContextReuse,
    ...(handoff.previousStableContextBundlePath
      ? { previousStableContextBundlePath: handoff.previousStableContextBundlePath }
      : {}),
    ...(agentRun
      ? {
          contextBundlePath: `.sber-designer/runs/${agentRun.runId}/external-runtime/prompt.md`,
        }
      : {}),
    omittedSections: handoff.omittedSections,
  } satisfies AgentStreamEvent);
}

export async function writeRunStartedEvent(
  stream: { writeSSE(input: { data: string }): Promise<unknown> | unknown },
  lease: AgentRunLease | null,
  agentRun: AgentRunManifest | null,
  componentPack?: TaskRelevantComponentPack | null,
): Promise<void> {
  if (!lease) return;
  await writeSSE(stream, {
    type: 'run-started',
    clientRunId: lease.clientRunId,
    sessionId: lease.sessionId,
    screenId: lease.screenId,
    provider: lease.provider,
    model: lease.model,
    ...(agentRun
      ? { runId: agentRun.runId, runManifestPath: agentRunManifestPath(agentRun.runId) }
      : {}),
    ...(componentPack ? { componentPack: componentPackRunSummary(componentPack) } : {}),
  } satisfies AgentStreamEvent);
}

export async function streamExternalRuntimeHandoff(
  input: ExternalRuntimeStreamInput,
): Promise<void> {
  const stageWatchdogMs = resolveExternalRuntimeStageWatchdogMs(input);
  let runClosed = false;
  let sawError = false;
  let sawDone = false;
  let primaryFailure: {
    code: string;
    message: string;
  } | null = null;
  let retriedNoTargetChanges = false;
  let retriedResumeFailure = false;
  let componentGapRepairAttempted = false;
  let craftRepairAttempted = false;
  let craftRepairRecorded = false;
  let repairAttempts = 0;
  const maxRepairAttempts = 2;

  const completeRunOnce = async (
    status: CompleteAgentRunInput['status'],
    summary: string,
    metrics?: CompleteAgentRunInput['metrics'],
    diagnostics?: CompleteAgentRunInput['diagnostics'],
  ) => {
    if (runClosed) return;
    runClosed = true;
    await completeAgentRun({
      workspacePath: input.workspacePath,
      runId: input.agentRun?.runId,
      status,
      summary,
      ...(metrics ? { metrics } : {}),
      ...(input.runDiagnostics || diagnostics
        ? { diagnostics: { ...input.runDiagnostics, ...diagnostics } }
        : {}),
    }).catch(() => undefined);
    await Promise.resolve(
      input.onTerminalStatus?.({
        status,
        summary,
        ...(diagnostics ? { diagnostics } : {}),
        ...(input.runDiagnostics?.runtimeSession
          ? { runtimeSession: input.runDiagnostics.runtimeSession }
          : {}),
      }),
    ).catch(() => undefined);
  };
  const writeRuntimeEvent = async (event: AgentStreamEvent) => {
    await appendRuntimeEventLogSafely({
      workspacePath: input.workspacePath,
      runId: input.agentRun?.runId,
      runtime: input.runtimeLabel,
      event,
    });
    await writeSSE(input.stream, event);
  };

  let iterator: AsyncIterator<AgentStreamEvent> | null = null;
  try {
    iterator = input.events[Symbol.asyncIterator]();
    while (true) {
      const next = await nextExternalRuntimeEvent(iterator, input.runtimeLabel, stageWatchdogMs);
      if (next.done) break;
      const ev = next.value;
      if (input.signal?.aborted) {
        const message = 'Cancelled by user.';
        await completeRunOnce('cancelled', message, undefined, {
          finishReason: 'cancelled',
        });
        await writeRuntimeEvent(cancelledExternalRuntimeDoneEvent(input, message)).catch(
          () => undefined,
        );
        return;
      }
      if (ev.type === 'error') {
        if (
          input.runDiagnostics?.runtimeSession?.resumeUsed &&
          input.retryOnResumeFailure &&
          !retriedResumeFailure &&
          !sawDone
        ) {
          retriedResumeFailure = true;
          sawError = false;
          primaryFailure = null;
          await writeRuntimeEvent({
            type: 'text-delta',
            iteration: 1,
            delta: formatExternalRuntimeResumeRetryNotice(input.runtimeLabel, ev.message),
          });
          await closeExternalRuntimeIterator(iterator);
          iterator = input
            .retryOnResumeFailure({ reason: ev.message, attempt: 2 })
            [Symbol.asyncIterator]();
          continue;
        }
        sawError = true;
        const classified = classifyRuntimeFailure('run', ev.message);
        primaryFailure = { code: classified.code, message: classified.message };
        await completeRunOnce('failed', ev.message, undefined, {
          errorCode: classified.code,
          finishReason: 'error',
        });
        await writeRuntimeEvent(ev);
        continue;
      }

      if (ev.type === 'done') {
        sawDone = true;
        if (shouldLockTerminalRuntimeFailure({ event: ev, sawError, primaryFailure })) {
          const summary =
            primaryFailure?.message ||
            ev.finalResponse.text ||
            `${input.runtimeLabel} reported an error before completion.`;
          const notice = [
            formatRunStatusBanner('failed'),
            '',
            '',
            `sber-designer: ${input.runtimeLabel} run failed.`,
            `Reason: ${summary}`,
          ].join('\n');
          const normalizedEvent = appendNoticeToDoneEvent(ev, notice, 'other', 'failed');
          await recordRunTranscriptSafely({
            workspacePath: input.workspacePath,
            runId: input.agentRun?.runId,
            source: 'external-runtime',
            transcript: normalizedEvent.transcript,
          });
          await completeRunOnce('failed', summary, runMetricsFromDoneEvent(ev), {
            errorCode: primaryFailure?.code ?? 'run_failed',
            finishReason: 'error',
          });
          await writeRuntimeEvent({
            type: 'text-delta',
            iteration: ev.iterations,
            delta: notice,
          });
          const doneWithRun = withExternalRunMetadata(normalizedEvent, input.agentRun) as Extract<
            AgentStreamEvent,
            { type: 'done' }
          >;
          await writeRuntimeEvent({
            ...doneWithRun,
            runStatus: 'failed',
            runSummary: summary,
            ...(input.runDiagnostics?.runtimeSession
              ? { runtimeSession: input.runDiagnostics.runtimeSession }
              : {}),
          });
          continue;
        }
        const finalizedComponentPack =
          input.workspacePath && input.agentRun
            ? ((await readRecordedComponentPack(input.workspacePath, input.agentRun.runId)) ??
              input.componentPack)
            : input.componentPack;
        const finalized = await finalizeExternalRuntimeDone({
          event: ev,
          runtimeLabel: input.runtimeLabel,
          workspacePath: input.workspacePath,
          agentRun: input.agentRun,
          snapshots: input.snapshots,
          canvasUrl: input.canvasUrl,
          visualSnapshot: input.visualSnapshot,
          ...(finalizedComponentPack !== undefined
            ? { componentPack: finalizedComponentPack }
            : {}),
          ...(input.selection !== undefined ? { selection: input.selection } : {}),
          ...(input.screenReadiness !== undefined
            ? { screenReadiness: input.screenReadiness }
            : {}),
          ...(input.screenCraftProfile ? { screenCraftProfile: input.screenCraftProfile } : {}),
          sawError,
        });
        if (craftRepairAttempted && !craftRepairRecorded) {
          craftRepairRecorded = true;
          await recordToolReceiptSafely({
            workspacePath: input.workspacePath,
            runId: input.agentRun?.runId,
            tool: 'automatic_craft_repair',
            status: finalized.retryableCraftFailure ? 'error' : 'ok',
            changedFiles: [],
            summary: finalized.retryableCraftFailure
              ? 'Bounded automatic craft repair finished with remaining blocking findings.'
              : 'Bounded automatic craft repair resolved the blocking craft gate.',
            metadata: {
              runtime: input.runtimeLabel,
              attempt: 1,
              maxAttempts: 1,
              succeeded: !finalized.retryableCraftFailure,
            },
          });
        }
        if (
          finalized.retryableNoTargetChanges &&
          input.retryOnNoTargetChanges &&
          !retriedNoTargetChanges &&
          !sawError
        ) {
          retriedNoTargetChanges = true;
          sawDone = false;
          for (const preEvent of finalized.preEvents ?? []) {
            await writeRuntimeEvent(preEvent);
          }
          await writeRuntimeEvent({
            type: 'text-delta',
            iteration: ev.iterations,
            delta: formatExternalRuntimeNoTargetRetryNotice(input.runtimeLabel, finalized.summary),
          });
          await closeExternalRuntimeIterator(iterator);
          iterator = input
            .retryOnNoTargetChanges({ summary: finalized.summary, attempt: 2 })
            [Symbol.asyncIterator]();
          continue;
        }
        if (
          finalized.retryableComponentGap &&
          input.repairOnComponentGap &&
          !componentGapRepairAttempted &&
          !sawError
        ) {
          componentGapRepairAttempted = true;
          sawDone = false;
          const role = finalized.componentGapRole ?? 'unknown-required-role';
          const reason = finalized.componentGapReason ?? finalized.summary;
          for (const preEvent of finalized.preEvents ?? []) {
            await writeRuntimeEvent(preEvent);
          }
          await recordToolReceiptSafely({
            workspacePath: input.workspacePath,
            runId: input.agentRun?.runId,
            tool: 'component_readiness_repair',
            status: 'ok',
            changedFiles: [],
            summary: `Started bounded retrieve → hydrate → repair for ${role}.`,
            metadata: {
              runtime: input.runtimeLabel,
              role,
              reason,
              attempt: 1,
              maxAttempts: 1,
              stage: 'retrieve-hydrate-repair',
            },
          });
          await writeRuntimeEvent({
            type: 'text-delta',
            iteration: ev.iterations,
            delta: formatExternalRuntimeComponentGapRepairNotice({
              runtimeLabel: input.runtimeLabel,
              role,
              reason,
            }),
          });
          await closeExternalRuntimeIterator(iterator);
          iterator = input
            .repairOnComponentGap({ role, reason, attempt: 1, maxAttempts: 1 })
            [Symbol.asyncIterator]();
          continue;
        }
        if (
          finalized.retryableCraftFailure &&
          input.repairOnCraftFailure &&
          !craftRepairAttempted &&
          !sawError
        ) {
          craftRepairAttempted = true;
          sawDone = false;
          for (const preEvent of finalized.preEvents ?? []) {
            await writeRuntimeEvent(preEvent);
          }
          await writeRuntimeEvent({
            type: 'text-delta',
            iteration: ev.iterations,
            delta: formatExternalRuntimeCraftRepairNotice({
              runtimeLabel: input.runtimeLabel,
              summary: finalized.craftFailureSummary ?? finalized.summary,
            }),
          });
          await closeExternalRuntimeIterator(iterator);
          iterator = input
            .repairOnCraftFailure({
              summary: finalized.craftFailureSummary ?? finalized.summary,
              findings: finalized.craftFailureFindings ?? [],
              attempt: 1,
              maxAttempts: 1,
            })
            [Symbol.asyncIterator]();
          continue;
        }
        if (
          finalized.retryableRenderFailure &&
          input.repairOnRenderFailure &&
          repairAttempts < maxRepairAttempts &&
          !sawError
        ) {
          repairAttempts += 1;
          sawDone = false;
          for (const preEvent of finalized.preEvents ?? []) {
            await writeRuntimeEvent(preEvent);
          }
          await recordToolReceiptSafely({
            workspacePath: input.workspacePath,
            runId: input.agentRun?.runId,
            tool: 'external_runtime_repair',
            status: 'ok',
            changedFiles: finalized.renderFailureChangedFiles ?? [],
            summary: `Started automatic render repair attempt ${repairAttempts} of ${maxRepairAttempts}.`,
            metadata: {
              runtime: input.runtimeLabel,
              reason: finalized.renderFailureReason,
              attempt: repairAttempts,
              maxAttempts: maxRepairAttempts,
            },
          });
          await writeRuntimeEvent({
            type: 'text-delta',
            iteration: ev.iterations,
            delta: formatExternalRuntimeRenderRepairNotice({
              runtimeLabel: input.runtimeLabel,
              reason: finalized.renderFailureReason ?? finalized.summary,
              changedFiles: finalized.renderFailureChangedFiles ?? [],
              attempt: repairAttempts,
              maxAttempts: maxRepairAttempts,
            }),
          });
          await closeExternalRuntimeIterator(iterator);
          iterator = input
            .repairOnRenderFailure({
              reason: finalized.renderFailureReason ?? finalized.summary,
              changedFiles: finalized.renderFailureChangedFiles ?? [],
              attempt: repairAttempts,
              maxAttempts: maxRepairAttempts,
            })
            [Symbol.asyncIterator]();
          continue;
        }
        const finalizedWithDesignJury = input.finalizeWithDesignJury
          ? await input.finalizeWithDesignJury(finalized, finalizedComponentPack)
          : finalized;
        const finalizedWithRuntimeHealth = appendRuntimeMcpHealthNotice(
          finalizedWithDesignJury,
          input.runDiagnostics?.runtimeMcp,
          ev.iterations,
          input.runDiagnostics?.runManifestPath ??
            (input.agentRun ? agentRunManifestPath(input.agentRun.runId) : null),
        );
        const contextBudget = contextBudgetDiagnosticsForDoneEvent(
          finalizedWithRuntimeHealth.event as Extract<AgentStreamEvent, { type: 'done' }>,
          input.contextBudgetPolicy,
        );
        const finalizedWithRuntimeNotices = appendContextBudgetNotice(
          finalizedWithRuntimeHealth,
          contextBudget,
          ev.iterations,
        );
        const terminalDiagnostics: CompleteAgentRunInput['diagnostics'] = {
          ...finalizedWithRuntimeNotices.diagnostics,
          ...(contextBudget ? { contextBudget } : {}),
        };
        const qualitySummary = await buildAndRecordRunQualitySummary({
          workspacePath: input.workspacePath,
          runId: input.agentRun?.runId,
          terminalStatus: finalizedWithRuntimeNotices.status,
          diagnostics: terminalDiagnostics,
        });
        terminalDiagnostics.qualitySummary = qualitySummary;
        await recordRunTranscriptSafely({
          workspacePath: input.workspacePath,
          runId: input.agentRun?.runId,
          source: 'external-runtime',
          transcript: (
            finalizedWithRuntimeNotices.event as Extract<AgentStreamEvent, { type: 'done' }>
          ).transcript,
        });
        await completeRunOnce(
          finalizedWithRuntimeNotices.status,
          finalizedWithRuntimeNotices.summary,
          runMetricsFromDoneEvent(
            finalizedWithRuntimeNotices.event as Extract<AgentStreamEvent, { type: 'done' }>,
          ),
          terminalDiagnostics,
        );
        const componentReuse = await readComponentReuseSummaryForRun(
          input.workspacePath,
          input.agentRun,
        );
        for (const preEvent of finalizedWithRuntimeNotices.preEvents ?? []) {
          await writeRuntimeEvent(preEvent);
        }
        await writeRuntimeEvent({
          ...(finalizedWithRuntimeNotices.event as Extract<AgentStreamEvent, { type: 'done' }>),
          runStatus: finalizedWithRuntimeNotices.status,
          runSummary: finalizedWithRuntimeNotices.summary,
          ...(terminalDiagnostics.renderProof
            ? { renderProof: terminalDiagnostics.renderProof }
            : {}),
          ...(input.runDiagnostics?.runtimeSession
            ? { runtimeSession: input.runDiagnostics.runtimeSession }
            : {}),
          ...(finalizedComponentPack
            ? { componentPack: componentPackRunSummary(finalizedComponentPack) }
            : {}),
          ...(componentReuse ? { componentReuse } : {}),
          qualitySummary,
        });
        continue;
      }

      await writeRuntimeEvent(ev);
    }

    if (!sawDone) {
      if (input.signal?.aborted) {
        const message = 'Cancelled by user.';
        await completeRunOnce('cancelled', message, undefined, {
          finishReason: 'cancelled',
        });
        await writeRuntimeEvent(cancelledExternalRuntimeDoneEvent(input, message)).catch(
          () => undefined,
        );
      } else {
        await completeRunOnce('failed', `${input.runtimeLabel} stream ended before a done event.`);
      }
    }
  } catch (err) {
    const cancelled = input.signal?.aborted === true;
    const message = cancelled
      ? 'Cancelled by user.'
      : err instanceof Error
        ? err.message
        : String(err);
    if (cancelled) {
      await completeRunOnce('cancelled', message, undefined, {
        finishReason: 'cancelled',
      });
      await writeRuntimeEvent(cancelledExternalRuntimeDoneEvent(input, message)).catch(
        () => undefined,
      );
      return;
    }
    const diagnostic = runtimeFailureDiagnosticForError('run', err, message);
    if (err instanceof Error) input.abortRuntime?.(err);
    await completeRunOnce('failed', message, undefined, {
      errorCode: diagnostic.code,
      finishReason: 'error',
    });
    const errorEvent: AgentStreamEvent = { type: 'error', message };
    await writeRuntimeEvent(errorEvent).catch(() => undefined);
  } finally {
    await closeExternalRuntimeIterator(iterator);
  }
}

function cancelledExternalRuntimeDoneEvent(
  input: ExternalRuntimeStreamInput,
  message: string,
): AgentStreamEvent {
  return withExternalRunMetadata(
    {
      type: 'done',
      transcript: [],
      iterations: 0,
      truncated: false,
      hadErrors: false,
      stoppedAfterPermissionDeny: false,
      finalResponse: {
        text: message,
        provider: input.runtimeLabel,
        model: input.agentRun?.model ?? 'unknown',
        finishReason: 'stop',
      },
      runStatus: 'cancelled',
      runSummary: message,
    },
    input.agentRun,
  ) as AgentStreamEvent;
}

async function nextExternalRuntimeEvent(
  iterator: AsyncIterator<AgentStreamEvent>,
  runtimeLabel: string,
  stageWatchdogMs: number,
): Promise<IteratorResult<AgentStreamEvent>> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      iterator.next(),
      new Promise<IteratorResult<AgentStreamEvent>>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new ExternalRuntimeStageWatchdogError(
                `${runtimeLabel} stage watchdog timed out after ${Math.round(
                  stageWatchdogMs / 1000,
                )}s without a stream event.`,
              ),
            ),
          stageWatchdogMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function closeExternalRuntimeIterator(
  iterator: AsyncIterator<AgentStreamEvent> | null,
): Promise<void> {
  if (!iterator?.return) return;
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      iterator.return(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, EXTERNAL_RUNTIME_ITERATOR_CLOSE_TIMEOUT_MS);
      }),
    ]);
  } catch {
    // Best-effort lifecycle cleanup: the run is already being finalized.
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function runtimeFailureDiagnosticForError(
  phase: Parameters<typeof classifyRuntimeFailure>[0],
  err: unknown,
  message: string,
): { code: string; message: string } {
  if (err instanceof ExternalRuntimeStageWatchdogError) {
    return { code: err.code, message };
  }
  if (isRuntimePromptBudgetError(err)) {
    return { code: 'prompt_too_large', message };
  }
  const classified = classifyRuntimeFailure(phase, message);
  return { code: classified.code, message: classified.message };
}

export function resolveExternalRuntimeStageWatchdogMs(input: { stageWatchdogMs?: number }): number {
  return Number.isFinite(input.stageWatchdogMs) && input.stageWatchdogMs! > 0
    ? Math.floor(input.stageWatchdogMs!)
    : EXTERNAL_RUNTIME_STAGE_WATCHDOG_MS;
}

function shouldLockTerminalRuntimeFailure(input: {
  event: Extract<AgentStreamEvent, { type: 'done' }>;
  sawError: boolean;
  primaryFailure: { code: string; message: string } | null;
}): boolean {
  if (!input.sawError && !input.event.hadErrors) return false;
  if (!input.primaryFailure) return false;
  if (input.event.finalResponse.finishReason !== 'other') return false;
  const usage = input.event.usage ?? input.event.finalResponse.usage;
  const hasUsage =
    usage !== undefined &&
    Object.values(usage).some((value) => typeof value === 'number' && value > 0);
  return !hasUsage;
}
