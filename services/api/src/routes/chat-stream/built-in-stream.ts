/**
 * The built-in agent-loop SSE branch of POST /api/chat/stream (0136 R12 —
 * extracted from routes/chat-stream/index.ts).
 *
 * The turn served by sber-designer's own agent loop rather than an external
 * CLI: run-started, the streamed agent events, permission requests, the
 * design-jury revision pass, craft repair, and the `finally` that completes
 * the run record exactly once, releases the lease and closes the writer.
 *
 * `completeRunOnce` and its `runClosed` flag stay inside this module — they
 * are the branch's own idempotence guard, not handler state. Cancel/timeout,
 * permissions, reconnect and cleanup semantics are unchanged.
 */
import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';

import { createSseEventWriter } from '../sse-event-writer';
import type { z } from 'zod';
import type { ChatMessage, SberDesignerConfig, createGateway } from '@sber-designer/llm-gateway';
import type { AgentKitAgent, ProjectAssistantSession } from '@sber-designer/shared-types';

import type { AgentRunRuntimeSessionDiagnostics } from '../../agent/run-recorder';
import type { AgentRunManifest } from '../../agent/run-record/types';
import type { AgentRunLease, configureAgentRunCoordinator } from '../../agent/run-coordinator';
import type { createAgentAttemptLogger, createAgentDevRunLogger } from '../../agent/dev-log';
import type { loadAgentToolsForContext } from '../../agent/toolset';
import type { ToolContext } from '../../agent/types';
import type { ScreenCraftProfile } from '../../generation-mode';
import type { EditorState } from '../../state-store';
import type { loadRunComponentPack } from './run-context';
import type { resolveDesignJuryRunPlan } from './design-jury-finalization';
import type { StreamChatRequestSchema } from './request-schema';

type AssistantSessionRunStatus = NonNullable<ProjectAssistantSession['metadata']>['lastRunStatus'];

import {
  agentRunManifestPath,
  buildAndRecordRunQualitySummary,
  completeAgentRun,
  recordRunTranscriptSafely,
  recordToolReceiptSafely,
  type CompleteAgentRunInput,
} from '../../agent/run-recorder';
import { runAgentStream, type AgentStreamEvent } from '../../agent/stream';
import { createToolMutationCoordinator } from '../../agent/tool-mutation-transaction';
import { finalizeBuiltInRunDone, resolveBuiltInRunCompletion } from './built-in';
import { buildBuiltInCraftRepairMessages } from './craft-repair';
import {
  buildDesignJuryRevisionMessages,
  finalizeBuiltInRunWithDesignJury,
  loadDesignJuryContextForRun,
  mergeAgentDoneEvents,
} from './design-jury-finalization';
import { runEvidenceDiagnostics, runMetricsFromDoneEvent } from './evidence';
import { writeRunStartedEvent } from './external';
import { readComponentReuseSummaryForRun } from './render-health';
import { selectRunCanvasUrl } from './request-schema';
import { registerStreamPermissionRequest, writeSSE } from './sse';
import { type ComponentReuseRunSummary } from '@sber-designer/shared-types';

/**
 * The handler state this branch reads. Field types follow the functions that
 * produce them, so the contract cannot drift from the handler that fills it.
 */
export interface BuiltInStreamContext {
  active: SberDesignerConfig['agent']['default'];
  parse: { data: z.infer<typeof StreamChatRequestSchema> };
  user: string;
  activeAgent: AgentKitAgent;
  activeLease: AgentRunLease | null;
  agentRun: AgentRunManifest | null;
  attemptLogger: Awaited<ReturnType<typeof createAgentAttemptLogger>>;
  componentPack: Awaited<ReturnType<typeof loadRunComponentPack>>;
  designJuryPlan: ReturnType<typeof resolveDesignJuryRunPlan>;
  devLogger: Awaited<ReturnType<typeof createAgentDevRunLogger>>;
  gateway: ReturnType<typeof createGateway>;
  maxIterations: number;
  messages: ChatMessage[];
  persistRunSessionMetadata: (input: {
    agentRun?: AgentRunManifest | null;
    runStatus?: AssistantSessionRunStatus;
    runSummary?: string | null;
    runErrorCode?: string | null;
    runtimeSession?: AgentRunRuntimeSessionDiagnostics | null;
  }) => Promise<void>;
  runCoordinator: ReturnType<typeof configureAgentRunCoordinator>;
  runSignal: AbortSignal;
  screenCraftProfile: ScreenCraftProfile;
  sessionMode: z.infer<typeof StreamChatRequestSchema>['sessionMode'];
  state: EditorState;
  temperature: number | undefined;
  toolContext: ToolContext;
  tools: Awaited<ReturnType<typeof loadAgentToolsForContext>>;
}

