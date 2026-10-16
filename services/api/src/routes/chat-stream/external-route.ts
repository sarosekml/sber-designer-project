import type { Context } from 'hono';
import type { z } from 'zod';
import type {
  agentContextBudgetFromConfig,
  promptAttachmentLimitsFromConfig,
} from '@sber-designer/llm-gateway';
import type { ProjectAssistantSession } from '@sber-designer/shared-types';

import type { AgentModelTarget } from '../../agent-model-target';
import type { createAgentAttemptLogger } from '../../agent/dev-log';
import type {
  AgentRunManifest,
  AgentRunRuntimeSessionDiagnostics,
  CompleteAgentRunInput,
} from '../../agent/run-recorder';
import type { AgentRunLease, configureAgentRunCoordinator } from '../../agent/run-coordinator';
import { runtimeModelDiagnosticsFromEvent } from '../../agent-runtimes/model-identity';
import { isRuntimePromptBudgetError } from '../../agent-runtimes/prompt-delivery';
import { getAgentRuntimeDef } from '../../agent-runtimes/registry';
import {
  planAgentRuntimeSession,
  updateRuntimeSessionFromEvent,
} from '../../agent-runtimes/session';
import type { ScreenCraftProfile } from '../../generation-mode';
import {
  validatePromptAttachmentEvidenceForTarget,
  type validatePromptAttachmentsForTarget,
} from '../../prompt-attachments';
import { recordScreenRedesignBaseline } from '../../screen-redesign-fidelity';
import type { EditorState } from '../../state-store';
import {
  getStoredRuntimeStatus,
  isCliRuntimeEnabled,
  runtimeDisabledError,
} from '../agent-runtimes';
import { resolveDesignJuryRunPlan } from './design-jury-finalization';
import {
  formatPromptAttachmentValidationWarnings,
  recordExternalRuntimeAttachmentDelivery,
  recordPromptAttachmentsForRun,
  runEvidenceDiagnostics,
} from './evidence';
import {
  createRuntimeStdoutNoiseCounter,
  prepareExternalRuntimeAgentKitContext,
  prepareExternalRuntimePrompt,
  prepareExternalRuntimeRun,
  runtimeAttemptLogger,
} from './external';
import { createExternalDesignJuryGateway } from './external-design-jury';
import {
  classifyRuntimeMcpToolHealthFromEvent,
  type externalRuntimeDispatchForProvider,
  initialRuntimeMcpToolHealth,
  mergeRuntimeMcpToolHealth,
  resolveExternalRuntimeImageDelivery,
  runExternalRuntimeAdapter,
  runExternalRuntimeAuthPreflight,
  runExternalRuntimeMcpConfigPreflight,
  runExternalRuntimeSmokeCheck,
  validateExternalRuntimePromptBudget,
} from './external-dispatch';
import { streamExternalRuntimeRun } from './external-stream';
import type { StreamChatRequestSchema } from './request-schema';
import type { agentRunTargetCapabilities } from './run-context';

type AssistantSessionMetadata = ProjectAssistantSession['metadata'];
type FailBeforeStream = (
  body: { error: string; detail?: string },
  status: 400 | 403 | 409 | 500 | 503,
  agentRun?: AgentRunManifest | null,
  diagnostics?: CompleteAgentRunInput['diagnostics'],
) => Promise<Response>;

