/**
 * Assistant chat panel shell: composer, attachments, send orchestration
 * and panel layout. Transcript/context/run sub-views live in ./chat/*
 * (task 0078, KT3b).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Sparkles, Terminal } from 'lucide-react';
import {
  buildExternalDesignSourceDirective,
  createExternalDesignSourceTargetDefaults,
  defaultExternalDesignSourceScreenName,
  detectExternalDesignSourceIntent,
  normalizeAssistantSessionMode,
  type AssistantActiveRun,
} from '@sber-designer/shared-types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  CONTINUE_AGENT_RUN_MAX_ITERATIONS,
  buildContinueAgentRunPrompt,
} from '@/lib/agent-continue';
import { validateAttachmentsForAgentTarget } from '@/lib/agent-model-target';
import {
  activeMentionQuery,
  applyAgentMentionSuggestion,
  clearActiveAgentMentionQuery,
  cyclePrimaryAgent,
  suggestAgentMentions,
} from '@/lib/agent-mentions';
import { buildAutoTaskPrompt } from '@/lib/auto-agent';
import {
  fetchAgentKit,
  fetchActiveAgentRuns,
  fetchAgentRunEvidence,
  reprobeAgentRunRender,
  resolveChatPermission,
  type AgentRunRenderProof,
  type AgentKitInventory,
} from '@/lib/api-client';
import { sendPr, type GitChange } from '@/lib/api/git';
import { autoPrPathsAfterRun } from '@/lib/git-auto-pr';
import {
  designSourceIntentKeyFor,
  shouldAutoOpenDesignSourceComposer,
  shouldUseDesignSourceScreenComposer,
} from '@/lib/design-source-composer';
import { buildImageUrlAttachmentsFromText } from '@/lib/chat-attachments';
import {
  buildChatComposerSendPayload,
  composerKeyIntent,
  resolveSendBlockReason,
} from '@/lib/chat-composer';
import { generateFromPlanPrompt, refinePlanPrompt } from '@/lib/plan-document';
import { useChat } from '@/hooks/useChat';
import { DESCRIPTION_AGENT_NAME } from '@/lib/use-start-description-interview';
import { selectAssistantRunsList, useAssistantRunStore } from '@/stores/assistant-run-store';
import {
  STORYBOOK_ASSISTANT_SCREEN_ID,
  useChatStore,
  type ChatAttachment,
} from '@/stores/chat-store';
import { useEditorStore } from '@/stores/editor-store';
import { useGitStore } from '@/stores/git-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';
import { useTasksStore } from '@/stores/tasks-store';
import { AutoModeDialog } from './AutoModeDialog';
import { MAX_ATTACHMENTS } from './chat/attachments';
import {
  type DesignSourceComposerState,
  composeExternalDesignSourceIntent,
} from './chat/DesignSourceMiniForm';
import { Composer } from './chat/Composer';
import { SessionModeSelect } from './chat/SessionModeSelect';
import { AssistantChatSelector } from './chat/AssistantChatSelector';
import {
  ActiveComponentContext,
  ComponentTasksContext,
  ContextStrip,
  ScreenCommentsContext,
  ScreenTasksContext,
  SelectedElementContext,
  formatActiveAgentTitle,
} from './chat/ContextStrip';
import { PermissionRequestCard } from './chat/PermissionRequestCard';
import { AssistantModelSwitcher } from './chat/AssistantModelSwitcher';
import { RunIdentityBadge, buildAssistantRunIdentityBadgeState } from './chat/RunIdentityBadge';
import { Transcript } from './chat/Transcript';
import {
  findPendingDirectionPicker,
  selectionFromDirectionOption,
  type DirectionPickerMessagePayload,
} from '@/lib/design-direction-picker';
import type { DesignDirectionOption } from '@sber-designer/shared-types';
import { extractAgentRunId } from './chat/run-metadata';
import {
  BackgroundRunsStrip,
  isInteractiveRunStatus,
  stopAssistantRun,
} from './chat/BackgroundRunsStrip';
import { ProviderRequiredBody } from './chat/ProviderRequiredBody';
import { useChatPanelAttachments } from './chat/useChatPanelAttachments';
import { useChatProviderState } from './chat/useChatProviderState';
import { AgentSelectorDropdown } from './chat/AgentSelectorDropdown';
import { useChatRunControls } from './chat/useChatRunControls';

export function ChatPanel() {
  const {
    active,
    agentTarget,
    apiModels,
    apiProviderStatuses,
    attachmentLimits,
    capabilityBadges,
    enabledRuntimeKinds,
    handleAssistantModelChange,
    handleAssistantProviderChange,
    providerUnavailable,
    refreshRuntimeStatuses,
    runtimeStatuses,
  } = useChatProviderState();

  const messages = useChatStore((s) => s.messages);
  const pendingDirectionPicker = useMemo(() => findPendingDirectionPicker(messages), [messages]);
  const legacyPending = useChatStore((s) => s.pending);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const error = useChatStore((s) => s.error);
  const setError = useChatStore((s) => s.setError);
  const lastIterations = useChatStore((s) => s.lastIterations);
  const lastTruncated = useChatStore((s) => s.lastTruncated);
  const lastDebugLogPath = useChatStore((s) => s.lastDebugLogPath);
  const lastRunManifestPath = useChatStore((s) => s.lastRunManifestPath);
  const lastRunStatus = useChatStore((s) => s.lastRunStatus);
  const lastRunSummary = useChatStore((s) => s.lastRunSummary);
  const lastRunErrorCode = useChatStore((s) => s.lastRunErrorCode);
  const lastBlockingRun = useChatStore((s) => s.lastBlockingRun);
  const lastComponentReuse = useChatStore((s) => s.lastComponentReuse);
  const lastRenderProof = useChatStore((s) => s.lastRenderProof);
  const lastRunMetrics = useChatStore((s) => s.lastRunMetrics);
  const cancel = useChatStore((s) => s.cancel);
  const legacyPendingPermission = useChatStore((s) => s.pendingPermission);
  const pendingPermissionsByRunId = useChatStore((s) => s.pendingPermissionsByRunId);
  const assistantRuns = useAssistantRunStore(selectAssistantRunsList);

  const { send } = useChat();
  const sessionMode = useChatStore((s) =>
    normalizeAssistantSessionMode(
      s.assistant.sessions.find((session) => session.id === s.activeSessionId)?.sessionMode,
    ),
  );
  const setSessionMode = useChatStore((s) => s.setSessionMode);
  const autoRunArmed = useEditorStore((s) => s.autoRunArmed);
  const setAutoRunArmed = useEditorStore((s) => s.setAutoRunArmed);
  const activePrimaryAgentName = useEditorStore((s) => s.activePrimaryAgentName);
  const setActivePrimaryAgentName = useEditorStore((s) => s.setActivePrimaryAgentName);
  const sessionAgentName = useChatStore((s) =>
    s.activeSessionId ? (s.sessionAgentBySession[s.activeSessionId] ?? null) : null,
  );
  const setSessionAgentName = useChatStore((s) => s.setSessionAgentName);
  const canvasView = useEditorStore((s) => s.canvasView);
  const canvasUrl = useEditorStore((s) => s.canvasUrl);
  const activeScreenId = useEditorStore((s) => s.activeScreenId);
  const project = useProjectStore((s) => s.project);
  const generationDefaults = useEditorStore((s) => s.generationDefaults);
  const session = useSandboxStore((s) => s.session);
  const [draft, setDraft] = useState('');
  const [designSourceComposer, setDesignSourceComposer] =
    useState<DesignSourceComposerState | null>(null);
  const [ignoredDesignSourceIntentKey, setIgnoredDesignSourceIntentKey] = useState<string | null>(
    null,
  );
  const [agentInventory, setAgentInventory] = useState<AgentKitInventory | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [autoDialogOpen, setAutoDialogOpen] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [stopAfterCurrent, setStopAfterCurrent] = useState(false);
  const [exportingEvidenceRunId, setExportingEvidenceRunId] = useState<string | null>(null);
  const [reprobingRenderRunId, setReprobingRenderRunId] = useState<string | null>(null);
  const [renderProofByRunId, setRenderProofByRunId] = useState<Record<string, AgentRunRenderProof>>(
    {},
  );
  const [permissionResolving, setPermissionResolving] = useState<'allow' | 'deny' | null>(null);
  const [permissionRemember, setPermissionRemember] = useState(false);
  const autoRunningRef = useRef(false);
  const stopAfterCurrentRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const effectiveAttachments = useMemo(
    () => [
      ...attachments,
      ...buildImageUrlAttachmentsFromText({
        text: draft,
        existingAttachments: attachments,
        maxCount: MAX_ATTACHMENTS,
      }),
    ],
    [attachments, draft],
  );
  const attachmentCompatibility = useMemo(
    () =>
      validateAttachmentsForAgentTarget({ target: agentTarget, attachments: effectiveAttachments }),
    [agentTarget, effectiveAttachments],
  );
  const hasHtmlAttachment = useMemo(
    () =>
      attachments.some(
        (attachment) =>
          attachment.kind === 'text' &&
          (attachment.mimeType === 'text/html' || /\.(?:html|htm)$/iu.test(attachment.name)),
      ),
    [attachments],
  );
  const attachmentBlocked = attachmentCompatibility?.severity === 'error';
  const mentionSuggestions = useMemo(
    () => suggestAgentMentions(draft, agentInventory?.agents ?? []),
    [agentInventory, draft],
  );
  const primaryAgents = useMemo(
    () =>
      (agentInventory?.agents ?? []).filter(
        (agent) => !agent.hidden && (agent.mode === 'primary' || agent.mode === 'all'),
      ),
    [agentInventory],
  );
  const activePrimaryAgent = useMemo(() => {
    if (!agentInventory) return null;
    return (
      primaryAgents.find((agent) => agent.name === activePrimaryAgentName) ??
      primaryAgents.find((agent) => agent.name === agentInventory.defaultAgent.name) ??
      primaryAgents[0] ??
      null
    );
  }, [activePrimaryAgentName, agentInventory, primaryAgents]);
  const activePrimaryAgentTitle = useMemo(
    () => formatActiveAgentTitle(activePrimaryAgent, agentInventory),
    [activePrimaryAgent, agentInventory],
  );
  // 0083 D7: full selector over every visible agent (primaries + subagents), not
  // just the primary cycle. The pinned subagent (if any) is the session agent.
  const selectableAgents = useMemo(
    () => (agentInventory?.agents ?? []).filter((agent) => !agent.hidden),
    [agentInventory],
  );
  const sessionSubagent = useMemo(
    () =>
      sessionAgentName
        ? (selectableAgents.find((agent) => agent.name === sessionAgentName) ?? null)
        : null,
    [selectableAgents, sessionAgentName],
  );
  const activeSessionAgent = sessionSubagent ?? activePrimaryAgent;
  const activeScreen = useMemo(
    () => project?.screens.find((screen) => screen.id === activeScreenId) ?? null,
    [activeScreenId, project?.screens],
  );
  const selectedRun = useMemo(
    () =>
      assistantRuns.find(
        (run) => run.sessionId === activeSessionId && isInteractiveRunStatus(run.status),
      ) ?? null,
    [activeSessionId, assistantRuns],
  );
  const backgroundRuns = useMemo(
    () =>
      assistantRuns.filter(
        (run) =>
          isInteractiveRunStatus(run.status) &&
          !(activeSessionId && run.sessionId === activeSessionId),
      ),
    [activeSessionId, assistantRuns],
  );
  const pendingPermission =
    selectedRun && selectedRun.runId
      ? (pendingPermissionsByRunId[selectedRun.runId] ??
        pendingPermissionsByRunId[selectedRun.clientRunId] ??
        legacyPendingPermission)
      : selectedRun
        ? (pendingPermissionsByRunId[selectedRun.clientRunId] ?? legacyPendingPermission)
        : legacyPendingPermission;
  const runIdentityBadge = useMemo(
    () =>
      buildAssistantRunIdentityBadgeState({
        selectedRun,
        messages,
        apiProviders: apiProviderStatuses,
      }),
    [apiProviderStatuses, messages, selectedRun],
  );
  const pending = Boolean(selectedRun) || (legacyPending && assistantRuns.length === 0);
  const sendBlockReason = useMemo(
    () =>
      resolveSendBlockReason({
        sessionMode,
        draft,
        attachmentCount: attachments.length,
        pending,
        providerUnavailable,
        autoRunning,
        attachmentCompatibility,
      }),
    [
      sessionMode,
      attachmentCompatibility,
      attachments.length,
      autoRunning,
      draft,
      pending,
      providerUnavailable,
    ],
  );
  const designSourceIntent = useMemo(() => detectExternalDesignSourceIntent(draft), [draft]);
  const designSourceIntentKey = useMemo(
    () => designSourceIntentKeyFor(designSourceIntent),
    [designSourceIntent],
  );

  // Auto-scroll on new message / pending change.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, pending]);

  useEffect(() => {
    let cancelled = false;
    void fetchActiveAgentRuns()
      .then(({ runs, pendingPermissions }) => {
        if (cancelled) return;
        for (const run of runs) {
          useAssistantRunStore.getState().upsertRun(run);
        }
        for (const permission of pendingPermissions ?? []) {
          useChatStore
            .getState()
            .setPendingPermissionForRun(
              permission.clientRunId ?? permission.runId ?? permission.id,
              permission,
            );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPermissionRemember(pendingPermission?.category === 'edit');
  }, [pendingPermission?.category, pendingPermission?.id]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchAgentKit(controller.signal)
      .then(setAgentInventory)
      .catch(() => {
        if (!controller.signal.aborted) setAgentInventory(null);
      });
    return () => controller.abort();
  }, [project?.workspacePath]);

  useEffect(() => {
    if (!agentInventory || !activePrimaryAgent) return;
    if (activePrimaryAgent.name !== activePrimaryAgentName) {
      setActivePrimaryAgentName(activePrimaryAgent.name);
    }
  }, [activePrimaryAgent, activePrimaryAgentName, agentInventory, setActivePrimaryAgentName]);

  useEffect(() => {
    if (!designSourceIntent || !designSourceIntentKey) {
      if (designSourceComposer) setDesignSourceComposer(null);
      if (ignoredDesignSourceIntentKey) setIgnoredDesignSourceIntentKey(null);
      return;
    }
    if (!shouldUseDesignSourceScreenComposer(designSourceIntent)) {
      if (designSourceComposer) setDesignSourceComposer(null);
      return;
    }
    if (
      !shouldAutoOpenDesignSourceComposer({
        intentKey: designSourceIntentKey,
        ignoredIntentKey: ignoredDesignSourceIntentKey,
        currentComposerKey: designSourceComposer?.key ?? null,
      })
    ) {
      if (ignoredDesignSourceIntentKey === designSourceIntentKey && designSourceComposer) {
        setDesignSourceComposer(null);
      }
      return;
    }
    const targetName = defaultExternalDesignSourceScreenName(designSourceIntent);
    const defaults = createExternalDesignSourceTargetDefaults({ name: targetName });
    const inferredMode =
      activeScreen && /(replace|current|текущ|замени|заменить)/i.test(draft)
        ? 'replace-current'
        : 'new-screen';
    setDesignSourceComposer({
      key: designSourceIntentKey,
      targetMode: inferredMode,
      targetName:
        activeScreen && inferredMode === 'replace-current' ? activeScreen.name : targetName,
      targetFolder: defaults.folder,
      targetStoryId: defaults.storyId,
      targetStoryFilePath: defaults.storyFilePath,
      targetImplementationFilePath: defaults.implementationFilePath,
      tokenPolicy: designSourceIntent.policies.tokens,
      componentPolicy: designSourceIntent.policies.components,
    });
  }, [
    activeScreen,
    designSourceComposer,
    designSourceIntent,
    designSourceIntentKey,
    draft,
    ignoredDesignSourceIntentKey,
  ]);

  const handleSend = async () => {
    if (pendingDirectionPicker) {
      setError('Choose a design direction by clicking one of the cards above.');
      return;
    }
    if (autoRunArmed) {
      if (pending || providerUnavailable || autoRunning) return;
      setAutoDialogOpen(true);
      return;
    }
    if (sendBlockReason) {
      if (attachmentBlocked) setError(sendBlockReason);
      return;
    }
    const designSourceDirective =
      designSourceIntent && !shouldUseDesignSourceScreenComposer(designSourceIntent)
        ? buildExternalDesignSourceDirective(designSourceIntent)
        : designSourceIntent && designSourceComposer
          ? buildExternalDesignSourceDirective(
              composeExternalDesignSourceIntent(
                designSourceIntent,
                designSourceComposer,
                activeScreen,
              ),
            )
          : null;
    const payload = buildChatComposerSendPayload({
      sessionMode,
      draft,
      attachments: effectiveAttachments,
      knownAgents: agentInventory?.agents ?? [],
      sessionAgentName,
      activePrimaryAgentName: activePrimaryAgent?.name ?? null,
      designSourceDirective,
    });
    if (!payload) return;
    setDraft('');
    setAttachments([]);
    setDesignSourceComposer(null);
    setIgnoredDesignSourceIntentKey(null);
    await send(payload.content, payload.attachments, {
      ...(payload.displayContent ? { displayContent: payload.displayContent } : {}),
      ...(payload.agentName ? { agentName: payload.agentName } : {}),
      ...(payload.primaryAgentName ? { primaryAgentName: payload.primaryAgentName } : {}),
      ...(agentInventory ? { knownAgents: agentInventory.agents } : {}),
      sessionMode,
      ...(sessionMode === 'design' && canvasView === 'screen' && generationDefaults.designJury
        ? { generation: { critique: true } }
        : {}),
    });
  };

  const handleApplyMentionSuggestion = (agentName: string) => {
    const agent = agentInventory?.agents.find((candidate) => candidate.name === agentName);
    if (agent?.mode === 'primary') {
      setActivePrimaryAgentName(agent.name);
      setDraft((current) => clearActiveAgentMentionQuery(current));
      return;
    }
    setDraft((current) => applyAgentMentionSuggestion(current, agentName));
  };

  // 0083 D6/D7: explicit agent selector. Picking a subagent pins it to the
  // session (sticky `agentName` on every message); picking a primary switches the
  // primary and clears the sticky override.
  const handleSelectSessionAgent = (agentName: string) => {
    const agent = selectableAgents.find((candidate) => candidate.name === agentName);
    if (!agent) return;
    if (agent.mode === 'subagent') {
      setSessionAgentName(agent.name);
      return;
    }
    setSessionAgentName(null);
    setActivePrimaryAgentName(agent.name);
  };

  const handleDismissDesignSourceComposer = () => {
    const key = designSourceComposer?.key || designSourceIntentKey;
    if (key) setIgnoredDesignSourceIntentKey(key);
    setDesignSourceComposer(null);
  };

  const handleContinue = async () => {
    if (pending || providerUnavailable || autoRunning) return;
    await send(buildContinueAgentRunPrompt(lastIterations), [], {
      displayContent: 'Continue the previous run.',
      maxIterations: CONTINUE_AGENT_RUN_MAX_ITERATIONS,
      // 0083 D6: a continuation must stay on the pinned session agent.
      ...(sessionAgentName ? { agentName: sessionAgentName } : {}),
      ...(activePrimaryAgent ? { primaryAgentName: activePrimaryAgent.name } : {}),
      ...(agentInventory ? { knownAgents: agentInventory.agents } : {}),
      sessionMode,
    });
  };

  const {
    handleExportEvidence,
    handleOpenBackgroundRun,
    handleReprobeRender,
    handleResolvePermission,
    handleStartAuto,
    handleStopBackgroundRun,
    handleStopSelectedRun,
    stopAutoAfterCurrent,
    stopAutoNow,
  } = useChatRunControls({
    autoRunningRef,
    cancel,
    canvasUrl,
    pendingPermission,
    permissionRemember,
    permissionResolving,
    project,
    selectedRun,
    send,
    session,
    setAutoRunning,
    setError,
    setExportingEvidenceRunId,
    setPermissionResolving,
    setRenderProofByRunId,
    setReprobingRenderRunId,
    setStopAfterCurrent,
    stopAfterCurrentRef,
  });

  const { addFiles } = useChatPanelAttachments({
    activePrimaryAgent,
    agentInventory,
    agentTarget,
    attachmentLimits,
    attachments,
    autoRunning,
    pending,
    providerUnavailable,
    send,
    sessionAgentName,
    sessionMode,
    setAttachments,
    setDesignSourceComposer,
    setDraft,
    setError,
    setIgnoredDesignSourceIntentKey,
  });

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      e.key === 'Tab' &&
      !providerUnavailable &&
      !pending &&
      !autoRunning &&
      primaryAgents.length > 1 &&
      activeMentionQuery(draft) === null
    ) {
      e.preventDefault();
      const next = cyclePrimaryAgent(
        agentInventory?.agents ?? [],
        activePrimaryAgent?.name,
        e.shiftKey ? -1 : 1,
      );
      if (next) {
        // 0083 D7: cycling the primary clears any sticky subagent override.
        setSessionAgentName(null);
        setActivePrimaryAgentName(next.name);
      }
      return;
    }
    if (composerKeyIntent(e) === 'send') {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <aside className="flex min-h-0 min-w-0 flex-col border-r border-border bg-sidebar">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-4 text-xs">
        <div className="flex items-center gap-2 font-medium">
          {providerUnavailable ? (
            <Terminal className="size-3.5 text-primary" />
          ) : (
            <Sparkles className="size-3.5 text-primary" />
          )}
          <span>Assistant</span>
        </div>
        <div className="ml-3 flex min-w-0 flex-1 items-center justify-end gap-2">
          <RunIdentityBadge identity={runIdentityBadge} />
          <AssistantModelSwitcher
            active={active}
            apiModels={apiModels}
            apiProviders={apiProviderStatuses}
            runtimeStatuses={runtimeStatuses}
            enabledRuntimeKinds={enabledRuntimeKinds}
            capabilityBadges={capabilityBadges}
            disabled={pending || autoRunning}
            onSelectProvider={handleAssistantProviderChange}
            onSelectModel={handleAssistantModelChange}
            onRefreshRuntimes={() => void refreshRuntimeStatuses()}
          />
        </div>
      </div>

      {!providerUnavailable && <AssistantChatSelector disabled={pending || autoRunning} />}
      {!providerUnavailable && <ContextStrip />}
      {!providerUnavailable && canvasView === 'screen' && <SelectedElementContext />}
      {!providerUnavailable && canvasView === 'screen' && <ScreenCommentsContext />}
      {!providerUnavailable && canvasView === 'screen' && <ScreenTasksContext />}
      {!providerUnavailable && canvasView !== 'screen' && <ActiveComponentContext />}
      {!providerUnavailable && canvasView !== 'screen' && <ComponentTasksContext />}

      <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto px-4 py-4">
        {providerUnavailable ? (
          <ProviderRequiredBody />
        ) : (
          <Transcript
            messages={messages}
            pending={pending}
            iterations={lastIterations}
            truncated={lastTruncated}
            runStatus={lastRunStatus}
            runErrorCode={lastRunErrorCode}
            runSummary={lastRunSummary}
            blockingRun={lastBlockingRun}
            componentReuse={lastComponentReuse}
            runMetrics={lastRunMetrics}
            debugLogPath={lastDebugLogPath}
            runManifestPath={lastRunManifestPath}
            onContinue={handleContinue}
            onViewBlockingRun={handleOpenBackgroundRun}
            onReprobeRender={handleReprobeRender}
            onExportEvidence={handleExportEvidence}
            exportingEvidenceRunId={exportingEvidenceRunId}
            reprobingRenderRunId={reprobingRenderRunId}
            renderProof={
              lastRunManifestPath
                ? (renderProofByRunId[extractAgentRunId(lastRunManifestPath) ?? ''] ??
                  lastRenderProof)
                : lastRenderProof
            }
            onQuickReply={(text) =>
              void send(text, [], {
                agentName: sessionAgentName ?? DESCRIPTION_AGENT_NAME,
                ...(activePrimaryAgent ? { primaryAgentName: activePrimaryAgent.name } : {}),
                ...(agentInventory ? { knownAgents: agentInventory.agents } : {}),
                sessionMode: 'design',
              })
            }
            onGenerateFromPlan={(path) => {
              setSessionMode('design');
              void send(generateFromPlanPrompt(path), [], { sessionMode: 'design' });
            }}
            onRefinePlan={(path) => {
              setSessionMode('plan');
              setDraft(`${refinePlanPrompt(path)}\n\nFeedback: `);
            }}
            onDirectionSelect={(
              payload: DirectionPickerMessagePayload,
              option: DesignDirectionOption,
            ) => {
              const originalPrompt = messages.find(
                (message) => message.id === payload.requestMessageId && message.role === 'user',
              )?.content;
              if (!originalPrompt) {
                setError('The original direction-picker request is unavailable. Start a new task.');
                return;
              }
              void send(originalPrompt, [], {
                sessionMode: 'design',
                displayContent: `Use direction ${option.optionId}: ${option.label}`,
                generation: {
                  ...payload.baseGeneration,
                  designBrief: option.designBrief,
                  directionSelection: selectionFromDirectionOption(option),
                },
              });
            }}
          />
        )}
      </div>

      {backgroundRuns.length > 0 && !providerUnavailable && (
        <BackgroundRunsStrip
          runs={backgroundRuns}
          pendingPermissionsByRunId={pendingPermissionsByRunId}
          projectScreens={project?.screens ?? []}
          activeRunCount={assistantRuns.filter((run) => isInteractiveRunStatus(run.status)).length}
          onOpenRun={handleOpenBackgroundRun}
          onStopRun={handleStopBackgroundRun}
        />
      )}

      {pendingPermission && !providerUnavailable && (
        <PermissionRequestCard
          request={pendingPermission}
          activeScreen={activeScreen}
          remember={permissionRemember}
          resolving={permissionResolving}
          onRememberChange={setPermissionRemember}
          onResolve={handleResolvePermission}
        />
      )}

      {error && !providerUnavailable && (
        <div className="mx-4 mb-2 flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
          <AlertTriangle className="size-3.5 shrink-0" />
          <div className="min-w-0 flex-1 break-words">{error}</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="h-6 px-2 text-[10px] uppercase tracking-wide opacity-70 hover:opacity-100"
          >
            dismiss
          </Button>
        </div>
      )}

      <Separator />

      <div className="shrink-0 px-4 py-3">
        {!providerUnavailable && (
          <div className="mb-2 flex items-center justify-between gap-2">
            <AgentSelectorDropdown
              agents={selectableAgents}
              activeAgent={activeSessionAgent}
              pinnedSubagentName={sessionSubagent?.name ?? null}
              disabled={selectableAgents.length <= 1}
              title={activePrimaryAgentTitle}
              onSelect={handleSelectSessionAgent}
            />
            <SessionModeSelect
              value={sessionMode}
              onChange={setSessionMode}
              onExampleSelect={setDraft}
            />
          </div>
        )}
        <Composer
          providerUnavailable={providerUnavailable}
          pending={pending}
          directionSelectionPending={Boolean(pendingDirectionPicker)}
          autoRunning={autoRunning}
          stopAfterCurrent={stopAfterCurrent}
          sessionMode={sessionMode}
          autoRunArmed={autoRunArmed}
          canvasView={canvasView}
          draft={draft}
          attachments={attachments}
          attachmentCompatibility={attachmentCompatibility}
          hasHtmlAttachment={hasHtmlAttachment}
          designSourceIntent={designSourceIntent}
          designSourceComposer={designSourceComposer}
          activeScreen={activeScreen}
          mentionSuggestions={mentionSuggestions}
          activePrimaryAgent={activePrimaryAgent}
          fileInputRef={fileInputRef}
          sendBlockReason={sendBlockReason}
          onDraftChange={setDraft}
          onKeyDown={handleKey}
          onAddFiles={(files) => void addFiles(files)}
          onRemoveAttachment={(id) =>
            setAttachments((prev) => prev.filter((item) => item.id !== id))
          }
          onDesignSourceComposerChange={setDesignSourceComposer}
          onApplyMentionSuggestion={handleApplyMentionSuggestion}
          onDismissDesignSourceComposer={handleDismissDesignSourceComposer}
          onSend={() => void handleSend()}
          onStopSelectedRun={handleStopSelectedRun}
          onStopAutoAfterCurrent={stopAutoAfterCurrent}
          onStopAutoNow={stopAutoNow}
          onAutoRunArmedChange={setAutoRunArmed}
        />
      </div>
      <AutoModeDialog
        open={autoDialogOpen}
        onOpenChange={setAutoDialogOpen}
        onStart={handleStartAuto}
      />
    </aside>
  );
}