export function streamBuiltInAgentRun(
  c: Context,
  {
    active,
    parse,
    user,
    activeAgent,
    activeLease,
    agentRun,
    attemptLogger,
    componentPack,
    designJuryPlan,
    devLogger,
    gateway,
    maxIterations,
    messages,
    persistRunSessionMetadata,
    runCoordinator,
    runSignal,
    screenCraftProfile,
    sessionMode,
    state,
    temperature,
    toolContext,
    tools,
  }: BuiltInStreamContext,
): Response {
  return streamSSE(c, async (stream) => {
    const sse = createSseEventWriter(stream);
    let runClosed = false;
    const completeRunOnce = async (
      status: CompleteAgentRunInput['status'],
      summary: string,
      diagnostics?: CompleteAgentRunInput['diagnostics'],
      metrics?: CompleteAgentRunInput['metrics'],
    ) => {
      if (runClosed) return;
      runClosed = true;
      const fullDiagnostics = runEvidenceDiagnostics({
        diagnostics,
        attemptLogger,
        devLogger,
        agentRun,
      });
      await completeAgentRun({
        workspacePath: toolContext.workspacePath,
        runId: agentRun?.runId,
        status,
        summary,
        ...(metrics ? { metrics } : {}),
        diagnostics: fullDiagnostics,
      }).catch(() => undefined);
      await persistRunSessionMetadata({
        agentRun,
        runStatus: status as AssistantSessionRunStatus,
        runSummary: summary,
        runErrorCode: fullDiagnostics.errorCode ?? diagnostics?.errorCode ?? null,
      });
    };
    const mutationCoordinator = createToolMutationCoordinator(runSignal);
    const events = runAgentStream({
      gateway,
      messages,
      tools,
      toolContext,
      maxIterations,
      permission: activeAgent.permission,
      signal: runSignal,
      mutationCoordinator,
      requestPermission: (request) =>
        registerStreamPermissionRequest(
          request,
          user,
          toolContext.workspacePath,
          toolContext.runId,
          runSignal,
        ),
      devLogger,
      ...(parse.data.model ? { modelOverride: parse.data.model } : {}),
      ...(temperature !== undefined ? { temperature } : {}),
      ...(parse.data.maxTokens !== undefined ? { maxTokens: parse.data.maxTokens } : {}),
    });
    try {
      await writeRunStartedEvent(sse, activeLease, agentRun, componentPack);
      for await (const ev of events) {
        let outgoingEvent: AgentStreamEvent = ev;
        let preEvents: AgentStreamEvent[] = [];
        let doneStatus: CompleteAgentRunInput['status'] | null = null;
        let doneSummary: string | null = null;
        let doneRenderProof:
          | NonNullable<CompleteAgentRunInput['diagnostics']>['renderProof']
          | null = null;
        let componentReuse: ComponentReuseRunSummary | null = null;
        if (ev.type === 'done') {
          let finalized =
            sessionMode === 'design'
              ? await finalizeBuiltInRunDone({
                  event: ev,
                  workspacePath: toolContext.workspacePath,
                  agentRun,
                  canvasUrl: selectRunCanvasUrl(toolContext.canvasUrl),
                  runAborted: runSignal.aborted,
                  componentPack,
                  screenReadiness: state.screenReadiness ?? null,
                  screenCraftProfile,
                })
              : { event: ev, ...resolveBuiltInRunCompletion(ev) };
          if (
            sessionMode === 'design' &&
            agentRun &&
            'retryableCraftFailure' in finalized &&
            finalized.retryableCraftFailure
          ) {
            for (const preEvent of finalized.preEvents ?? []) {
              await writeSSE(sse, preEvent);
            }
            await writeSSE(sse, {
              type: 'text-delta',
              iteration: ev.iterations,
              delta: '\n\nsber-designer: Running the single bounded automatic craft repair.\n',
            });
            let repairDone: Extract<AgentStreamEvent, { type: 'done' }> | null = null;
            const repairMessages = buildBuiltInCraftRepairMessages({
              agentRun,
              summary: finalized.craftFailureSummary ?? finalized.summary,
              findings: finalized.craftFailureFindings ?? [],
            });
            const repairEvents = runAgentStream({
              gateway,
              messages: repairMessages,
              tools,
              toolContext,
              maxIterations: 4,
              permission: activeAgent.permission,
              signal: runSignal,
              mutationCoordinator,
              requestPermission: (request) =>
                registerStreamPermissionRequest(
                  request,
                  user,
                  toolContext.workspacePath,
                  toolContext.runId,
                  runSignal,
                ),
              devLogger,
              ...(parse.data.model ? { modelOverride: parse.data.model } : {}),
              ...(temperature !== undefined ? { temperature } : {}),
              maxTokens: Math.min(parse.data.maxTokens ?? 4_000, 4_000),
            });
            for await (const repairEvent of repairEvents) {
              if (repairEvent.type === 'done') {
                repairDone = repairEvent;
                continue;
              }
              await writeSSE(sse, repairEvent);
            }
            const repairTerminal =
              repairDone ??
              ({
                type: 'done',
                transcript: repairMessages,
                iterations: 0,
                truncated: false,
                hadErrors: true,
                stoppedAfterPermissionDeny: false,
                finalResponse: {
                  text: 'Automatic craft repair ended before a terminal response.',
                  provider: active.provider,
                  model: active.model,
                  finishReason: 'other',
                },
              } satisfies Extract<AgentStreamEvent, { type: 'done' }>);
            const repaired = await finalizeBuiltInRunDone({
              event: repairTerminal,
              workspacePath: toolContext.workspacePath,
              agentRun,
              canvasUrl: selectRunCanvasUrl(toolContext.canvasUrl),
              runAborted: runSignal.aborted,
              componentPack,
              screenReadiness: state.screenReadiness ?? null,
              screenCraftProfile,
              forceQualityEvidence: true,
            });
            await recordToolReceiptSafely({
              workspacePath: toolContext.workspacePath,
              runId: agentRun.runId,
              tool: 'automatic_craft_repair',
              status: repaired.retryableCraftFailure ? 'error' : 'ok',
              changedFiles: [],
              summary: repaired.retryableCraftFailure
                ? 'Bounded automatic craft repair finished with remaining blocking findings.'
                : 'Bounded automatic craft repair resolved the blocking craft gate.',
              metadata: {
                runtime: 'built-in',
                attempt: 1,
                maxAttempts: 1,
                succeeded: !repaired.retryableCraftFailure,
              },
            });
            finalized = {
              ...repaired,
              event: mergeAgentDoneEvents(finalized.event, repaired.event),
            };
          }
          if (sessionMode === 'design') {
            finalized = await finalizeBuiltInRunWithDesignJury({
              mechanical: finalized,
              plan: designJuryPlan,
              gateway,
              workspacePath: toolContext.workspacePath,
              agentRun,
              componentPack,
              ...(parse.data.model ? { modelOverride: parse.data.model } : {}),
              signal: runSignal,
              revise: async (revisionPrompt) => {
                if (!toolContext.workspacePath || !agentRun || !designJuryPlan.taskKind) {
                  throw new Error('Design Jury revision lost its active screen context.');
                }
                const beforeRevision = await loadDesignJuryContextForRun({
                  workspacePath: toolContext.workspacePath,
                  agentRun,
                  taskKind: designJuryPlan.taskKind,
                  componentPack,
                });
                await writeSSE(sse, {
                  type: 'text-delta',
                  iteration: ev.iterations,
                  delta:
                    '\n\nDesign Jury scored the screen below 8.0. Starting its single bounded revision.\n',
                });
                let revisionDone: Extract<AgentStreamEvent, { type: 'done' }> | null = null;
                const revisionEvents = runAgentStream({
                  gateway,
                  messages: buildDesignJuryRevisionMessages(beforeRevision.context, revisionPrompt),
                  tools,
                  toolContext,
                  maxIterations: 4,
                  permission: activeAgent.permission,
                  signal: runSignal,
                  mutationCoordinator,
                  requestPermission: (request) =>
                    registerStreamPermissionRequest(
                      request,
                      user,
                      toolContext.workspacePath,
                      toolContext.runId,
                      runSignal,
                    ),
                  devLogger,
                  ...(parse.data.model ? { modelOverride: parse.data.model } : {}),
                  ...(temperature !== undefined ? { temperature } : {}),
                  maxTokens: Math.min(parse.data.maxTokens ?? 4_000, 4_000),
                });
                for await (const revisionEvent of revisionEvents) {
                  if (revisionEvent.type === 'done') {
                    revisionDone = revisionEvent;
                    continue;
                  }
                  await writeSSE(sse, revisionEvent);
                }
                const revisionTerminal =
                  revisionDone ??
                  ({
                    type: 'done',
                    transcript: buildDesignJuryRevisionMessages(
                      beforeRevision.context,
                      revisionPrompt,
                    ),
                    iterations: 0,
                    truncated: false,
                    hadErrors: true,
                    stoppedAfterPermissionDeny: false,
                    finalResponse: {
                      text: 'Design Jury revision ended before a terminal response.',
                      provider: active.provider,
                      model: active.model,
                      finishReason: 'other',
                    },
                  } satisfies Extract<AgentStreamEvent, { type: 'done' }>);
                const revisionMechanical = await finalizeBuiltInRunDone({
                  event: revisionTerminal,
                  workspacePath: toolContext.workspacePath,
                  agentRun,
                  canvasUrl: selectRunCanvasUrl(toolContext.canvasUrl),
                  runAborted: runSignal.aborted,
                  componentPack,
                  screenReadiness: state.screenReadiness ?? null,
                  screenCraftProfile,
                  forceQualityEvidence: true,
                });
                const mergedMechanical = {
                  ...revisionMechanical,
                  event: mergeAgentDoneEvents(finalized.event, revisionMechanical.event),
                };
                const afterRevision = await loadDesignJuryContextForRun({
                  workspacePath: toolContext.workspacePath,
                  agentRun,
                  taskKind: designJuryPlan.taskKind,
                  componentPack,
                });
                return {
                  context: afterRevision.context,
                  mechanical: mergedMechanical,
                };
              },
            });
            const qualitySummary = await buildAndRecordRunQualitySummary({
              workspacePath: toolContext.workspacePath,
              runId: agentRun?.runId,
              terminalStatus: finalized.status,
              diagnostics: finalized.diagnostics,
            });
            finalized = {
              ...finalized,
              diagnostics: { ...finalized.diagnostics, qualitySummary },
              event: { ...finalized.event, qualitySummary },
            };
          }
          preEvents = finalized.preEvents ?? [];
          outgoingEvent = finalized.event;
          doneStatus = finalized.status;
          doneSummary = finalized.summary;
          doneRenderProof = finalized.diagnostics.renderProof ?? null;
          await recordRunTranscriptSafely({
            workspacePath: toolContext.workspacePath,
            runId: agentRun?.runId,
            source: 'chat-stream',
            transcript: finalized.event.transcript,
          });
          await completeRunOnce(
            finalized.status,
            finalized.summary,
            {
              ...finalized.diagnostics,
            },
            runMetricsFromDoneEvent(finalized.event),
          );
          componentReuse = await readComponentReuseSummaryForRun(
            toolContext.workspacePath,
            agentRun,
          );
        } else if (ev.type === 'error') {
          if (runSignal.aborted) {
            doneStatus = 'cancelled';
            doneSummary = 'Cancelled by user.';
            outgoingEvent = {
              type: 'done',
              transcript: [],
              iterations: 0,
              truncated: false,
              hadErrors: false,
              stoppedAfterPermissionDeny: false,
              finalResponse: {
                text: doneSummary,
                provider: active.provider,
                model: active.model,
                finishReason: 'stop',
              },
              runStatus: doneStatus,
              runSummary: doneSummary,
            };
            await completeRunOnce('cancelled', doneSummary, {
              finishReason: 'cancelled',
            });
          } else {
            await completeRunOnce('failed', ev.message, {
              finishReason: 'error',
            });
          }
        }
        for (const preEvent of preEvents) {
          await writeSSE(sse, preEvent);
        }
        const event =
          outgoingEvent.type === 'done'
            ? {
                ...outgoingEvent,
                ...(doneStatus ? { runStatus: doneStatus } : {}),
                ...(doneSummary ? { runSummary: doneSummary } : {}),
                ...(doneRenderProof ? { renderProof: doneRenderProof } : {}),
                ...(attemptLogger ? { attemptId: attemptLogger.attemptId } : {}),
                ...(devLogger ? { debugLogPath: devLogger.filePath } : {}),
                ...(agentRun
                  ? {
                      runId: agentRun.runId,
                      runManifestPath: agentRunManifestPath(agentRun.runId),
                    }
                  : {}),
                ...(componentReuse ? { componentReuse } : {}),
              }
            : outgoingEvent.type === 'error'
              ? {
                  ...outgoingEvent,
                  ...(attemptLogger ? { attemptId: attemptLogger.attemptId } : {}),
                  ...(devLogger ? { debugLogPath: devLogger.filePath } : {}),
                  ...(agentRun
                    ? {
                        runId: agentRun.runId,
                        runManifestPath: agentRunManifestPath(agentRun.runId),
                      }
                    : {}),
                }
              : outgoingEvent;
        await writeSSE(sse, event);
      }
    } catch (err) {
      const cancelled = runSignal.aborted;
      await mutationCoordinator
        .rollbackActive(cancelled ? 'cancelled' : 'stream_error')
        .catch(() => undefined);
      const message = cancelled
        ? 'Cancelled by user.'
        : err instanceof Error
          ? err.message
          : String(err);
      if (cancelled) {
        await completeRunOnce('cancelled', message, {
          finishReason: 'cancelled',
        });
        const cancelledEvent: AgentStreamEvent = {
          type: 'done',
          transcript: [],
          iterations: 0,
          truncated: false,
          hadErrors: false,
          stoppedAfterPermissionDeny: false,
          finalResponse: {
            text: message,
            provider: active.provider,
            model: active.model,
            finishReason: 'stop',
          },
          runStatus: 'cancelled',
          runSummary: message,
          ...(attemptLogger ? { attemptId: attemptLogger.attemptId } : {}),
          ...(devLogger ? { debugLogPath: devLogger.filePath } : {}),
          ...(agentRun
            ? {
                runId: agentRun.runId,
                runManifestPath: agentRunManifestPath(agentRun.runId),
              }
            : {}),
        };
        await writeSSE(sse, cancelledEvent).catch(() => undefined);
        return;
      }
      await completeRunOnce('failed', message, {
        finishReason: 'error',
      });
      const errorEvent: AgentStreamEvent = {
        type: 'error',
        message,
        ...(attemptLogger ? { attemptId: attemptLogger.attemptId } : {}),
        ...(devLogger ? { debugLogPath: devLogger.filePath } : {}),
        ...(agentRun
          ? {
              runId: agentRun.runId,
              runManifestPath: agentRunManifestPath(agentRun.runId),
            }
          : {}),
      };
      await writeSSE(sse, errorEvent).catch(() => undefined);
    } finally {
      if (activeLease) runCoordinator.release(activeLease.leaseId);
      await sse.close();
    }
  });
}