export interface ExternalRuntimeRouteInput {
  c: Context;
  activeLease: AgentRunLease | null;
  active: { provider: string; model: string };
  agentTarget: AgentModelTarget;
  attachmentValidation: ReturnType<typeof validatePromptAttachmentsForTarget>;
  attemptLogger: Awaited<ReturnType<typeof createAgentAttemptLogger>>;
  contextBudgetPolicy: ReturnType<typeof agentContextBudgetFromConfig>;
  dispatch: NonNullable<ReturnType<typeof externalRuntimeDispatchForProvider>>;
  failBeforeStream: FailBeforeStream;
  initialState: EditorState;
  parse: { data: z.infer<typeof StreamChatRequestSchema> };
  persistRunSessionMetadata: (input: {
    agentRun?: AgentRunManifest | null;
    runStatus?: NonNullable<AssistantSessionMetadata>['lastRunStatus'];
    runSummary?: string | null;
    runErrorCode?: string | null;
    runtimeSession?: AgentRunRuntimeSessionDiagnostics | null;
  }) => Promise<void>;
  preflightRun: AgentRunManifest | null;
  previousSessionMetadata: AssistantSessionMetadata | undefined;
  promptAttachmentLimits: ReturnType<typeof promptAttachmentLimitsFromConfig>;
  runCoordinator: ReturnType<typeof configureAgentRunCoordinator>;
  runSignal: AbortSignal;
  runtimeAbortController: AbortController;
  screenCraftProfile: ScreenCraftProfile;
  screenId: string;
  sessionId: string;
  sessionMode: z.infer<typeof StreamChatRequestSchema>['sessionMode'];
  targetCapabilities: ReturnType<typeof agentRunTargetCapabilities>;
  user: string;
  userGoal: string;
}

