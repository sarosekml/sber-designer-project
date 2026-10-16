/**
 * Streaming agent loop. Same control flow as runAgent (loop.ts) but
 * yields AgentStreamEvent values along the way: text deltas as they
 * arrive from the LLM, tool calls when they finish parsing, tool
 * results once executed, iteration boundaries, and a final `done`
 * with the complete transcript.
 *
 * Backed by gateway.chatStream(); the non-streaming runAgent stays
 * usable for cases where the caller doesn't need progress updates.
 */
import type {
  AgentKitPermission,
  ComponentPackRunSummary,
  ComponentReuseRunSummary,
  RunQualitySummary,
} from '@sber-designer/shared-types';
import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  LlmGateway,
} from '@sber-designer/llm-gateway';

import { audit } from '../audit';
import { componentPackRunSummary } from '../component-intelligence/component-pack-summary';
import { resolveAgentKitPermission, resolveAgentToolPermission } from '../agent-kit/permissions';
import { chatResponseForAgentLog, compactForAgentLog, type AgentDevRunLogger } from './dev-log';
import { toolToSpec } from './tool-spec';
import {
  EMPTY_ASSISTANT_RETRY_LIMIT,
  canRetryEmptyAssistantResponse,
  emptyAssistantFallbackResponse,
  emptyAssistantRetryMessage,
  isEmptyAssistantResponse,
} from './empty-response';
import { unknownToolDetail } from './tool-hints';
import { invalidToolJsonRecoveryDetail, parseToolArguments } from './tool-arguments';
import type { ServerTool, ToolContext } from './types';
import type { ToolMutationCoordinator } from './tool-mutation-transaction';
import { applyRunPermissionScope } from './tool-permission-scope';
import {
  addRuntimeUsage,
  hasRuntimeUsage,
  type RuntimeUsageSummary,
} from '../agent-runtimes/usage';
import type {
  AgentRunRenderProofDiagnostics,
  AgentRunRuntimeSessionDiagnostics,
} from './run-recorder';
import { recordToolReceiptSafely } from './run-recorder';
import {
  componentGapRepairFromToolResult,
  componentGapRepairNudge,
  type ComponentGapRepairRequest,
} from './component-gap-repair';
import {
  budgetFinalizeNudge,
  budgetReconNudge,
  changedFilesFromToolResult,
  decideScreenBudgetNudge,
  isAgentPermissionResponse,
  isScreenGenerationTask,
  isScreenWriteIntent,
  localEditLoopFinalizedFinalResponse,
  localEditLoopFinalizedNotice,
  localEditValidationFingerprint,
  logDev,
  noWriteStopRecoveryNudge,
  normalizeStreamPath,
  permissionRequestForCall,
  permissionResult,
  screenWriteTargets,
  throwIfRunAborted,
} from './stream-support';

export { decideScreenBudgetNudge } from './stream-support';

export type AgentStreamUsage = RuntimeUsageSummary;

export interface RunAgentStreamInput {
  gateway: LlmGateway;
  messages: ChatMessage[];
  tools: ServerTool[];
  toolContext: ToolContext;
  modelOverride?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  maxIterations?: number;
  permission?: AgentKitPermission;
  requestPermission?: (
    request: AgentPermissionRequest,
  ) => AgentPermissionResponse | Promise<AgentPermissionResponse>;
  devLogger?: AgentDevRunLogger | null;
  mutationCoordinator?: ToolMutationCoordinator;
}

export interface AgentPermissionRequest {
  id: string;
  toolCallId: string;
  toolName: string;
  runId?: string;
  category: string;
  resource: string;
  pattern: string;
  arguments: string;
}

export interface AgentPermissionResponse {
  decision: 'allow' | 'deny';
  remember?: boolean;
  reason?: 'denied' | 'timeout' | 'abort' | 'error';
}

