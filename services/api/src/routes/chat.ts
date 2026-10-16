import { Hono } from 'hono';
import { z } from 'zod';
import {
  createGateway,
  promptAttachmentLimitsFromConfig,
  type ChatMessage,
} from '@sber-designer/llm-gateway';
import {
  normalizeAssistantSessionMode,
  type PromptAttachmentEvidence,
} from '@sber-designer/shared-types';

import { loadAgentToolsForContext } from '../agent/toolset';
import { runAgent } from '../agent/loop';
import {
  buildProviderMultimodalMessages,
  providerImageTransportForAgentTarget,
} from '../agent/multimodal-messages';
import { createAgentDevRunLogger } from '../agent/dev-log';
import {
  agentRunManifestPath,
  completeAgentRun,
  createAgentRun,
  readAgentRunReceipts,
  recordComponentPackSafely,
  recordRunTranscriptSafely,
  recordScreenStructurePlanSafely,
  summarizeComponentReuseFromReceipts,
  type AgentRunTargetCapabilities,
} from '../agent/run-recorder';
import {
  readPromptAttachmentEvidenceFromContinuationMessages,
  writeRunContinuationContextSnapshot,
} from '../agent/continuation-context';
import { CLAUDE_CODE_RUNTIME_PROVIDER } from '../agent-runtimes/claude-runner';
import { CODEX_RUNTIME_PROVIDER } from '../agent-runtimes/codex-runner';
import { GIGACODE_RUNTIME_PROVIDER } from '../agent-runtimes/gigacode-runner';
import { KIMI_RUNTIME_PROVIDER } from '../agent-runtimes/kimi-runner';
import { OPENCODE_RUNTIME_PROVIDER } from '../agent-runtimes/opencode-runner';
import { latestUserRequest } from '../agent-runtimes/handoff-prompt';
import {
  isCliRuntimeProvider,
  resolveAgentModelTarget,
  type AgentModelTarget,
} from '../agent-model-target';
import { resolvePrimaryAgent, resolveRequestedAgent } from '../agent-kit/active-agent';
import { loadAgentKit } from '../agent-kit/loader';
import { AgentKitSkillNameSchema } from '../agent-kit/schema';
import { audit } from '../audit';
import { getSessionUser, getUser } from '../auth';
import { loadConfig } from '../config-store';
import { GenerationOptionsSchema, screenCraftProfileForGeneration } from '../generation-mode';
import { loadMcpToolsForAgentContext } from '../mcp/agent-tools';
import { buildSystemPrompt, runtimeIdentityPromptInputForTarget } from '../prompt-builder';
import {
  formatPromptAttachmentReferences,
  PromptAttachmentUploadSchema,
  recordPromptAttachments,
  updateRunManifestPromptAttachments,
  validatePromptAttachmentEvidenceForTarget,
  validatePromptAttachmentsForTarget,
} from '../prompt-attachments';
import { getState } from '../state-store';
import { sessionModeEnforcementForRuntime } from '../session-mode';
import {
  buildRunScreenStructurePlan,
  loadRunComponentPack,
  resolveTaskRelevantComponentTaskKind,
} from './chat-stream/run-context';

const ContentPartSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }).strict(),
  z
    .object({
      type: z.literal('image_url'),
      image_url: z
        .object({
          url: z.string().min(1),
          detail: z.enum(['auto', 'low', 'high']).optional(),
        })
        .strict(),
    })
    .strict(),
]);

