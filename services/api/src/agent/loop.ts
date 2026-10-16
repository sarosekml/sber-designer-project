/**
 * Agent loop. Iterates LLM ↔ tools until the model stops asking for
 * tools, returns a final assistant text, hits the iteration cap, or
 * a tool fails.
 *
 * Returns the FULL transcript (all role:'tool' results plus assistant
 * messages) so the browser can render the entire turn including
 * intermediate tool calls. ADR-0014.
 */
import { normalizeAssistantTokenUsage, type AgentKitPermission } from '@sber-designer/shared-types';
import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  LlmGateway,
} from '@sber-designer/llm-gateway';

import { audit } from '../audit';
import {
  resolveAgentKitPermission,
  resolveAgentToolPermission,
  type AgentToolPermissionDecision,
} from '../agent-kit/permissions';
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
import { applyRunPermissionScope } from './tool-permission-scope';
import { addRuntimeUsage, type RuntimeUsageSummary } from '../agent-runtimes/usage';
import { recordToolReceiptSafely } from './run-recorder';
import {
  componentGapRepairFromToolResult,
  componentGapRepairNudge,
  type ComponentGapRepairRequest,
} from './component-gap-repair';

export interface RunAgentInput {
  gateway: LlmGateway;
  /** Initial messages from the request, after system-prompt prefixing. */
  messages: ChatMessage[];
  tools: ServerTool[];
  /** Per-call shared context for tool handlers. */
  toolContext: ToolContext;
  /** Optional override forwarded to gateway.chat() on every iteration. */
  modelOverride?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** Hard cap on agent turns. Default 6. */
  maxIterations?: number;
  permission?: AgentKitPermission;
  /** Optional development-only JSONL run log. Never required for correctness. */
  devLogger?: AgentDevRunLogger | null;
}

export interface RunAgentResult {
  finalResponse: ChatResponse;
  /** Includes the original `messages`, plus every tool result and assistant
   *  message produced during the loop. Order preserved. */
  transcript: ChatMessage[];
  /** Number of LLM round-trips actually performed. */
  iterations: number;
  /** True when the loop hit `maxIterations` without a stop reason. */
  truncated: boolean;
}

const DEFAULT_MAX_ITERATIONS = 6;

