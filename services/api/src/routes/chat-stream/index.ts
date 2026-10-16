/**
 * /api/chat/stream router. Branch implementations live in the sibling
 * modules (task 0078, KT2); this index owns the route handlers and
 * re-exports the public surface so the old import path keeps working.
 */
import { Hono } from 'hono';
import {
  agentConcurrencyFromConfig,
  agentContextBudgetFromConfig,
  createGateway,
  promptAttachmentLimitsFromConfig,
  type ChatMessage,
} from '@sber-designer/llm-gateway';
import {
  normalizeAssistantSessionMode,
  type ProjectAssistantSession,
} from '@sber-designer/shared-types';
import { loadAgentToolsForContext } from '../../agent/toolset';
import {
  buildProviderMultimodalMessages,
  providerImageTransportForAgentTarget,
} from '../../agent/multimodal-messages';
import { createAgentAttemptLogger, createAgentDevRunLogger } from '../../agent/dev-log';
import {
  agentRunManifestPath,
  completeAgentRun,
  createAgentRun,
  recordComponentPackSafely,
  recordScreenStructurePlanSafely,
  recordToolReceiptSafely,
  type AgentRunRuntimeSessionDiagnostics,
  type AgentRunManifest,
  type CompleteAgentRunInput,
} from '../../agent/run-recorder';
import {
  configureAgentRunCoordinator,
  getAgentRunCoordinator,
  type AgentRunCoordinator,
  type AgentRunLease,
} from '../../agent/run-coordinator';
import { resolveAgentPermissionRequest } from '../../agent/permission-requests';
import { resolvePrimaryAgent, resolveRequestedAgent } from '../../agent-kit/active-agent';
import { loadAgentKit } from '../../agent-kit/loader';
import { audit } from '../../audit';
import { getSessionUser, getUser } from '../../auth';
import { latestUserRequest } from '../../agent-runtimes/handoff-prompt';
import { resolveAgentModelTarget } from '../../agent-model-target';
import { loadConfig } from '../../config-store';
import { loadMcpToolsForAgentContext } from '../../mcp/agent-tools';
import { getProject, saveAssistantSessionRunMetadata } from '../../project-store';
import { buildSystemPrompt, runtimeIdentityPromptInputForTarget } from '../../prompt-builder';
import {
  formatPromptAttachmentReferences,
  validatePromptAttachmentsForTarget,
  validatePromptAttachmentEvidenceForTarget,
} from '../../prompt-attachments';
import { getState } from '../../state-store';
import { assertWorkspacePathForIdentity, requestStorageIdentity } from '../../user-storage';
import { streamBuiltInAgentRun } from './built-in-stream';
import { handleExternalRuntimeRoute } from './external-route';
import {
  ResolvePermissionSchema,
  StreamChatRequestSchema,
  resolveInitialEditorStateForChat,
  selectRunCanvasUrl,
} from './request-schema';
import {
  agentRunTargetCapabilities,
  buildRunScreenStructurePlan,
  chatRunTargetPaths,
  combineAbortSignals,
  compactRunTitle,
  loadExternalRuntimeProjectIndexContext,
  loadRunComponentPack,
  resolveTaskRelevantComponentTaskKind,
  validateHtmlDesignSystemApplyPreflight,
} from './run-context';
import { linkAgentLogEvidence, recordPromptAttachmentsForRun } from './evidence';
import { finalizeBuiltInRunDone, resolveBuiltInRunCompletion } from './built-in';
import { resolveDesignJuryRunPlan } from './design-jury-finalization';
import { runtimeKindForProvider, streamExternalRuntimeHandoff } from './external';
import { externalRuntimeDispatchForProvider } from './external-dispatch';
import { screenCraftProfileForGeneration } from '../../generation-mode';
import { sessionModeEnforcementForRuntime } from '../../session-mode';
import { recordScreenRedesignBaseline } from '../../screen-redesign-fidelity';

export { resolveBuiltInRunCompletion, finalizeBuiltInRunDone } from './built-in';
export { streamExternalRuntimeHandoff } from './external';
export { recordRuntimeRenderHealthSafely } from './render-health';
export {
  resolveInitialEditorStateForChat,
  selectRunCanvasUrl,
  type ChatEditorContext,
} from './request-schema';
export { resolveTaskRelevantComponentTaskKind } from './run-context';