const ChatRequestSchema = z
  .object({
    messages: z
      .array(
        z
          .object({
            role: z.enum(['system', 'user', 'assistant', 'tool']),
            content: z.union([z.string(), z.array(ContentPartSchema).min(1)]),
            toolCallId: z.string().optional(),
            toolCalls: z
              .array(
                z
                  .object({
                    id: z.string(),
                    name: z.string(),
                    arguments: z.string(),
                  })
                  .strict(),
              )
              .optional(),
          })
          .strict(),
      )
      .min(1),
    /** Override provider/model for this call only (optional). */
    provider: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    primaryAgent: AgentKitSkillNameSchema.optional(),
    agent: AgentKitSkillNameSchema.optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
    maxIterations: z.number().int().min(1).max(20).optional(),
    attachments: z.array(PromptAttachmentUploadSchema).max(4).default([]),
    generation: GenerationOptionsSchema.optional(),
    sessionMode: z.enum(['ask', 'plan', 'design']).default('design'),
    /**
     * Whether to prepend a server-built system prompt with project context
     * (catalog + selection + mode). Default true. See ADR-0012.
     */
    attachContext: z.boolean().default(true),
    /**
     * Whether to expose the agent toolset (apply_patch, list_components,
     * etc.) and run an agent loop. Default true. ADR-0014.
     */
    enableTools: z.boolean().default(true),
  })
  .strict();

