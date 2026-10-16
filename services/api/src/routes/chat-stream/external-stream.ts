/**
 * The external-runtime SSE branch of POST /api/chat/stream (0136 R12 —
 * extracted from routes/chat-stream/index.ts).
 *
 * Everything from "a CLI runtime was dispatched" to "the stream is closed and
 * the lease released": the run-started and runtime-context events, the handoff
 * stream with its retry/repair hooks, finalization, and the `finally` block
 * that persists session metadata, releases the run lease and closes the writer
 * however the turn ended.
 *
 * The branch only ever read the handler's locals — it never assigned to them —
 * so it moves as a function over an explicit context. Cancel/timeout,
 * permissions, reconnect and cleanup semantics are unchanged.
 *
 * Field types are derived from the functions that produce them
 * (`Awaited<ReturnType<typeof …>>`) rather than restated, so this contract
 * cannot drift from the handler that fills it.
 */
import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { z } from 'zod';
import type { agentContextBudgetFromConfig } from '@sber-designer/llm-gateway';

import type { createAgentAttemptLogger } from '../../agent/dev-log';
import type { AgentRunLease, configureAgentRunCoordinator } from '../../agent/run-coordinator';
import type { resolveDesignJuryRunPlan } from './design-jury-finalization';
import type { recordPromptAttachmentsForRun, runEvidenceDiagnostics } from './evidence';
import type { createExternalDesignJuryGateway } from './external-design-jury';
import type { externalRuntimeDispatchForProvider } from './external-dispatch';
import type {
  createRuntimeStdoutNoiseCounter,
  prepareExternalRuntimePrompt,
  prepareExternalRuntimeRun,
} from './external';
import type { StreamChatRequestSchema } from './request-schema';
import { writeSSE } from './sse';
import { createSseEventWriter } from '../sse-event-writer';
import type { EditorState } from '../../state-store';
import type { ScreenCraftProfile } from '../../generation-mode';
import type { ProjectAssistantSession } from '@sber-designer/shared-types';
import type { AgentRuntimeSessionPlan } from '../../agent-runtimes/session';
import type { AgentRunManifest } from '../../agent/run-record/types';
import type { AgentRunRuntimeSessionDiagnostics } from '../../agent/run-recorder';

type AssistantSessionRunStatus = NonNullable<ProjectAssistantSession['metadata']>['lastRunStatus'];
/** `planAgentRuntimeSession`'s result, or the "no session support" fallback. */
type RuntimeSessionPlan = AgentRuntimeSessionPlan | { runSession: null; handoffSession: null };

function planDiagnostics(plan: RuntimeSessionPlan): AgentRunRuntimeSessionDiagnostics | undefined {
  return 'diagnostics' in plan ? plan.diagnostics : undefined;
}

import {
  buildExternalRuntimeComponentGapRepairPrompt,
  buildExternalRuntimeNoTargetChangeRetryPrompt,
  buildExternalRuntimeRenderRepairPrompt,
} from '../../agent-runtimes/agent-kit-handoff';
import { agentRunManifestPath } from '../../agent/run-recorder';
import { type AgentStreamEvent } from '../../agent/stream';
import { saveAssistantSessionRunMetadata } from '../../project-store';
import { buildExternalRuntimeCraftRepairPrompt } from './craft-repair';
import {
  buildDesignJuryRevisionMessages,
  finalizeBuiltInRunWithDesignJury,
  loadDesignJuryContextForRun,
  mergeAgentDoneEvents,
} from './design-jury-finalization';
import {
  logRuntimeStdoutNoiseSummary,
  streamExternalRuntimeHandoff,
  writeExternalRuntimeContextEvent,
  writeRunStartedEvent,
} from './external';
import { collectExternalDesignJuryDone, renderChatMessages } from './external-design-jury';
import { finalizeExternalRuntimeDone } from './external-finalization';