type AssistantSessionRunStatus = NonNullable<ProjectAssistantSession['metadata']>['lastRunStatus'];

async function recordRunIdentityReceipt(input: {
  agentRun: AgentRunManifest;
  provider: string;
  model: string;
  runtimeKind: AgentRunManifest['runtimeKind'];
  screenName: string | null;
  screenId: string | null;
  workspacePath: string | null;
}): Promise<void> {
  const screenLabel = input.screenName?.trim() || input.screenId?.trim() || 'no screen';
  await recordToolReceiptSafely({
    workspacePath: input.workspacePath,
    runId: input.agentRun.runId,
    tool: 'run_identity',
    status: 'ok',
    changedFiles: [],
    summary: `Started ${input.provider} / ${input.model} on ${screenLabel} (${input.agentRun.runId}).`,
    metadata: {
      provider: input.provider,
      model: input.model,
      runtimeKind: input.runtimeKind,
      screenName: input.screenName,
      screenId: input.screenId,
      runId: input.agentRun.runId,
      contextEligible: false,
    },
  });
}

export const chatStreamRouter = new Hono()
  .post('/permission/:id', async (c) => {
    const user = getUser(c);
    const id = c.req.param('id');
    const raw = await c.req.json().catch(() => null);
    const parse = ResolvePermissionSchema.safeParse(raw);
    if (!parse.success) {
      return c.json({ error: 'invalid_input', detail: parse.error.message }, 400);
    }
    const result = resolveAgentPermissionRequest({
      id,
      user,
      decision: parse.data.decision,
      ...(parse.data.remember ? { remember: true } : {}),
    });
    if (!result.ok) {
      return c.json({ error: 'permission_request_not_found' }, 404);
    }
    return c.json({ ok: true });
  })
  .post('/', async (c) => {
    const user = getUser(c);
    const sessionUser = getSessionUser(c);
    const raw = await c.req.json().catch(() => null);
    const parse = StreamChatRequestSchema.safeParse(raw);
    if (!parse.success) {
      return c.json({ error: 'invalid_input', detail: parse.error.message }, 400);
    }

    const requestedWorkspace = parse.data.editorContext?.workspacePath;
    if (requestedWorkspace) {
      try {
        await assertWorkspacePathForIdentity(requestStorageIdentity(c), requestedWorkspace);
      } catch (error) {
        return c.json(
          {
            error: 'workspace_outside_user_root',
            detail: error instanceof Error ? error.message : String(error),
          },
          422,
        );
      }
    }

    const initialState = resolveInitialEditorStateForChat(
      getState(parse.data.editorContext?.workspacePath),
      parse.data.editorContext,
    );
    const sessionMode = normalizeAssistantSessionMode(parse.data.sessionMode);
    const screenCraftProfile = screenCraftProfileForGeneration(parse.data.generation);
    const userGoal = latestUserRequest(parse.data.messages);
    const attemptLogger = await createAgentAttemptLogger({
      route: 'chat-stream',
      user,
      provider: parse.data.provider ?? null,
      model: parse.data.model ?? null,
      state: initialState,
      userGoal,
      messageCount: parse.data.messages.length,
    });
    const clientRunId = parse.data.clientRunId ?? `server-${Date.now().toString(36)}`;
    const sessionId = parse.data.sessionId ?? `server-session-${clientRunId}`;
    const screenId = parse.data.screenId ?? initialState.activeScreen?.id ?? 'global';
    const previousSessionMetadata = getProject().assistant?.sessions.find(
      (session) => session.id === sessionId,
    )?.metadata;
    const attemptErrorMetadata = (agentRun?: AgentRunManifest | null) => ({
      ...(attemptLogger
        ? { attemptId: attemptLogger.attemptId, debugLogPath: attemptLogger.filePath }
        : {}),
      ...(agentRun ? { runManifestPath: agentRunManifestPath(agentRun.runId) } : {}),
    });
    const persistRunSessionMetadata = async (input: {
      agentRun?: AgentRunManifest | null;
      runStatus?: AssistantSessionRunStatus;
      runSummary?: string | null;
      runErrorCode?: string | null;
      runtimeSession?: AgentRunRuntimeSessionDiagnostics | null;
    }) => {
      await saveAssistantSessionRunMetadata({
        sessionId,
        ...(input.agentRun ? { runManifestPath: agentRunManifestPath(input.agentRun.runId) } : {}),
        ...(input.runStatus !== undefined ? { runStatus: input.runStatus } : {}),
        ...(input.runSummary !== undefined ? { runSummary: input.runSummary } : {}),
        ...(input.runErrorCode !== undefined ? { runErrorCode: input.runErrorCode } : {}),
        ...(input.runtimeSession ? { runtimeSession: input.runtimeSession } : {}),
      }).catch(() => undefined);
    };
    let activeLease: AgentRunLease | null = null;
    const failBeforeStream = async (
      body: {
        error: string;
        detail?: string;
        activeRuns?: ReturnType<AgentRunCoordinator['activeRuns']>;
        blockingRun?: ReturnType<AgentRunCoordinator['activeRuns']>[number];
      },
      status: 400 | 403 | 409 | 500 | 503,
      agentRun?: AgentRunManifest | null,
      diagnostics?: CompleteAgentRunInput['diagnostics'],
    ) => {
      if (activeLease) {
        getAgentRunCoordinator().release(activeLease.leaseId);
        activeLease = null;
      }
      await attemptLogger?.log('preflight.rejected', {
        status: 'rejected',
        errorCode: body.error,
        ...(body.detail ? { detail: body.detail } : {}),
        ...(agentRun
          ? { runId: agentRun.runId, runManifestPath: agentRunManifestPath(agentRun.runId) }
          : {}),
      });
      if (agentRun) {
        await completeAgentRun({
          workspacePath: agentRun.workspacePath,
          runId: agentRun.runId,
          status: 'failed',
          summary: body.detail ?? body.error,
          diagnostics: {
            ...diagnostics,
            ...(attemptLogger
              ? {
                  attemptId: attemptLogger.attemptId,
                  attemptLogPath: attemptLogger.filePath,
                  debugLogPath: attemptLogger.filePath,
                }
              : {}),
            runManifestPath: agentRunManifestPath(agentRun.runId),
            errorCode: body.error,
          },
        }).catch(() => undefined);
      }
      await persistRunSessionMetadata({
        ...(agentRun !== undefined ? { agentRun } : {}),
        runStatus: 'preflight_rejected',
        runSummary: body.detail ?? body.error,
        runErrorCode: body.error,
      });
      return c.json({ ...body, ...attemptErrorMetadata(agentRun) }, status);
    };

    let cfg;
    try {
      cfg = await loadConfig();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `config: ${message}` });
      return failBeforeStream({ error: 'config_load_failed', detail: message }, 500);
    }

    const override =
      parse.data.provider && parse.data.model
        ? { provider: parse.data.provider, model: parse.data.model }
        : undefined;
    const active = override ?? cfg.agent.default;
    const agentTarget = resolveAgentModelTarget({ config: cfg, active });
    const attachmentValidation = validatePromptAttachmentsForTarget({
      attachments: parse.data.attachments,
      target: agentTarget,
    });
    const targetCapabilities = agentRunTargetCapabilities(agentTarget);
    await attemptLogger?.log('preflight.target', {
      provider: active.provider,
      model: active.model,
      providerKnown: Boolean(cfg.provider[active.provider]) || agentTarget.kind === 'cli',
      runtimeKind: runtimeKindForProvider(active.provider),
      canvasUrl: initialState.canvasUrl ?? null,
      agentTarget: targetCapabilities,
      diagnostics: agentTarget.diagnostics,
      attachmentValidation: attachmentValidation.ok
        ? {
            ok: true,
            warnings: attachmentValidation.warnings,
          }
        : {
            ok: false,
            code: attachmentValidation.code,
            detail: attachmentValidation.detail,
          },
    });
    if (!attachmentValidation.ok) {
      return failBeforeStream(
        {
          error: attachmentValidation.code ?? 'model_cannot_read_images',
          detail:
            attachmentValidation.detail ??
            'The selected model cannot read the attached image input.',
        },
        400,
      );
    }
    const blockingTargetDiagnostic = agentTarget.diagnostics.find(
      (diagnostic) => diagnostic.severity === 'error',
    );
    if (blockingTargetDiagnostic) {
      return failBeforeStream(
        {
          error: blockingTargetDiagnostic.code,
          detail: blockingTargetDiagnostic.detail,
        },
        503,
      );
    }
    if (attachmentValidation.warnings.length > 0) {
      await attemptLogger?.log('preflight.attachments.warning', {
        provider: active.provider,
        model: active.model,
        runtimeKind: agentTarget.runtimeKind,
        imageInputMode: agentTarget.imageInputMode,
        warnings: attachmentValidation.warnings,
      });
    }
    const promptAttachmentLimits = promptAttachmentLimitsFromConfig(cfg);
    const contextBudgetPolicy = agentContextBudgetFromConfig(cfg);
    const runCoordinator = configureAgentRunCoordinator(agentConcurrencyFromConfig(cfg));
    const acquire = runCoordinator.acquire({
      clientRunId,
      sessionId,
      screenId,
      provider: active.provider,
      model: active.model,
      sessionMode,
      runtimeKind: runtimeKindForProvider(active.provider),
      ...(sessionUser ? { displayName: sessionUser.displayName } : {}),
      title: compactRunTitle(userGoal),
      targetPaths: chatRunTargetPaths(initialState, userGoal),
    });
    if (!acquire.ok) {
      return failBeforeStream(
        {
          error: acquire.code,
          detail: acquire.reason,
          activeRuns: acquire.activeRuns,
          ...(acquire.blockingRun ? { blockingRun: acquire.blockingRun } : {}),
        },
        409,
      );
    }
    activeLease = acquire.lease;
    const preflightRun = initialState.workspacePath
      ? await createAgentRun({
          route: 'chat-stream',
          user,
          provider: active.provider,
          model: active.model,
          runtimeKind: runtimeKindForProvider(active.provider),
          sessionMode,
          modeEnforcement: sessionModeEnforcementForRuntime({
            sessionMode,
            targetKind: agentTarget.kind,
          }),
          targetCapabilities,
          projectName: initialState.projectName ?? null,
          userGoal,
          workspacePath: initialState.workspacePath,
          activeScreen: initialState.activeScreen ?? null,
          assistantTaskIntent: initialState.assistantTaskIntent ?? null,
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
    if (activeLease && preflightRun) {
      runCoordinator.attachRun(activeLease.leaseId, {
        runId: preflightRun.runId,
        runManifestPath: agentRunManifestPath(preflightRun.runId),
      });
    }
    await attemptLogger?.log('preflight.run', {
      status: preflightRun ? 'run_created' : 'no_workspace',
      provider: active.provider,
      model: active.model,
      ...(preflightRun
        ? { runId: preflightRun.runId, runManifestPath: agentRunManifestPath(preflightRun.runId) }
        : {}),
    });
    if (preflightRun) {
      await attemptLogger?.logLink({
        runId: preflightRun.runId,
        runManifestPath: agentRunManifestPath(preflightRun.runId),
      });
      await persistRunSessionMetadata({
        agentRun: preflightRun,
        runStatus: 'running',
      });
      await recordRunIdentityReceipt({
        agentRun: preflightRun,
        provider: active.provider,
        model: active.model,
        runtimeKind: runtimeKindForProvider(active.provider),
        screenName: initialState.activeScreen?.name ?? null,
        screenId: initialState.activeScreen?.id ?? null,
        workspacePath: initialState.workspacePath ?? null,
      });
    }
    const runtimeAbortController = new AbortController();
    const runSignal = activeLease
      ? combineAbortSignals(
          combineAbortSignals(c.req.raw.signal, activeLease.controller.signal),
          runtimeAbortController.signal,
        )
      : combineAbortSignals(c.req.raw.signal, runtimeAbortController.signal);

    const preflightProjectIndex = await loadExternalRuntimeProjectIndexContext(
      initialState.workspacePath,
    );
    const htmlDesignSystemApplyPreflight = validateHtmlDesignSystemApplyPreflight({
      userRequest: userGoal,
      htmlDesignSystem: preflightProjectIndex?.htmlDesignSystem ?? null,
    });
    if (htmlDesignSystemApplyPreflight) {
      return failBeforeStream(htmlDesignSystemApplyPreflight, 400, preflightRun);
    }

    const externalDispatch = externalRuntimeDispatchForProvider(active.provider);
    if (externalDispatch) {
      return handleExternalRuntimeRoute({
        c,
        activeLease,
        active,
        agentTarget,
        attachmentValidation,
        attemptLogger,
        contextBudgetPolicy,
        dispatch: externalDispatch,
        failBeforeStream,
        initialState,
        parse,
        persistRunSessionMetadata,
        preflightRun,
        previousSessionMetadata,
        promptAttachmentLimits,
        runCoordinator,
        runSignal,
        runtimeAbortController,
        screenCraftProfile,
        screenId,
        sessionId,
        sessionMode,
        targetCapabilities,
        user,
        userGoal,
      });
    }

    if (cfg.provider[active.provider]?.type === 'claude-code') {
      return failBeforeStream(
        {
          error: 'bridge_no_chat',
          detail: 'Claude Code bridge does not support /api/chat/stream.',
        },
        409,
        preflightRun,
      );
    }

    const gateway = createGateway(cfg, override ? { override } : {});

    const state = initialState;
    const runAllowedWriteTargets = chatRunTargetPaths(state, userGoal);
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
      runAllowedWriteTargets,
      sessionMode,
    };
    const kit = await loadAgentKit({ workspacePath: baseToolContext.workspacePath });
    const primaryAgent = resolvePrimaryAgent(kit, parse.data.primaryAgent);
    if (!primaryAgent.ok) {
      return failBeforeStream(
        { error: primaryAgent.code, detail: primaryAgent.detail },
        400,
        preflightRun,
      );
    }
    const requestedAgent = parse.data.agent
      ? resolveRequestedAgent(kit, parse.data.agent)
      : primaryAgent;
    if (!requestedAgent.ok) {
      return failBeforeStream(
        { error: requestedAgent.code, detail: requestedAgent.detail },
        400,
        preflightRun,
      );
    }
    const activeAgent = requestedAgent.agent;
    const productMcp =
      parse.data.enableTools && sessionMode === 'design'
        ? await loadMcpToolsForAgentContext({
            activeProviderType: active.provider,
            activeAgentName: activeAgent.name,
          })
        : { tools: [], diagnostics: [], promptBlock: '' };
    const agentRun = preflightRun;
    const promptAttachments = await recordPromptAttachmentsForRun({
      workspacePath: baseToolContext.workspacePath,
      agentRun,
      attachments: parse.data.attachments,
      limits: promptAttachmentLimits,
      messages: parse.data.messages,
      state,
      sessionId,
      screenId,
    });
    const promptAttachmentEvidenceValidation = validatePromptAttachmentEvidenceForTarget({
      attachments: promptAttachments,
      target: agentTarget,
    });
    if (!promptAttachmentEvidenceValidation.ok) {
      return failBeforeStream(
        {
          error: promptAttachmentEvidenceValidation.code ?? 'model_cannot_read_images',
          detail:
            promptAttachmentEvidenceValidation.detail ??
            'The selected model cannot read the carried image input.',
        },
        400,
        preflightRun,
      );
    }
    const taskKind = resolveTaskRelevantComponentTaskKind(
      state,
      promptAttachments,
      latestUserRequest(parse.data.messages),
    );
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
    await recordScreenRedesignBaseline({
      workspacePath: state.workspacePath ?? null,
      runId: agentRun?.runId,
      agentRun,
      taskKind: componentPack?.taskKind ?? taskKind,
    });
    const designJuryPlan = resolveDesignJuryRunPlan({
      componentPack,
      skills: kit.skills,
      generation: parse.data.generation,
    });
    const toolContext = {
      ...baseToolContext,
      runId: agentRun?.runId ?? null,
      componentPack,
      screenStructurePlan,
    };

    let messages: ChatMessage[] = await buildProviderMultimodalMessages({
      workspacePath: baseToolContext.workspacePath ?? '',
      messages: parse.data.messages as ChatMessage[],
      attachments: promptAttachments,
      imageTransport: providerImageTransportForAgentTarget(agentTarget),
    });
    if (parse.data.attachContext) {
      const userRequest = latestUserRequest(parse.data.messages);
      const built = await buildSystemPrompt({
        state,
        sessionMode,
        agentName: activeAgent.name,
        taskKind,
        userRequest,
        componentPack,
        screenStructurePlan,
        generation: parse.data.generation ?? null,
        runtimeIdentity: runtimeIdentityPromptInputForTarget({
          target: agentTarget,
          providerLabel: cfg.provider[active.provider]?.name,
          modelLabel: cfg.provider[active.provider]?.models?.[active.model]?.name,
        }),
      });
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
      route: 'chat-stream',
      user,
      provider: active.provider,
      model: active.model,
      state,
      messages,
      maxIterations,
    });
    await linkAgentLogEvidence(attemptLogger, devLogger, agentRun);

    return streamBuiltInAgentRun(c, {
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
    });
  });