const SummarizeTaskRequestSchema = z
  .object({
    messages: z
      .array(
        z
          .object({
            role: z.enum(['user', 'assistant']),
            content: z.string(),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();

/**
 * POST /api/chat — agent loop with tool-calling.
 *
 * Server-side resolves the active provider from sber-designer.json,
 * prepends a system prompt with project context (ADR-0012), exposes
 * the api toolset (ADR-0014), and runs an LLM ↔ tools loop until the
 * model produces a final answer or hits the iteration cap.
 *
 * Returns the final response plus the full transcript so the browser
 * can render every tool call. Secrets never leave the server.
 *
 * `claude-code-bridge` (pseudo-provider) is rejected with 409 — when
 * bridge mode is on, the UI should not call /api/chat (ADR-0006).
 */
export const chatRouter = new Hono()
  .post('/summarize-task', async (c) => {
    const user = getUser(c);
    const raw = await c.req.json().catch(() => null);
    const parse = SummarizeTaskRequestSchema.safeParse(raw);
    if (!parse.success) {
      return c.json({ error: 'invalid_input', detail: parse.error.message }, 400);
    }

    const fallback = fallbackTaskSummary(parse.data.messages);
    let cfg;
    try {
      cfg = await loadConfig();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `summary config: ${message}` });
      return c.json({ ...fallback, source: 'fallback' as const });
    }

    try {
      const gateway = createGateway(cfg);
      const transcript = parse.data.messages
        .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
        .join('\n\n');
      const response = await gateway.chat({
        temperature: 0.2,
        maxTokens: 180,
        messages: [
          {
            role: 'system',
            content:
              'Summarize this design-assistant task for a chat history UI. Return compact JSON only: {"title":"5-7 words","summary":"one short sentence"}.',
          },
          { role: 'user', content: transcript },
        ],
      });
      return c.json({ ...parseSummaryResponse(response.text, fallback), source: 'llm' as const });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `summary: ${message}` });
      return c.json({ ...fallback, source: 'fallback' as const });
    }
  })
  .post('/', async (c) => {
    const startedAt = Date.now();
    const user = getUser(c);
    const sessionUser = getSessionUser(c);

    const raw = await c.req.json().catch(() => null);
    const parse = ChatRequestSchema.safeParse(raw);
    if (!parse.success) {
      return c.json({ error: 'invalid_input', detail: parse.error.message }, 400);
    }

    let cfg;
    try {
      cfg = await loadConfig();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `config: ${message}` });
      return c.json({ error: 'config_load_failed', detail: message }, 500);
    }

    const override =
      parse.data.provider && parse.data.model
        ? { provider: parse.data.provider, model: parse.data.model }
        : undefined;
    const active = override ?? cfg.agent.default;

    if (
      active.provider === OPENCODE_RUNTIME_PROVIDER ||
      active.provider === CLAUDE_CODE_RUNTIME_PROVIDER ||
      active.provider === CODEX_RUNTIME_PROVIDER ||
      active.provider === KIMI_RUNTIME_PROVIDER ||
      active.provider === GIGACODE_RUNTIME_PROVIDER
    ) {
      return c.json(
        {
          error: 'runtime_stream_only',
          detail: 'Local CLI runtimes use /api/chat/stream so the editor can show CLI output.',
        },
        409,
      );
    }

    if (cfg.provider[active.provider]?.type === 'claude-code') {
      audit({ kind: 'error', user, provider: active.provider, errorMessage: 'bridge_no_chat' });
      return c.json(
        {
          error: 'bridge_no_chat',
          detail:
            'Active provider is the Claude Code bridge — the editor should route to proj-mcp instead of calling /api/chat.',
        },
        409,
      );
    }

    const agentTarget = resolveAgentModelTarget({ config: cfg, active });
    const blockingTargetDiagnostic = agentTarget.diagnostics.find(
      (diagnostic) => diagnostic.severity === 'error',
    );
    if (blockingTargetDiagnostic) {
      audit({
        kind: 'error',
        user,
        provider: active.provider,
        errorMessage: blockingTargetDiagnostic.code,
      });
      return c.json(
        {
          error: blockingTargetDiagnostic.code,
          detail: blockingTargetDiagnostic.detail,
        },
        503,
      );
    }
    const targetCapabilities = agentRunTargetCapabilities(agentTarget);
    const attachmentValidation = validatePromptAttachmentsForTarget({
      attachments: parse.data.attachments,
      target: agentTarget,
    });
    if (!attachmentValidation.ok) {
      return c.json(
        {
          error: attachmentValidation.code ?? 'model_cannot_read_images',
          detail:
            attachmentValidation.detail ??
            'The selected model cannot read the attached image input.',
        },
        400,
      );
    }
    const gateway = createGateway(cfg, override ? { override } : {});

    // Pull state once at the start of the loop so all tool calls share
    // a consistent view (the user is unlikely to change selection while
    // the agent is mid-turn).
    const state = getState();
    const sessionMode = normalizeAssistantSessionMode(parse.data.sessionMode);
    const userGoal = latestUserRequest(parse.data.messages);
    const screenCraftProfile = screenCraftProfileForGeneration(parse.data.generation);
    const baseToolContext = {
      user,
      ...(sessionUser ? { userDisplayName: sessionUser.displayName } : {}),
      projectName: state.projectName ?? null,
      activeScreen: state.activeScreen ?? null,
      assistantTaskIntent: state.assistantTaskIntent ?? null,
      workspacePath: state.workspacePath ?? null,
      canvasUrl: state.canvasUrl ?? null,
      agentCraftPostCheckEnabled: state.agentCraftPostCheckEnabled ?? true,
      screenReadiness: state.screenReadiness ?? null,
      screenCraftProfile,
      sessionMode,
    };
    const kit = await loadAgentKit({ workspacePath: baseToolContext.workspacePath });
    const primaryAgent = resolvePrimaryAgent(kit, parse.data.primaryAgent);
    if (!primaryAgent.ok) {
      return c.json({ error: primaryAgent.code, detail: primaryAgent.detail }, 400);
    }
    const requestedAgent = parse.data.agent
      ? resolveRequestedAgent(kit, parse.data.agent)
      : primaryAgent;
    if (!requestedAgent.ok) {
      return c.json({ error: requestedAgent.code, detail: requestedAgent.detail }, 400);
    }
    const activeAgent = requestedAgent.agent;
    const productMcp =
      parse.data.enableTools && sessionMode === 'design'
        ? await loadMcpToolsForAgentContext({
            activeProviderType: active.provider,
            activeAgentName: activeAgent.name,
          })
        : { tools: [], diagnostics: [], promptBlock: '' };
    const agentRun = baseToolContext.workspacePath
      ? await createAgentRun({
          route: 'chat',
          user,
          provider: active.provider,
          model: active.model,
          runtimeKind: isCliRuntimeProvider(active.provider) ? 'cli' : 'api',
          sessionMode,
          modeEnforcement: sessionModeEnforcementForRuntime({
            sessionMode,
            targetKind: agentTarget.kind,
          }),
          targetCapabilities,
          projectName: state.projectName ?? null,
          userGoal,
          workspacePath: baseToolContext.workspacePath,
          activeScreen: state.activeScreen ?? null,
          assistantTaskIntent: state.assistantTaskIntent ?? null,
          generationMode: screenCraftProfile,
          designJuryRequested: parse.data.generation?.critique === true,
          ...(parse.data.generation?.designBrief
            ? { designBrief: parse.data.generation.designBrief }
            : {}),
          ...(parse.data.generation?.directionSelection
            ? { directionSelection: parse.data.generation.directionSelection }
            : {}),
        }).catch(() => null)
      : null;
    let promptAttachments: PromptAttachmentEvidence[] = [];
    try {
      const recordedAttachments =
        baseToolContext.workspacePath && agentRun
          ? await recordPromptAttachments({
              workspacePath: baseToolContext.workspacePath,
              runId: agentRun.runId,
              attachments: parse.data.attachments,
              limits: promptAttachmentLimitsFromConfig(cfg),
            })
          : [];
      const carriedAttachments =
        baseToolContext.workspacePath && agentRun && recordedAttachments.length === 0
          ? await readPromptAttachmentEvidenceFromContinuationMessages({
              workspacePath: baseToolContext.workspacePath,
              messages: parse.data.messages,
            })
          : [];
      promptAttachments = recordedAttachments.length > 0 ? recordedAttachments : carriedAttachments;
      if (baseToolContext.workspacePath && agentRun && carriedAttachments.length > 0) {
        await updateRunManifestPromptAttachments(
          baseToolContext.workspacePath,
          agentRun.runId,
          carriedAttachments,
        );
      }
      if (baseToolContext.workspacePath && agentRun) {
        await writeRunContinuationContextSnapshot({
          workspacePath: baseToolContext.workspacePath,
          runId: agentRun.runId,
          sessionId: `server-session-${agentRun.runId}`,
          screenId: state.activeScreen?.id ?? 'global',
          messages: parse.data.messages,
          activeTarget: activeTargetFromState(state),
          attachments: promptAttachments,
          runStatus: 'running',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'invalid_attachment', detail: message }, 400);
    }
    const promptAttachmentEvidenceValidation = validatePromptAttachmentEvidenceForTarget({
      attachments: promptAttachments,
      target: agentTarget,
    });
    if (!promptAttachmentEvidenceValidation.ok) {
      if (agentRun) {
        await completeAgentRun({
          workspacePath: agentRun.workspacePath,
          runId: agentRun.runId,
          status: 'failed',
          summary:
            promptAttachmentEvidenceValidation.detail ??
            promptAttachmentEvidenceValidation.code ??
            'model_cannot_read_images',
          diagnostics: {
            errorCode: promptAttachmentEvidenceValidation.code ?? 'model_cannot_read_images',
          },
        }).catch(() => undefined);
      }
      return c.json(
        {
          error: promptAttachmentEvidenceValidation.code ?? 'model_cannot_read_images',
          detail:
            promptAttachmentEvidenceValidation.detail ??
            'The selected model cannot read the carried image input.',
        },
        400,
      );
    }
    const taskKind = resolveTaskRelevantComponentTaskKind(state, promptAttachments, userGoal);
    const screenStructurePlan =
      sessionMode === 'design'
        ? buildRunScreenStructurePlan({
            state,
            messages: parse.data.messages,
            promptAttachments,
            designBrief: parse.data.generation?.designBrief ?? null,
            directionSelection: parse.data.generation?.directionSelection ?? null,
            surface: parse.data.generation?.surface ?? null,
            modal: parse.data.generation?.modal ?? null,
            taskKind,
          })
        : null;
    if (screenStructurePlan) {
      await recordScreenStructurePlanSafely({
        workspacePath: state.workspacePath ?? null,
        runId: agentRun?.runId,
        plan: screenStructurePlan,
      });
    }
    const componentPack =
      sessionMode === 'design'
        ? await loadRunComponentPack({
            workspacePath: state.workspacePath ?? null,
            state,
            messages: parse.data.messages,
            promptAttachments,
            agentName: activeAgent.name,
            designBrief: parse.data.generation?.designBrief ?? null,
            screenStructurePlan,
            taskKind: screenStructurePlan?.taskKind ?? taskKind,
          })
        : null;
    if (componentPack) {
      await recordComponentPackSafely({
        workspacePath: state.workspacePath ?? null,
        runId: agentRun?.runId,
        componentPack,
      });
    }
    const toolContext = {
      ...baseToolContext,
      runId: agentRun?.runId ?? null,
      componentPack,
      screenStructurePlan,
    };

    // Build the system prompt (catalog + selection + behavior).
    let messages: ChatMessage[] = await buildProviderMultimodalMessages({
      workspacePath: baseToolContext.workspacePath ?? '',
      messages: parse.data.messages as ChatMessage[],
      attachments: promptAttachments,
      imageTransport: providerImageTransportForAgentTarget(agentTarget),
    });
    let contextSize: number | undefined;
    let catalogStatus: 'attached' | 'unavailable' | 'no_project' | 'skipped' = 'skipped';
    if (parse.data.attachContext) {
      const built = await buildSystemPrompt({
        state,
        sessionMode,
        agentName: activeAgent.name,
        taskKind,
        userRequest: userGoal,
        componentPack,
        screenStructurePlan,
        generation: parse.data.generation ?? null,
        runtimeIdentity: runtimeIdentityPromptInputForTarget({
          target: agentTarget,
          providerLabel: cfg.provider[active.provider]?.name,
          modelLabel: cfg.provider[active.provider]?.models?.[active.model]?.name,
        }),
      });
      contextSize = built.contextSize;
      catalogStatus = built.catalogStatus;
      const attachmentReferences = formatPromptAttachmentReferences(promptAttachments);
      messages = [
        {
          role: 'system',
          content: [built.text, productMcp.promptBlock, attachmentReferences]
            .filter(Boolean)
            .join('\n\n'),
        },
        ...messages,
      ];
    }

    const tools = parse.data.enableTools
      ? await loadAgentToolsForContext(toolContext, {
          agent: activeAgent,
          mcpTools: productMcp.tools,
        })
      : [];
    const maxIterations = parse.data.maxIterations ?? activeAgent.maxIterations ?? 6;
    const temperature = parse.data.temperature ?? activeAgent.temperature;
    const devLogger = await createAgentDevRunLogger({
      route: 'chat',
      user,
      provider: active.provider,
      model: active.model,
      state,
      messages,
      maxIterations,
    });

    try {
      const result = await runAgent({
        gateway,
        messages,
        tools,
        toolContext,
        maxIterations,
        permission: activeAgent.permission,
        signal: c.req.raw.signal,
        devLogger,
        ...(parse.data.model ? { modelOverride: parse.data.model } : {}),
        ...(temperature !== undefined ? { temperature } : {}),
        ...(parse.data.maxTokens !== undefined ? { maxTokens: parse.data.maxTokens } : {}),
      });
      await recordRunTranscriptSafely({
        workspacePath: toolContext.workspacePath,
        runId: agentRun?.runId,
        source: 'chat',
        transcript: result.transcript,
      });
      await completeAgentRun({
        workspacePath: toolContext.workspacePath,
        runId: agentRun?.runId,
        status: 'complete',
        summary: `Completed ${result.iterations} agent turn${result.iterations === 1 ? '' : 's'}${result.truncated ? ' before hitting the iteration cap' : ''}.`,
        metrics: {
          iterations: result.iterations,
          ...result.finalResponse.usage,
        },
      }).catch(() => undefined);
      const componentReuse =
        toolContext.workspacePath && agentRun
          ? summarizeComponentReuseFromReceipts(
              await readAgentRunReceipts(toolContext.workspacePath, agentRun.runId).catch(() => []),
            )
          : null;

      audit({
        kind: 'chat',
        user,
        provider: result.finalResponse.provider,
        model: result.finalResponse.model,
        latencyMs: Date.now() - startedAt,
        errorMessage: `iterations=${result.iterations}${result.truncated ? ' truncated' : ''} context=${catalogStatus} components=${contextSize ?? 0}${devLogger ? ` log=${devLogger.filePath}` : ''}`,
        ...(result.finalResponse.usage?.inputTokens !== undefined
          ? { promptTokens: result.finalResponse.usage.inputTokens }
          : {}),
        ...(result.finalResponse.usage?.outputTokens !== undefined
          ? { completionTokens: result.finalResponse.usage.outputTokens }
          : {}),
      });

      return c.json({
        ...result.finalResponse,
        transcript: result.transcript,
        iterations: result.iterations,
        truncated: result.truncated,
        ...(devLogger ? { debugLogPath: devLogger.filePath } : {}),
        ...(agentRun
          ? {
              runId: agentRun.runId,
              runManifestPath: agentRunManifestPath(agentRun.runId),
            }
          : {}),
        ...(componentReuse ? { componentReuse } : {}),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await completeAgentRun({
        workspacePath: toolContext.workspacePath,
        runId: agentRun?.runId,
        status: 'failed',
        summary: message,
      }).catch(() => undefined);
      audit({
        kind: 'error',
        user,
        provider: active.provider,
        model: active.model,
        latencyMs: Date.now() - startedAt,
        errorMessage: message,
      });
      return c.json({ error: 'chat_failed', detail: message }, 502);
    }
  });

function fallbackTaskSummary(messages: { role: 'user' | 'assistant'; content: string }[]): {
  title: string;
  summary: string;
} {
  const firstUser = messages.find((message) => message.role === 'user' && message.content.trim());
  const source = firstUser?.content.trim() || messages[0]?.content.trim() || 'Assistant task';
  const compact = source.replace(/\s+/g, ' ');
  const title = compact.length > 42 ? `${compact.slice(0, 39)}...` : compact;
  return {
    title: title || 'Assistant task',
    summary: compact.length > 120 ? `${compact.slice(0, 117)}...` : compact,
  };
}

function parseSummaryResponse(
  text: string,
  fallback: { title: string; summary: string },
): { title: string; summary: string } {
  const trimmed = text.trim();
  const jsonText = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed;
  try {
    const parsed = JSON.parse(jsonText) as { title?: unknown; summary?: unknown };
    const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    return {
      title: title || fallback.title,
      summary: summary || fallback.summary,
    };
  } catch {
    return fallback;
  }
}

function agentRunTargetCapabilities(target: AgentModelTarget): AgentRunTargetCapabilities {
  return {
    targetKind: target.kind,
    runtimeKind: target.runtimeKind,
    imageInputMode: target.imageInputMode,
    imageDeliveryMode: target.capabilities.imageDeliveryMode,
    rasterImageInput: target.capabilities.rasterImageInput,
    svgSourceInput: target.capabilities.svgSourceInput,
    nativeFileInput: target.capabilities.nativeFileInput,
    projectMcpTools: target.capabilities.projectMcpTools,
    ownMcpConfig: target.capabilities.ownMcpConfig,
    ...(target.capabilities.mcpExpectedTargets.length > 0
      ? { mcpExpectedTargets: target.capabilities.mcpExpectedTargets }
      : {}),
  };
}

function activeTargetFromState(state: ReturnType<typeof getState>) {
  const screen = state.activeScreen;
  if (!screen) return null;
  return {
    screenId: screen.id,
    screenName: screen.name,
    ...(screen.implementationFilePath
      ? { implementationFilePath: screen.implementationFilePath }
      : {}),
    ...(screen.filePath ? { storyFilePath: screen.filePath } : {}),
  };
}