/** The handler state this branch reads. */
export interface ExternalRuntimeStreamContext {
  activeLease: AgentRunLease | null;
  attemptLogger: Awaited<ReturnType<typeof createAgentAttemptLogger>>;
  contextBudgetPolicy: ReturnType<typeof agentContextBudgetFromConfig>;
  externalDesignJuryGateway: ReturnType<typeof createExternalDesignJuryGateway>;
  externalDesignJuryPlan: ReturnType<typeof resolveDesignJuryRunPlan>;
  externalDispatch: NonNullable<ReturnType<typeof externalRuntimeDispatchForProvider>>;
  handoff: Awaited<ReturnType<typeof prepareExternalRuntimePrompt>>;
  parse: { data: z.infer<typeof StreamChatRequestSchema> };
  persistRunSessionMetadata: (input: {
    agentRun?: AgentRunManifest | null;
    runStatus?: AssistantSessionRunStatus;
    runSummary?: string | null;
    runErrorCode?: string | null;
    runtimeSession?: AgentRunRuntimeSessionDiagnostics | null;
  }) => Promise<void>;
  prompt: string;
  promptAttachments: Awaited<ReturnType<typeof recordPromptAttachmentsForRun>>;
  runAdapter: (
    nextPrompt: string,
    runtimeSession?: RuntimeSessionPlan['runSession'],
  ) => AsyncIterable<AgentStreamEvent>;
  runCoordinator: ReturnType<typeof configureAgentRunCoordinator>;
  runDiagnostics: ReturnType<typeof runEvidenceDiagnostics>;
  runSignal: AbortSignal;
  runtimeAbortController: AbortController;
  runtimeRun: Awaited<ReturnType<typeof prepareExternalRuntimeRun>>;
  runtimeSessionFallbackPlan: RuntimeSessionPlan;
  runtimeSessionForRetry: () => RuntimeSessionPlan['runSession'];
  screenCraftProfile: ScreenCraftProfile;
  sessionId: string;
  sessionMode: z.infer<typeof StreamChatRequestSchema>['sessionMode'];
  state: EditorState;
  stdoutNoise: ReturnType<typeof createRuntimeStdoutNoiseCounter>;
}