export type AgentStreamEvent =
  | { type: 'heartbeat' }
  | {
      type: 'run-started';
      clientRunId: string;
      sessionId: string;
      screenId: string;
      provider: string;
      model: string;
      runId?: string;
      runManifestPath?: string;
      componentPack?: ComponentPackRunSummary;
    }
  | {
      type: 'run-rejected';
      clientRunId?: string;
      sessionId?: string;
      screenId?: string;
      reason: string;
    }
  | { type: 'iteration-start'; iteration: number }
  | { type: 'text-delta'; iteration: number; delta: string }
  | { type: 'tool-call'; iteration: number; call: { id: string; name: string; arguments: string } }
  | { type: 'permission-request'; iteration: number; request: AgentPermissionRequest }
  | {
      type: 'tool-result';
      iteration: number;
      toolCallId: string;
      content: string;
      isError: boolean;
      toolName?: string;
      status?: 'ok' | 'error';
      componentPack?: ComponentPackRunSummary;
      changedFiles?: string[];
      permissionWaitMs?: number;
      handlerDurationMs?: number;
      totalDurationMs?: number;
    }
  | {
      type: 'iteration-end';
      iteration: number;
      hadToolCalls: boolean;
      finishReason?: string;
    }
  | {
      type: 'external-runtime-context';
      runtime: string;
      agent: string;
      skillInventoryCount: number;
      contextBundlePath?: string;
      omittedSections: { section: string; reason: string }[];
      runtimeWarnings?: string[];
      stableContextDigest?: string;
      stableContextBytes?: number;
      kitStableDigest?: string;
      kitStableBytes?: number;
      taskBytes?: number;
      stableContextReuse?: 'full' | 'reference';
      previousStableContextBundlePath?: string;
    }
  | {
      type: 'external-runtime-diagnostic';
      name: string;
      data: Record<string, unknown>;
    }
  | { type: 'usage'; iteration: number; usage: AgentStreamUsage }
  | {
      type: 'done';
      transcript: ChatMessage[];
      iterations: number;
      truncated: boolean;
      hadErrors: boolean;
      stoppedAfterPermissionDeny: boolean;
      finalResponse: ChatResponse;
      attemptId?: string;
      debugLogPath?: string;
      runId?: string;
      runManifestPath?: string;
      runStatus?: 'complete' | 'failed' | 'needs_review' | 'cancelled';
      runSummary?: string;
      componentPack?: ComponentPackRunSummary;
      componentReuse?: ComponentReuseRunSummary;
      qualitySummary?: RunQualitySummary;
      renderProof?: AgentRunRenderProofDiagnostics;
      runtimeSession?: AgentRunRuntimeSessionDiagnostics;
      usage?: AgentStreamUsage;
    }
  | {
      type: 'error';
      message: string;
      attemptId?: string;
      debugLogPath?: string;
      runId?: string;
      runManifestPath?: string;
    };

const DEFAULT_MAX_ITERATIONS = 6;