export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const max = input.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const permission = resolveAgentKitPermission(input.permission);
  const toolSpecs = input.tools.map(toolToSpec);
  const toolByName = new Map(input.tools.map((t) => [t.name, t]));

  let transcript: ChatMessage[] = [...input.messages];
  let iterations = 0;
  let lastResponse: ChatResponse;
  let truncated = false;
  let emptyResponseRetries = 0;
  let aggregateUsage: RuntimeUsageSummary = {};
  let componentGapRepairNudged = false;
  const invalidToolJsonAttempts = new Map<string, number>();

  while (true) {
    iterations += 1;
    const req: ChatRequest = {
      messages: transcript,
      ...(toolSpecs.length > 0 ? { tools: toolSpecs, toolChoice: 'auto' as const } : {}),
      ...(input.modelOverride ? { model: input.modelOverride } : {}),
      ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
      ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}),
      ...(input.signal ? { signal: input.signal } : {}),
    };
    const turnStart = Date.now();
    lastResponse = await input.gateway.chat(req);
    aggregateUsage = addRuntimeUsage(aggregateUsage, lastResponse.usage);
    await logDev(input.devLogger, 'llm.response', {
      iteration: iterations,
      latencyMs: Date.now() - turnStart,
      response: chatResponseForAgentLog(lastResponse),
    });

    const toolCallCount = lastResponse.toolCalls?.length ?? 0;
    if (isEmptyAssistantResponse({ text: lastResponse.text, toolCallCount })) {
      if (
        canRetryEmptyAssistantResponse({
          retries: emptyResponseRetries,
          iteration: iterations,
          maxIterations: max,
        })
      ) {
        emptyResponseRetries += 1;
        await logDev(input.devLogger, 'empty_response.retry', {
          iteration: iterations,
          retry: emptyResponseRetries,
          maxRetries: EMPTY_ASSISTANT_RETRY_LIMIT,
        });
        transcript = [...transcript, emptyAssistantRetryMessage()];
        continue;
      }
      lastResponse = emptyAssistantFallbackResponse(lastResponse);
      await logDev(input.devLogger, 'empty_response.final', {
        iteration: iterations,
        retries: emptyResponseRetries,
      });
    } else {
      emptyResponseRetries = 0;
    }

    // Even when there are tool_calls, append the assistant message with
    // the calls — tool results MUST be linked back to it via toolCallId.
    transcript = [
      ...transcript,
      {
        role: 'assistant',
        content: lastResponse.text,
        ...(lastResponse.toolCalls && lastResponse.toolCalls.length > 0
          ? { toolCalls: lastResponse.toolCalls }
          : {}),
      },
    ];

    if (!lastResponse.toolCalls || lastResponse.toolCalls.length === 0) {
      audit({
        kind: 'chat',
        user: input.toolContext.user,
        provider: lastResponse.provider,
        model: lastResponse.model,
        latencyMs: Date.now() - turnStart,
        errorMessage: `iteration=${iterations} stop=${lastResponse.finishReason ?? 'stop'}`,
        ...(lastResponse.usage?.inputTokens !== undefined
          ? { promptTokens: lastResponse.usage.inputTokens }
          : {}),
        ...(lastResponse.usage?.outputTokens !== undefined
          ? { completionTokens: lastResponse.usage.outputTokens }
          : {}),
      });
      break;
    }

    const shouldTruncateAfterTools = iterations >= max;
    let pendingComponentGapRepair: ComponentGapRepairRequest | null = null;

    // Execute each tool sequentially. Failures land as a role:'tool'
    // message with the error string — the model can usually recover.
    for (const call of lastResponse.toolCalls) {
      const tool = toolByName.get(call.name);
      const startedAt = Date.now();
      let resultMessage: ChatMessage;
      let toolStatus: 'ok' | 'error' = 'ok';
      if (!tool) {
        toolStatus = 'error';
        resultMessage = {
          role: 'tool',
          toolCallId: call.id,
          content: JSON.stringify({
            error: 'unknown_tool',
            detail: unknownToolDetail(call.name, toolByName.keys()),
          }),
        };
      } else {
        const parsedArgs = parseToolArguments(call.arguments);
        if (!parsedArgs.ok) {
          const invalidJsonAttempt = (invalidToolJsonAttempts.get(call.name) ?? 0) + 1;
          invalidToolJsonAttempts.set(call.name, invalidJsonAttempt);
          toolStatus = 'error';
          resultMessage = {
            role: 'tool',
            toolCallId: call.id,
            content: JSON.stringify({
              error: 'invalid_tool_json',
              detail: invalidToolJsonRecoveryDetail(
                call.name,
                parsedArgs.detail,
                invalidJsonAttempt,
              ),
            }),
          };
          transcript = [...transcript, resultMessage];
          await logDev(input.devLogger, 'tool.result', {
            iteration: iterations,
            tool: call.name,
            callId: call.id,
            status: toolStatus,
            durationMs: Date.now() - startedAt,
            arguments: compactForAgentLog(call.arguments),
            result: compactForAgentLog(resultMessage.content),
          });
          audit({
            kind: 'config',
            user: input.toolContext.user,
            latencyMs: Date.now() - startedAt,
            errorMessage: `tool=${call.name} call=${call.id} invalid_json`,
          });
          continue;
        }
        const validated = tool.inputSchema.safeParse(parsedArgs.value);
        if (!validated.success) {
          toolStatus = 'error';
          resultMessage = {
            role: 'tool',
            toolCallId: call.id,
            content: JSON.stringify({
              error: 'invalid_arguments',
              detail: validated.error.message,
            }),
          };
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
          if (decision.action !== 'allow') {
            toolStatus = decision.action === 'deny' ? 'error' : 'ok';
            resultMessage = {
              role: 'tool',
              toolCallId: call.id,
              content: JSON.stringify(permissionResult(decision)),
            };
            transcript = [...transcript, resultMessage];
            await logDev(input.devLogger, 'tool.result', {
              iteration: iterations,
              tool: call.name,
              callId: call.id,
              status: toolStatus,
              durationMs: Date.now() - startedAt,
              arguments: compactForAgentLog(call.arguments),
              result: compactForAgentLog(resultMessage.content),
            });
            audit({
              kind: 'config',
              user: input.toolContext.user,
              latencyMs: Date.now() - startedAt,
              errorMessage: `tool=${call.name} call=${call.id} permission=${decision.action} resource=${decision.resource}`,
            });
            continue;
          }
          throwIfRunAborted(input.signal);
          try {
            const out = await tool.handler(validated.data, input.toolContext);
            resultMessage = {
              role: 'tool',
              toolCallId: call.id,
              content: JSON.stringify(out),
            };
          } catch (err) {
            if (input.signal?.aborted) throw err;
            const message = err instanceof Error ? err.message : String(err);
            toolStatus = 'error';
            resultMessage = {
              role: 'tool',
              toolCallId: call.id,
              content: JSON.stringify({ error: 'tool_failed', detail: message }),
            };
          }
        }
      }
      transcript = [...transcript, resultMessage];
      if (
        !componentGapRepairNudged &&
        typeof resultMessage.content === 'string' &&
        ['apply_patch', 'validate_screen_craft', 'write_file'].includes(call.name)
      ) {
        pendingComponentGapRepair = componentGapRepairFromToolResult(
          call.name,
          resultMessage.content,
        );
      }
      await logDev(input.devLogger, 'tool.result', {
        iteration: iterations,
        tool: call.name,
        callId: call.id,
        status: toolStatus,
        durationMs: Date.now() - startedAt,
        arguments: compactForAgentLog(call.arguments),
        result: compactForAgentLog(resultMessage.content),
      });
      audit({
        kind: 'config',
        user: input.toolContext.user,
        latencyMs: Date.now() - startedAt,
        errorMessage: `tool=${call.name} call=${call.id}`,
      });
    }

    if (pendingComponentGapRepair && !shouldTruncateAfterTools) {
      componentGapRepairNudged = true;
      transcript = [
        ...transcript,
        { role: 'user', content: componentGapRepairNudge(pendingComponentGapRepair) },
      ];
      await recordToolReceiptSafely({
        workspacePath: input.toolContext.workspacePath,
        runId: input.toolContext.runId,
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
    }

    if (shouldTruncateAfterTools) {
      truncated = true;
      audit({
        kind: 'error',
        user: input.toolContext.user,
        provider: lastResponse.provider,
        model: lastResponse.model,
        latencyMs: Date.now() - turnStart,
        errorMessage: `agent loop truncated at iteration=${iterations}`,
      });
      break;
    }
  }

  const normalizedUsage = normalizeAssistantTokenUsage(aggregateUsage);
  const finalResponse: ChatResponse = {
    ...lastResponse!,
    ...(normalizedUsage ? { usage: normalizedUsage } : {}),
  };
  await logDev(input.devLogger, 'run.end', {
    iterations,
    truncated,
    finalResponse: chatResponseForAgentLog(finalResponse),
  });

  return {
    finalResponse,
    transcript,
    iterations,
    truncated,
  };
}

async function logDev(
  logger: AgentDevRunLogger | null | undefined,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  await logger?.log(event, data).catch(() => undefined);
}

function permissionResult(decision: AgentToolPermissionDecision): Record<string, unknown> {
  const detail = `Agent permission ${decision.action} for ${String(decision.category)} "${decision.resource}" via pattern "${decision.pattern}".`;
  if (decision.action === 'deny') {
    return {
      error: decision.reasonCode ?? 'agent_permission_denied',
      detail,
      permission: decision,
    };
  }
  return {
    status: 'permission_required',
    detail,
    permission: decision,
  };
}

function throwIfRunAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new Error('Agent run cancelled.');
}