export function streamExternalRuntimeRun(
  c: Context,
  {
    activeLease,
    attemptLogger,
    contextBudgetPolicy,
    externalDesignJuryGateway,
    externalDesignJuryPlan,
    externalDispatch,
    handoff,
    parse,
    persistRunSessionMetadata,
    prompt,
    promptAttachments,
    runAdapter,
    runCoordinator,
    runDiagnostics,
    runSignal,
    runtimeAbortController,
    runtimeRun,
    runtimeSessionFallbackPlan,
    runtimeSessionForRetry,
    screenCraftProfile,
    sessionId,
    sessionMode,
    state,
    stdoutNoise,
  }: ExternalRuntimeStreamContext,
): Response {
  return streamSSE(c, async (stream) => {
    const sse = createSseEventWriter(stream);
    try {
      await writeRunStartedEvent(sse, activeLease, runtimeRun.agentRun, handoff.componentPack);
      await writeExternalRuntimeContextEvent(
        sse,
        externalDispatch.contextRuntimeLabel,
        runtimeRun.agentRun,
        handoff,
      );
      await streamExternalRuntimeHandoff({
        stream: sse,
        runtimeLabel: externalDispatch.streamRuntimeLabel,
        workspacePath: runtimeRun.workspacePath,
        agentRun: runtimeRun.agentRun,
        runDiagnostics,
        snapshots: sessionMode === 'design' ? runtimeRun.snapshots : [],
        canvasUrl: state.canvasUrl ?? null,
        visualSnapshot: runtimeRun.visualSnapshot,
        selection: state.selection ?? null,
        screenReadiness: state.screenReadiness ?? null,
        screenCraftProfile,
        contextBudgetPolicy,
        signal: runSignal,
        ...(handoff.componentPack !== undefined ? { componentPack: handoff.componentPack } : {}),
        events: runAdapter(prompt),
        abortRuntime: (reason) => runtimeAbortController.abort(reason),
        ...(handoff.resumeFallbackPrompt
          ? {
              retryOnResumeFailure: () => {
                const fallbackDiagnostics = planDiagnostics(runtimeSessionFallbackPlan);
                if (fallbackDiagnostics) {
                  runDiagnostics.runtimeSession = fallbackDiagnostics;
                }
                return runAdapter(
                  handoff.resumeFallbackPrompt!,
                  runtimeSessionFallbackPlan.runSession,
                );
              },
            }
          : {}),
        ...(sessionMode === 'design'
          ? {
              retryOnNoTargetChanges: ({ summary }: { summary: string }) =>
                runAdapter(
                  buildExternalRuntimeNoTargetChangeRetryPrompt({
                    runtimeLabel: externalDispatch.promptRuntimeLabel,
                    reason: summary,
                    messages: parse.data.messages,
                    state,
                    promptAttachments,
                  }),
                  runtimeSessionForRetry(),
                ),
              repairOnComponentGap: ({ role, reason }: { role: string; reason: string }) =>
                runAdapter(
                  buildExternalRuntimeComponentGapRepairPrompt({
                    runtimeLabel: externalDispatch.promptRuntimeLabel,
                    role,
                    reason,
                    messages: parse.data.messages,
                    state,
                    ...(runtimeRun.agentRun?.runId
                      ? { agentRunId: runtimeRun.agentRun.runId }
                      : {}),
                    promptAttachments,
                  }),
                  runtimeSessionForRetry(),
                ),
              repairOnRenderFailure: ({
                reason,
                changedFiles,
                attempt,
                maxAttempts,
              }: {
                reason: string;
                changedFiles: string[];
                attempt: number;
                maxAttempts: number;
              }) =>
                runAdapter(
                  buildExternalRuntimeRenderRepairPrompt({
                    runtimeLabel: externalDispatch.promptRuntimeLabel,
                    reason,
                    changedFiles,
                    attempt,
                    maxAttempts,
                    messages: parse.data.messages,
                    state,
                    promptAttachments,
                  }),
                  runtimeSessionForRetry(),
                ),
              repairOnCraftFailure: ({ summary, findings }) =>
                runAdapter(
                  buildExternalRuntimeCraftRepairPrompt({
                    runtimeLabel: externalDispatch.promptRuntimeLabel,
                    summary,
                    findings,
                    messages: parse.data.messages,
                    state,
                    ...(runtimeRun.agentRun?.runId
                      ? { agentRunId: runtimeRun.agentRun.runId }
                      : {}),
                  }),
                  runtimeSessionForRetry(),
                ),
              finalizeWithDesignJury: async (
                externalFinalized: Awaited<ReturnType<typeof finalizeExternalRuntimeDone>>,
                finalizedComponentPack,
              ) => {
                const initialEvent = externalFinalized.event as Extract<
                  AgentStreamEvent,
                  { type: 'done' }
                >;
                const juryFinalized = await finalizeBuiltInRunWithDesignJury({
                  mechanical: {
                    event: initialEvent,
                    ...(externalFinalized.preEvents
                      ? { preEvents: externalFinalized.preEvents }
                      : {}),
                    status: externalFinalized.status,
                    summary: externalFinalized.summary,
                    diagnostics: externalFinalized.diagnostics ?? {},
                  },
                  plan: externalDesignJuryPlan,
                  gateway: externalDesignJuryGateway,
                  workspacePath: runtimeRun.workspacePath,
                  agentRun: runtimeRun.agentRun,
                  ...(finalizedComponentPack !== undefined
                    ? { componentPack: finalizedComponentPack }
                    : {}),
                  signal: runSignal,
                  revise: async (revisionPrompt) => {
                    if (
                      !runtimeRun.workspacePath ||
                      !runtimeRun.agentRun ||
                      !externalDesignJuryPlan.taskKind
                    ) {
                      throw new Error(
                        'External Design Jury revision lost its active screen context.',
                      );
                    }
                    const beforeRevision = await loadDesignJuryContextForRun({
                      workspacePath: runtimeRun.workspacePath,
                      agentRun: runtimeRun.agentRun,
                      taskKind: externalDesignJuryPlan.taskKind,
                      ...(finalizedComponentPack !== undefined
                        ? { componentPack: finalizedComponentPack }
                        : {}),
                    });
                    await writeSSE(sse, {
                      type: 'text-delta',
                      iteration: initialEvent.iterations,
                      delta:
                        '\n\nDesign Jury scored the screen below 8.0. Starting its single bounded CLI revision.\n',
                    });
                    const revisionDone = await collectExternalDesignJuryDone(
                      runAdapter(
                        renderChatMessages(
                          buildDesignJuryRevisionMessages(beforeRevision.context, revisionPrompt),
                        ),
                        runtimeSessionForRetry(),
                      ),
                      (revisionEvent) => writeSSE(sse, revisionEvent),
                    );
                    const revisionFinalized = await finalizeExternalRuntimeDone({
                      event: revisionDone,
                      runtimeLabel: externalDispatch.streamRuntimeLabel,
                      workspacePath: runtimeRun.workspacePath,
                      agentRun: runtimeRun.agentRun,
                      snapshots: runtimeRun.snapshots,
                      canvasUrl: state.canvasUrl ?? null,
                      visualSnapshot: runtimeRun.visualSnapshot,
                      ...(finalizedComponentPack !== undefined
                        ? { componentPack: finalizedComponentPack }
                        : {}),
                      selection: state.selection ?? null,
                      screenReadiness: state.screenReadiness ?? null,
                      screenCraftProfile,
                      sawError: false,
                    });
                    const revisionEvent = revisionFinalized.event as Extract<
                      AgentStreamEvent,
                      { type: 'done' }
                    >;
                    const afterRevision = await loadDesignJuryContextForRun({
                      workspacePath: runtimeRun.workspacePath,
                      agentRun: runtimeRun.agentRun,
                      taskKind: externalDesignJuryPlan.taskKind,
                      ...(finalizedComponentPack !== undefined
                        ? { componentPack: finalizedComponentPack }
                        : {}),
                    });
                    return {
                      context: afterRevision.context,
                      mechanical: {
                        event: mergeAgentDoneEvents(initialEvent, revisionEvent),
                        ...(revisionFinalized.preEvents
                          ? { preEvents: revisionFinalized.preEvents }
                          : {}),
                        status: revisionFinalized.status,
                        summary: revisionFinalized.summary,
                        diagnostics: revisionFinalized.diagnostics ?? {},
                      },
                    };
                  },
                });
                return {
                  ...externalFinalized,
                  event: juryFinalized.event,
                  ...(juryFinalized.preEvents ? { preEvents: juryFinalized.preEvents } : {}),
                  status: juryFinalized.status,
                  summary: juryFinalized.summary,
                  diagnostics: juryFinalized.diagnostics,
                };
              },
            }
          : {}),
        onTerminalStatus: ({ status, summary, diagnostics, runtimeSession }) =>
          persistRunSessionMetadata({
            agentRun: runtimeRun.agentRun,
            runStatus: status as AssistantSessionRunStatus,
            runSummary: summary,
            runErrorCode: diagnostics?.errorCode ?? null,
            ...(runtimeSession ? { runtimeSession } : {}),
          }),
      });
      await logRuntimeStdoutNoiseSummary(attemptLogger, externalDispatch.runtime, stdoutNoise);
    } finally {
      await saveAssistantSessionRunMetadata({
        sessionId,
        ...(runtimeRun.agentRun
          ? { runManifestPath: agentRunManifestPath(runtimeRun.agentRun.runId) }
          : {}),
        ...(runDiagnostics.runtimeSession ? { runtimeSession: runDiagnostics.runtimeSession } : {}),
      }).catch(() => undefined);
      if (activeLease) runCoordinator.release(activeLease.leaseId);
      await sse.close();
    }
  });
}