export async function handleExternalRuntimeRoute({
  c,
  activeLease,
  active,
  agentTarget,
  attachmentValidation,
  attemptLogger,
  contextBudgetPolicy,
  dispatch,
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
}: ExternalRuntimeRouteInput): Promise<Response> {
  const runtimeDisabled = runtimeDisabledError(
    dispatch.runtime,
    await isCliRuntimeEnabled(dispatch.runtime),
  );
  if (runtimeDisabled) {
    return failBeforeStream(runtimeDisabled, 403, preflightRun);
  }
  const state = initialState;
  const promptAttachments = await recordPromptAttachmentsForRun({
    workspacePath: state.workspacePath ?? null,
    agentRun: preflightRun,
    attachments: parse.data.attachments,
    limits: promptAttachmentLimits,
    messages: parse.data.messages,
    state,
    sessionId,
    screenId,
  });
  const evidenceValidation = validatePromptAttachmentEvidenceForTarget({
    attachments: promptAttachments,
    target: agentTarget,
  });
  if (!evidenceValidation.ok) {
    return failBeforeStream(
      {
        error: evidenceValidation.code ?? 'model_cannot_read_images',
        detail:
          evidenceValidation.detail ?? 'The selected model cannot read the carried image input.',
      },
      400,
      preflightRun,
    );
  }
  const imageDelivery = resolveExternalRuntimeImageDelivery(dispatch, promptAttachments);
  await recordExternalRuntimeAttachmentDelivery({
    workspacePath: state.workspacePath ?? null,
    agentRun: preflightRun,
    runtime: dispatch.streamRuntimeLabel,
    deliveryMode: imageDelivery.mode,
    imagePaths: imageDelivery.imagePaths,
    attachments: promptAttachments,
  });
  const status = await getStoredRuntimeStatus(dispatch.runtime);
  if (dispatch.smokeCheck) {
    await attemptLogger?.log(`runtime.${dispatch.runtime}.preflight.status`, {
      connected: status?.connected ?? false,
      command: status?.command ?? null,
      version: status?.version ?? null,
      auth: status?.auth ?? null,
      diagnostics: status?.diagnostics ?? [],
      capabilities: status?.capabilities ?? null,
    });
  }
  const command = status?.command ?? null;
  if (!status?.connected || !command) {
    return failBeforeStream(
      { error: 'runtime_not_connected', detail: dispatch.notConnectedDetail },
      409,
      preflightRun,
    );
  }
  const cwd = state.workspacePath ?? process.cwd();
  const mcpConfigPreflight = runExternalRuntimeMcpConfigPreflight({ dispatch });
  await attemptLogger?.log(`runtime.${dispatch.runtime}.preflight.mcp_config`, mcpConfigPreflight);
  if (!mcpConfigPreflight.ok) {
    return failBeforeStream(
      { error: mcpConfigPreflight.code, detail: mcpConfigPreflight.detail },
      409,
      preflightRun,
      mcpConfigPreflight.diagnostics,
    );
  }
  const smoke = await runExternalRuntimeSmokeCheck({
    dispatch,
    command,
    model: active.model,
    cwd,
  });
  if (dispatch.smokeCheck) {
    await attemptLogger?.log(`runtime.${dispatch.runtime}.preflight.smoke`, smoke);
  }
  if (!smoke.ok) {
    return failBeforeStream({ error: smoke.code, detail: smoke.detail }, 409, preflightRun);
  }
  const authPreflight = await runExternalRuntimeAuthPreflight({
    dispatch,
    command,
    model: active.model,
    cwd,
  });
  await attemptLogger?.log(`runtime.${dispatch.runtime}.preflight.auth`, authPreflight);
  if (!authPreflight.ok) {
    return failBeforeStream(
      { error: authPreflight.code, detail: authPreflight.detail },
      409,
      preflightRun,
      authPreflight.diagnostics,
    );
  }
  const stdoutNoise = createRuntimeStdoutNoiseCounter();
  const runtimeRun = await prepareExternalRuntimeRun({
    state,
    user,
    userGoal,
    provider: active.provider,
    model: active.model,
    existingAgentRun: preflightRun,
  });
  const agentKitContext = await prepareExternalRuntimeAgentKitContext({
    workspacePath: state.workspacePath ?? null,
    primaryAgent: parse.data.primaryAgent,
    requestedAgent: parse.data.agent,
  });
  if (!agentKitContext.ok) {
    return failBeforeStream(
      { error: agentKitContext.error, detail: agentKitContext.detail },
      agentKitContext.status,
      preflightRun,
    );
  }
  const sessionMetadata = previousSessionMetadata;
  const runtimeDef = getAgentRuntimeDef(dispatch.runtime);
  const runtimeSessionPlan = runtimeDef
    ? planAgentRuntimeSession({
        def: runtimeDef,
        capabilities: status.capabilities,
        sessionMetadata: sessionMetadata ?? null,
        model: active.model,
        workspacePath: cwd,
      })
    : { runSession: null, handoffSession: null };
  const runtimeSessionFallbackPlan = runtimeDef
    ? planAgentRuntimeSession({
        def: runtimeDef,
        capabilities: status.capabilities,
        sessionMetadata: null,
        model: active.model,
        workspacePath: cwd,
      })
    : { runSession: null, handoffSession: null };
  let handoff: Awaited<ReturnType<typeof prepareExternalRuntimePrompt>>;
  try {
    handoff = await prepareExternalRuntimePrompt({
      runtime: dispatch.runtime,
      runtimeLabel: dispatch.promptRuntimeLabel,
      model: active.model,
      messages: parse.data.messages,
      state,
      agentRun: runtimeRun.agentRun,
      context: agentKitContext.context,
      ...(sessionMetadata !== undefined ? { sessionMetadata } : {}),
      ...(runtimeSessionPlan.handoffSession
        ? { runtimeSession: runtimeSessionPlan.handoffSession }
        : {}),
      ...(contextBudgetPolicy.degradePromptBytes !== undefined
        ? { maxPromptBytes: contextBudgetPolicy.degradePromptBytes }
        : {}),
      promptAttachments,
      runtimeWarnings: formatPromptAttachmentValidationWarnings(attachmentValidation.warnings),
      generation: parse.data.generation ?? null,
      sessionMode,
    });
  } catch (error) {
    if (isRuntimePromptBudgetError(error)) {
      return failBeforeStream(
        { error: error.code, detail: error.message },
        400,
        runtimeRun.agentRun,
      );
    }
    throw error;
  }
  const prompt = handoff.prompt;
  await recordScreenRedesignBaseline({
    workspacePath: runtimeRun.workspacePath,
    runId: runtimeRun.agentRun?.runId,
    agentRun: runtimeRun.agentRun,
    taskKind: handoff.componentPack?.taskKind ?? 'unknown',
  });
  if (
    contextBudgetPolicy.blockPromptBytes !== undefined &&
    handoff.estimatedBytes > contextBudgetPolicy.blockPromptBytes
  ) {
    return failBeforeStream(
      {
        error: 'context_budget_blocked',
        detail: `External runtime prompt is ${handoff.estimatedBytes} bytes, above the configured blockPromptBytes=${contextBudgetPolicy.blockPromptBytes}.`,
      },
      400,
      runtimeRun.agentRun,
      {
        contextBudget: {
          status: 'blocked',
          thresholdTokens: contextBudgetPolicy.warningTokens,
          detail: `External runtime prompt exceeded configured blockPromptBytes=${contextBudgetPolicy.blockPromptBytes}.`,
        },
      },
    );
  }
  const promptBudget = validateExternalRuntimePromptBudget({ dispatch, prompt });
  if (!promptBudget.ok) {
    return failBeforeStream(
      { error: promptBudget.code, detail: promptBudget.detail },
      400,
      runtimeRun.agentRun,
    );
  }
  const runtimeEventLogger = runtimeAttemptLogger(attemptLogger);
  const runDiagnostics = runEvidenceDiagnostics({
    attemptLogger,
    devLogger: null,
    agentRun: runtimeRun.agentRun,
  });
  if (runtimeSessionPlan.diagnostics) {
    runDiagnostics.runtimeSession = runtimeSessionPlan.diagnostics;
  }
  runDiagnostics.runtimeMcp = initialRuntimeMcpToolHealth({
    runtime: dispatch.runtime,
    targetCapabilities,
  });
  const recordRuntimeEvent = async (event: string, data: Record<string, unknown>) => {
    const runtimeModel = runtimeModelDiagnosticsFromEvent(event, data);
    if (runtimeModel) runDiagnostics.runtimeModel = runtimeModel;
    const runtimeSession = updateRuntimeSessionFromEvent({
      ...(runDiagnostics.runtimeSession ? { current: runDiagnostics.runtimeSession } : {}),
      event,
      data,
    });
    if (runtimeSession) runDiagnostics.runtimeSession = runtimeSession;
    const health = classifyRuntimeMcpToolHealthFromEvent({
      runtime: dispatch.runtime,
      event,
      data,
      targetCapabilities,
    });
    if (health) {
      runDiagnostics.runtimeMcp = mergeRuntimeMcpToolHealth(runDiagnostics.runtimeMcp, health);
    }
    await runtimeEventLogger?.(event, data);
  };
  const runtimeSessionForRetry = () => {
    const resumedSessionId = runDiagnostics.runtimeSession?.sessionId?.trim();
    if (resumedSessionId) {
      return {
        mode: 'resume' as const,
        sessionId: resumedSessionId,
        ...(runtimeSessionPlan.runSession?.usageBaseline
          ? { usageBaseline: runtimeSessionPlan.runSession.usageBaseline }
          : {}),
      };
    }
    return runtimeSessionPlan.runSession;
  };
  const runAdapter = (nextPrompt: string, runtimeSession = runtimeSessionPlan.runSession) =>
    runExternalRuntimeAdapter({
      dispatch,
      command,
      model: active.model,
      cwd,
      prompt: nextPrompt,
      projectId: state.projectName ?? null,
      runId: runtimeRun.agentRun?.runId ?? null,
      ...(runtimeSession ? { runtimeSession } : {}),
      promptAttachments,
      onRuntimeStdoutNoise: stdoutNoise.record,
      onRuntimeEvent: recordRuntimeEvent,
      signal: runSignal,
    });
  const externalDesignJuryPlan = resolveDesignJuryRunPlan({
    componentPack: handoff.componentPack,
    skills: agentKitContext.context.kit.skills,
    generation: parse.data.generation,
  });
  const externalDesignJuryGateway = createExternalDesignJuryGateway({
    provider: active.provider,
    model: active.model,
    run: (juryPrompt) => runAdapter(juryPrompt, runtimeSessionForRetry()),
  });
  return streamExternalRuntimeRun(c, {
    activeLease,
    attemptLogger,
    contextBudgetPolicy,
    externalDesignJuryGateway,
    externalDesignJuryPlan,
    externalDispatch: dispatch,
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
  });
}