export async function* runAgentStream(
  input: RunAgentStreamInput,
): AsyncGenerator<AgentStreamEvent> {
  const max = input.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const permission = resolveAgentKitPermission(input.permission);
  const toolSpecs = input.tools.map(toolToSpec);
  const toolByName = new Map(input.tools.map((t) => [t.name, t]));
  const toolContext = input.mutationCoordinator
    ? {
        ...input.toolContext,
        beginToolMutation: input.mutationCoordinator.begin,
      }
    : input.toolContext;

  let transcript: ChatMessage[] = [...input.messages];
  let iteration = 0;
  let lastResponse: ChatResponse | null = null;
  let truncated = false;
  let hadErrors = false;
  let stoppedAfterPermissionDeny = false;
  let emptyResponseRetries = 0;
  let aggregateUsage: AgentStreamUsage = {};
  const invalidToolJsonAttempts = new Map<string, number>();

  // B1 (task 9999): reserve iteration budget so the active screen gets written
  // before the run truncates. Only for screen-write intents with a real target
  // and a large budget. Purely additive — injects a steering message, never
  // changes control flow or truncation.
  const activeScreenTargets = screenWriteTargets(input.toolContext.activeScreen);
  const screenWriteRequired =
    activeScreenTargets.length > 0 &&
    (isScreenWriteIntent(input.toolContext.assistantTaskIntent) ||
      isScreenGenerationTask(input.toolContext.componentPack?.taskKind));
  const screenBudgetTargets = screenWriteRequired && max >= 10 ? activeScreenTargets : [];
  const screenBudgetEnabled = screenBudgetTargets.length > 0;
  const reconSoftLimit = Math.max(4, Math.min(10, Math.floor(max * 0.5)));
  const finalizeReserve = Math.max(2, Math.floor(max * 0.2));
  let activeScreenWritten = false;
  let noWriteStopRetryNudged = false;
  let reconNudged = false;
  let finalizeNudged = false;
  let lastLocalEditValidationFingerprint: string | null = null;
  let repeatedLocalEditValidationCount = 0;
  let localEditLoopFinalized = false;
  let componentGapRepairNudged = false;

  while (true) {
    iteration += 1;
    yield { type: 'iteration-start', iteration };

    if (screenBudgetEnabled && !activeScreenWritten) {
      const nudgeKind = decideScreenBudgetNudge({
        iteration,
        max,
        reconSoftLimit,
        finalizeReserve,
        reconNudged,
        finalizeNudged,
      });
      if (nudgeKind) {
        const target = screenBudgetTargets[0] ?? 'the active screen';
        const remaining = Math.max(0, max - iteration);
        const nudge =
          nudgeKind === 'finalize'
            ? budgetFinalizeNudge(target, remaining)
            : budgetReconNudge(target, remaining);
        if (nudgeKind === 'finalize') finalizeNudged = true;
        reconNudged = true;
        transcript = [...transcript, { role: 'user', content: nudge }];
        await logDev(input.devLogger, 'run.note', { iteration, note: nudgeKind, nudge });
      }
    }

    const req: ChatRequest = {
      messages: transcript,
      ...(toolSpecs.length > 0 ? { tools: toolSpecs, toolChoice: 'auto' as const } : {}),
      ...(input.modelOverride ? { model: input.modelOverride } : {}),
      ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
      ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}),
      ...(input.signal ? { signal: input.signal } : {}),
    };

    let textBuffer = '';
    const collectedCalls: { id: string; name: string; arguments: string }[] = [];
    let hadError = false;

    try {
      for await (const ev of input.gateway.chatStream(req)) {
        switch (ev.type) {
          case 'text-delta':
            textBuffer += ev.delta;
            yield { type: 'text-delta', iteration, delta: ev.delta };
            break;
          case 'tool-call':
            collectedCalls.push(ev.call);
            yield { type: 'tool-call', iteration, call: ev.call };
            break;
          case 'done':
            lastResponse = ev.final;
            if (ev.final.usage) {
              aggregateUsage = addRuntimeUsage(aggregateUsage, ev.final.usage);
              yield { type: 'usage', iteration, usage: ev.final.usage };
            }
            break;
          case 'error':
            hadError = true;
            // 0139 C3: keep the structured fields (safe, already redacted)
            // beside the legacy message so run investigations see the
            // category/status/provider-code without parsing prose.
            await logDev(input.devLogger, 'run.error', {
              iteration,
              message: ev.message,
              ...(ev.category !== undefined ? { category: ev.category } : {}),
              ...(ev.status !== undefined ? { status: ev.status } : {}),
              ...(ev.providerCode !== undefined ? { providerCode: ev.providerCode } : {}),
              ...(ev.retryable !== undefined ? { retryable: ev.retryable } : {}),
            });
            yield {
              type: 'error',
              message: ev.message,
              ...(ev.category !== undefined ? { category: ev.category } : {}),
              ...(ev.status !== undefined ? { status: ev.status } : {}),
              ...(ev.providerCode !== undefined ? { providerCode: ev.providerCode } : {}),
              ...(ev.retryable !== undefined ? { retryable: ev.retryable } : {}),
            };
            break;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logDev(input.devLogger, 'run.error', { iteration, message });
      yield { type: 'error', message };
      return;
    }

    if (hadError) return;
    await logDev(input.devLogger, 'llm.response', {
      iteration,
      response: chatResponseForAgentLog(lastResponse),
      streamedText: compactForAgentLog(textBuffer, 2_000),
      toolCalls: collectedCalls.map((call) => ({
        id: call.id,
        name: call.name,
        arguments: compactForAgentLog(call.arguments),
      })),
    });

    if (!textBuffer && lastResponse?.text) {
      textBuffer = lastResponse.text;
      yield { type: 'text-delta', iteration, delta: textBuffer };
    }

    if (
      isEmptyAssistantResponse({
        text: textBuffer,
        toolCallCount: collectedCalls.length,
      })
    ) {
      if (
        canRetryEmptyAssistantResponse({
          retries: emptyResponseRetries,
          iteration,
          maxIterations: max,
        })
      ) {
        emptyResponseRetries += 1;
        await logDev(input.devLogger, 'empty_response.retry', {
          iteration,
          retry: emptyResponseRetries,
          maxRetries: EMPTY_ASSISTANT_RETRY_LIMIT,
        });
        transcript = [...transcript, emptyAssistantRetryMessage()];
        yield {
          type: 'iteration-end',
          iteration,
          hadToolCalls: false,
          ...(lastResponse?.finishReason ? { finishReason: lastResponse.finishReason } : {}),
        };
        continue;
      }
      lastResponse = emptyAssistantFallbackResponse(lastResponse);
      textBuffer = lastResponse.text;
      await logDev(input.devLogger, 'empty_response.final', {
        iteration,
        retries: emptyResponseRetries,
      });
      yield { type: 'text-delta', iteration, delta: textBuffer };
    } else {
      emptyResponseRetries = 0;
    }

    transcript = [
      ...transcript,
      {
        role: 'assistant',
        content: textBuffer,
        ...(collectedCalls.length > 0 ? { toolCalls: collectedCalls } : {}),
      },
    ];

    yield {
      type: 'iteration-end',
      iteration,
      hadToolCalls: collectedCalls.length > 0,
      ...(lastResponse?.finishReason ? { finishReason: lastResponse.finishReason } : {}),
    };

    if (collectedCalls.length === 0) {
      if (
        screenWriteRequired &&
        !activeScreenWritten &&
        !noWriteStopRetryNudged &&
        iteration < max
      ) {
        const target = activeScreenTargets[0] ?? 'the active screen';
        const nudge = noWriteStopRecoveryNudge(target);
        noWriteStopRetryNudged = true;
        transcript = [...transcript, { role: 'user', content: nudge }];
        await logDev(input.devLogger, 'run.note', {
          iteration,
          note: 'active_screen_write_retry',
          nudge,
        });
        continue;
      }
      audit({
        kind: 'chat',
        user: input.toolContext.user,
        errorMessage: `stream iteration=${iteration} stop=${lastResponse?.finishReason ?? 'stop'}`,
        ...(lastResponse?.provider ? { provider: lastResponse.provider } : {}),
        ...(lastResponse?.model ? { model: lastResponse.model } : {}),
        ...(lastResponse?.usage?.inputTokens !== undefined
          ? { promptTokens: lastResponse.usage.inputTokens }
          : {}),
        ...(lastResponse?.usage?.outputTokens !== undefined
          ? { completionTokens: lastResponse.usage.outputTokens }
          : {}),
      });
      break;
    }

    const shouldTruncateAfterTools = iteration >= max;
    let pendingComponentGapRepair: ComponentGapRepairRequest | null = null;

    for (const call of collectedCalls) {
      const tool = toolByName.get(call.name);
      const startedAt = Date.now();
      let permissionWaitMs = 0;
      let handlerDurationMs = 0;
      let resultContent: string;
      let isError = false;
      if (!tool) {
        isError = true;
        resultContent = JSON.stringify({
          error: 'unknown_tool',
          detail: unknownToolDetail(call.name, toolByName.keys()),
        });
      } else {
        const parsedArgs = parseToolArguments(call.arguments);
        if (!parsedArgs.ok) {
          const invalidJsonAttempt = (invalidToolJsonAttempts.get(call.name) ?? 0) + 1;
          invalidToolJsonAttempts.set(call.name, invalidJsonAttempt);
          isError = true;
          resultContent = JSON.stringify({
            error: 'invalid_tool_json',
            detail: invalidToolJsonRecoveryDetail(call.name, parsedArgs.detail, invalidJsonAttempt),
          });
          transcript = [
            ...transcript,
            { role: 'tool', toolCallId: call.id, content: resultContent },
          ];
          await logDev(input.devLogger, 'tool.result', {
            iteration,
            tool: call.name,
            callId: call.id,
            status: 'error',
            durationMs: Date.now() - startedAt,
            permissionWaitMs,
            handlerDurationMs,
            arguments: compactForAgentLog(call.arguments),
            result: compactForAgentLog(resultContent),
          });
          yield {
            type: 'tool-result',
            iteration,
            toolCallId: call.id,
            content: resultContent,
            isError,
            toolName: call.name,
            status: 'error',
            totalDurationMs: Date.now() - startedAt,
          };
          audit({
            kind: 'config',
            user: input.toolContext.user,
            errorMessage: `stream tool=${call.name} call=${call.id} invalid_json`,
          });
          hadErrors = true;
          continue;
        }
        const validated = tool.inputSchema.safeParse(parsedArgs.value);
        if (!validated.success) {
          isError = true;
          resultContent = JSON.stringify({
            error: 'invalid_arguments',
            detail: validated.error.message,
          });
        } else {
          const decision = applyRunPermissionScope({
            decision: resolveAgentToolPermission({
              toolName: tool.name,
              input: validated.data,
              permission,
            }),
            toolName: tool.name,
            input: validated.data,
            toolContext: input.toolContext,
          });
          let resolvedDecision = decision;
          let deniedByPermissionResponse = false;
          if (decision.action === 'ask' && input.requestPermission) {
            const request = permissionRequestForCall({
              decision,
              call,
              iteration,
              runId: input.toolContext.runId ?? null,
            });
            let response: AgentPermissionResponse | Promise<AgentPermissionResponse>;
            try {
              response = input.requestPermission(request);
            } catch {
              response = Promise.resolve({ decision: 'deny', reason: 'error' });
            }
            let permissionResponse: AgentPermissionResponse;
            if (isAgentPermissionResponse(response)) {
              permissionResponse = response;
            } else {
              const permissionStartedAt = Date.now();
              yield { type: 'permission-request', iteration, request };
              permissionResponse = await response.catch(
                (): AgentPermissionResponse => ({ decision: 'deny', reason: 'error' }),
              );
              permissionWaitMs = Date.now() - permissionStartedAt;
            }
            deniedByPermissionResponse = permissionResponse.decision === 'deny';
            resolvedDecision =
              permissionResponse.decision === 'allow'
                ? { ...decision, action: 'allow' }
                : {
                    ...decision,
                    action: 'deny',
                    reasonCode:
                      permissionResponse.reason === 'timeout'
                        ? 'permission_timeout'
                        : 'permission_denied',
                  };
          }
          if (resolvedDecision.action !== 'allow') {
            isError = resolvedDecision.action === 'deny';
            resultContent = JSON.stringify(permissionResult(resolvedDecision));
            transcript = [
              ...transcript,
              { role: 'tool', toolCallId: call.id, content: resultContent },
            ];
            await logDev(input.devLogger, 'tool.result', {
              iteration,
              tool: call.name,
              callId: call.id,
              status: isError ? 'error' : 'ok',
              durationMs: Date.now() - startedAt,
              permissionWaitMs,
              handlerDurationMs,
              arguments: compactForAgentLog(call.arguments),
              result: compactForAgentLog(resultContent),
            });
            yield {
              type: 'tool-result',
              iteration,
              toolCallId: call.id,
              content: resultContent,
              isError,
              toolName: call.name,
              status: isError ? 'error' : 'ok',
              permissionWaitMs,
              handlerDurationMs,
              totalDurationMs: Date.now() - startedAt,
            };
            audit({
              kind: 'config',
              user: input.toolContext.user,
              errorMessage: `stream tool=${call.name} call=${call.id} permission=${resolvedDecision.action} resource=${resolvedDecision.resource}`,
            });
            if (isError) hadErrors = true;
            if (deniedByPermissionResponse) {
              stoppedAfterPermissionDeny = true;
              break;
            }
            continue;
          }
          throwIfRunAborted(input.signal);
          try {
            const handlerStartedAt = Date.now();
            const out = await tool.handler(validated.data, toolContext);
            handlerDurationMs = Date.now() - handlerStartedAt;
            resultContent = JSON.stringify(out);
          } catch (err) {
            handlerDurationMs = Date.now() - startedAt - permissionWaitMs;
            if (input.signal?.aborted) throw err;
            isError = true;
            resultContent = JSON.stringify({
              error: 'tool_failed',
              detail: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
      transcript = [...transcript, { role: 'tool', toolCallId: call.id, content: resultContent }];
      if (
        !componentGapRepairNudged &&
        ['apply_patch', 'validate_screen_craft', 'write_file'].includes(call.name)
      ) {
        pendingComponentGapRepair = componentGapRepairFromToolResult(call.name, resultContent);
      }
      await logDev(input.devLogger, 'tool.result', {
        iteration,
        tool: call.name,
        callId: call.id,
        status: isError ? 'error' : 'ok',
        durationMs: Date.now() - startedAt,
        permissionWaitMs,
        handlerDurationMs,
        arguments: compactForAgentLog(call.arguments),
        result: compactForAgentLog(resultContent),
      });
      const changedFiles = changedFilesFromToolResult(call.name, resultContent);
      const localEditFingerprint = await localEditValidationFingerprint({
        toolName: call.name,
        resultContent,
        toolContext: input.toolContext,
      });
      if (localEditFingerprint && localEditFingerprint.blocking === 0) {
        if (localEditFingerprint.fingerprint === lastLocalEditValidationFingerprint) {
          repeatedLocalEditValidationCount += 1;
        } else {
          lastLocalEditValidationFingerprint = localEditFingerprint.fingerprint;
          repeatedLocalEditValidationCount = 1;
        }
        if (repeatedLocalEditValidationCount >= 2) {
          localEditLoopFinalized = true;
          const nudge = localEditLoopFinalizedNotice(localEditFingerprint.findingIds);
          transcript = [...transcript, { role: 'user', content: nudge }];
          lastResponse = {
            text: localEditLoopFinalizedFinalResponse(localEditFingerprint.findingIds),
            provider: lastResponse?.provider ?? '',
            model: lastResponse?.model ?? '',
            finishReason: 'stop',
          };
          await logDev(input.devLogger, 'run.note', {
            iteration,
            note: 'local_edit_loop_finalized',
            fingerprint: localEditFingerprint.fingerprint,
            findingIds: localEditFingerprint.findingIds,
          });
        }
      } else if (localEditFingerprint?.blocking && localEditFingerprint.blocking > 0) {
        repeatedLocalEditValidationCount = 0;
        lastLocalEditValidationFingerprint = null;
      }
      if (
        screenWriteRequired &&
        !activeScreenWritten &&
        !isError &&
        changedFiles.some((file) => activeScreenTargets.includes(normalizeStreamPath(file)))
      ) {
        activeScreenWritten = true;
      }
      yield {
        type: 'tool-result',
        iteration,
        toolCallId: call.id,
        content: resultContent,
        isError,
        toolName: call.name,
        status: isError ? 'error' : 'ok',
        ...(call.name === 'update_component_selection' && toolContext.componentPack
          ? { componentPack: componentPackRunSummary(toolContext.componentPack) }
          : {}),
        ...(changedFiles.length > 0 ? { changedFiles } : {}),
        permissionWaitMs,
        handlerDurationMs,
        totalDurationMs: Date.now() - startedAt,
      };
      await input.mutationCoordinator?.settleActive({ commit: !isError });
      throwIfRunAborted(input.signal);
      audit({
        kind: 'config',
        user: input.toolContext.user,
        errorMessage: `stream tool=${call.name} call=${call.id}${isError ? ' error' : ''}`,
      });
      if (isError) hadErrors = true;
      if (stoppedAfterPermissionDeny) break;
      if (localEditLoopFinalized) break;
    }

    if (stoppedAfterPermissionDeny || localEditLoopFinalized) {
      break;
    }

    if (pendingComponentGapRepair && !shouldTruncateAfterTools) {
      componentGapRepairNudged = true;
      const nudge = componentGapRepairNudge(pendingComponentGapRepair);
      transcript = [...transcript, { role: 'user', content: nudge }];
      await recordToolReceiptSafely({
        workspacePath: toolContext.workspacePath,
        runId: toolContext.runId,
        tool: 'component_readiness_repair',
        status: 'ok',
        changedFiles: [],
        summary: `Requested bounded retrieve → hydrate → repair for ${pendingComponentGapRepair.role}.`,
        metadata: {
          attempt: 1,
          maxAttempts: 1,
          role: pendingComponentGapRepair.role,
          stage: 'retrieve-hydrate-repair',
        },
      });
      await logDev(input.devLogger, 'run.note', {
        iteration,
        note: 'component_readiness_repair',
        role: pendingComponentGapRepair.role,
      });
    }

    if (shouldTruncateAfterTools) {
      truncated = true;
      audit({
        kind: 'error',
        user: input.toolContext.user,
        errorMessage: `stream agent loop truncated at iteration=${iteration}`,
        ...(lastResponse?.provider ? { provider: lastResponse.provider } : {}),
        ...(lastResponse?.model ? { model: lastResponse.model } : {}),
      });
      break;
    }
  }

  const baseFinalResponse = lastResponse ?? {
    text: '',
    provider: '',
    model: '',
  };
  const finalResponse = hasRuntimeUsage(aggregateUsage)
    ? {
        ...baseFinalResponse,
        usage: aggregateUsage,
      }
    : baseFinalResponse;
  await logDev(input.devLogger, 'run.end', {
    iterations: iteration,
    truncated,
    hadErrors,
    stoppedAfterPermissionDeny,
    finalResponse: chatResponseForAgentLog(finalResponse),
  });

  yield {
    type: 'done',
    transcript,
    iterations: iteration,
    truncated,
    hadErrors,
    stoppedAfterPermissionDeny,
    finalResponse,
    ...(toolContext.componentPack
      ? { componentPack: componentPackRunSummary(toolContext.componentPack) }
      : {}),
    ...(hasRuntimeUsage(aggregateUsage) ? { usage: aggregateUsage } : {}),
  };
}
