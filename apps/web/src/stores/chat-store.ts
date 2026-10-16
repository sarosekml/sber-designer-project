/**
 * Editor chat transcript.
 *
 * 0051 splits the assistant surface into two layers:
 * - visible messages for the active screen task;
 * - persisted screen assistant sessions stored on the project.
 *
 * The model receives curated task context from the active session instead of
 * every historical message shown in the UI.
 *
 * 0136 R12 — this file is the state machine. Its neighbours:
 *   ./chat-store-types        the shapes (messages, sessions, store state)
 *   ./chat-store-constants    screen ids and the seeded transcript
 *   ./chat-session-helpers    pure session/message/merge helpers
 * Types and screen-id constants are re-exported below, so components keep
 * importing them from '@/stores/chat-store'.
 */
import { create } from 'zustand';

import {
  activeAssistantSessionForScreen,
  appendAssistantMessages,
  buildAgentMessageContext,
  createEmptyAssistantState,
  deleteAssistantTask,
  replaceAssistantSessionMessages,
  retargetAssistantTask,
  restoreAssistantTask,
  setAssistantSessionContextMode,
  setAssistantSessionMode,
  startAssistantTask,
  updateAssistantSessionRunMetadata,
  updateAssistantTaskSummary,
} from '@/lib/assistant-sessions';
import type { AgentPermissionRequest } from '@/lib/api-client';
import { settleCancelledToolCalls } from '@/lib/cancelled-transcript';
import { useProjectStore } from '@/stores/project-store';

import {
  DESIGN_SYSTEM_ASSISTANT_SCREEN_ID,
  GLOBAL_ASSISTANT_SCREEN_ID,
  SEED,
  STORYBOOK_ASSISTANT_SCREEN_ID,
  nextId,
} from './chat-store-constants';
import type {
  ChatAttachment,
  ChatContextSummary,
  ChatMessage,
  ChatProjectIdentity,
  ChatStoreState,
  ReplaceTurnInfo,
} from './chat-store-types';
import {
  commitAssistantState,
  createArchivedRunNotice,
  ensureWritableSession,
  ensureWritableSessionForId,
  fromPersistedMessage,
  isSameProjectIdentity,
  isVisibleSession,
  lastUserMessageId,
  mergeIncomingAssistantWithLiveHistory,
  messagesForSession,
  projectIdentityFromProject,
  runStateForSession,
  runtimeSessionMetadata,
  settleCancelledAssistantSessions,
  toPersistedMessage,
} from './chat-session-helpers';

// Facade: these moved in 0136 R12; '@/stores/chat-store' stays the import path.
export {
  DESIGN_SYSTEM_ASSISTANT_SCREEN_ID,
  GLOBAL_ASSISTANT_SCREEN_ID,
  STORYBOOK_ASSISTANT_SCREEN_ID,
} from './chat-store-constants';
export type {
  ChatAttachment,
  ChatMessage,
  ChatContextSummary,
  ChatProjectIdentity,
  ChatStoreState,
  ReplaceTurnInfo,
} from './chat-store-types';

function permissionRunKeys(
  runKey: string | null | undefined,
  request: AgentPermissionRequest | null,
): string[] {
  return Array.from(
    new Set(
      [runKey, request?.runId]
        .map((key) => (typeof key === 'string' ? key.trim() : ''))
        .filter(Boolean),
    ),
  );
}

function firstPendingPermission(
  map: Record<string, AgentPermissionRequest>,
): AgentPermissionRequest | null {
  return Object.values(map)[0] ?? null;
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  messages: SEED,
  assistant: createEmptyAssistantState(),
  projectIdentity: null,
  activeScreenId: null,
  activeSessionId: null,
  lastContextSummary: null,
  pending: false,
  lastIterations: null,
  lastTruncated: false,
  lastDebugLogPath: null,
  lastRunManifestPath: null,
  lastAttemptId: null,
  lastRunStatus: null,
  lastRunSummary: null,
  lastRunErrorCode: null,
  lastBlockingRun: null,
  lastComponentReuse: null,
  lastRenderProof: null,
  lastRunMetrics: null,
  error: null,
  useStreaming: true,
  cancel: null,
  pendingPermission: null,
  pendingPermissionsByRunId: {},
  sessionAgentBySession: {},

  hydrateFromProject: (project) => {
    const nextProjectIdentity = projectIdentityFromProject(project);
    const shouldMergeLiveHistory = isSameProjectIdentity(
      get().projectIdentity,
      nextProjectIdentity,
    );
    const assistant = settleCancelledAssistantSessions(
      project
        ? mergeIncomingAssistantWithLiveHistory(
            get().assistant,
            project.assistant,
            shouldMergeLiveHistory,
          )
        : createEmptyAssistantState(),
    );
    const activeScreenId = get().activeScreenId;
    const session = activeAssistantSessionForScreen(assistant, activeScreenId);
    set({
      assistant,
      projectIdentity: nextProjectIdentity,
      activeSessionId: session?.id ?? null,
      messages: messagesForSession(session),
      ...runStateForSession(session),
    });
  },

  switchToScreen: (screenId) => {
    const project = useProjectStore.getState().project;
    const nextProjectIdentity = projectIdentityFromProject(project);
    const assistant = settleCancelledAssistantSessions(
      mergeIncomingAssistantWithLiveHistory(
        get().assistant,
        project?.assistant,
        isSameProjectIdentity(get().projectIdentity, nextProjectIdentity),
      ),
    );
    const session = activeAssistantSessionForScreen(assistant, screenId);
    set({
      assistant,
      projectIdentity: nextProjectIdentity ?? get().projectIdentity,
      activeScreenId: screenId,
      activeSessionId: session?.id ?? null,
      messages: messagesForSession(session),
      lastContextSummary: null,
      ...runStateForSession(session),
    });
  },

  startNewTask: (screenId) => {
    const targetScreenId = screenId ?? get().activeScreenId ?? GLOBAL_ASSISTANT_SCREEN_ID;
    const now = new Date().toISOString();
    const started = startAssistantTask(get().assistant, targetScreenId, now);
    commitAssistantState(set, started.assistant, targetScreenId, started.session.id);
    set({
      messages: SEED,
      lastContextSummary: null,
      error: null,
      // 0083 F2: reset run metadata so a fresh chat doesn't show the previous
      // run's "Agent log / Agent run" blocks (parity with restoreTask).
      ...runStateForSession(started.session),
    });
    return started.session.id;
  },

  restoreTask: (sessionId) => {
    const restored = restoreAssistantTask(get().assistant, sessionId);
    if (!restored) return;
    commitAssistantState(
      set,
      restored.assistant,
      restored.session.primaryScreenId,
      restored.session.id,
    );
    set({
      messages: messagesForSession(restored.session),
      lastContextSummary: null,
      error: null,
      ...runStateForSession(restored.session),
    });
  },

  retargetTaskToScreen: (sessionId, screenId, options = {}) => {
    const current = get();
    const sourceAgentName = current.sessionAgentBySession[sessionId];
    const retargeted = retargetAssistantTask(
      current.assistant,
      sessionId,
      screenId,
      options.targetScreenName ? { targetScreenName: options.targetScreenName } : {},
    );
    if (!retargeted) return null;
    commitAssistantState(
      set,
      retargeted.assistant,
      retargeted.session.primaryScreenId,
      retargeted.session.id,
      options.persistProject ?? true,
    );
    set((state) => ({
      messages: messagesForSession(retargeted.session),
      lastContextSummary: null,
      error: null,
      ...(sourceAgentName
        ? {
            sessionAgentBySession: {
              ...state.sessionAgentBySession,
              [retargeted.session.id]: sourceAgentName,
            },
          }
        : {}),
      ...runStateForSession(retargeted.session),
    }));
    return retargeted.session.id;
  },

  deleteTask: (sessionId) => {
    const current = get();
    const nextAssistant = deleteAssistantTask(current.assistant, sessionId);
    const session =
      current.activeSessionId === sessionId
        ? activeAssistantSessionForScreen(nextAssistant, current.activeScreenId)
        : current.activeSession();
    commitAssistantState(set, nextAssistant, current.activeScreenId, session?.id ?? null);
    const sessionAgentBySession = { ...current.sessionAgentBySession };
    delete sessionAgentBySession[sessionId];
    set({
      messages: messagesForSession(session),
      lastContextSummary: null,
      error: null,
      sessionAgentBySession,
    });
  },

  updateTaskSummary: (sessionId, patch) => {
    const nextAssistant = updateAssistantTaskSummary(get().assistant, sessionId, patch);
    commitAssistantState(set, nextAssistant, get().activeScreenId, get().activeSessionId);
  },

  setContextMode: (mode) => {
    const current = ensureWritableSession(get());
    const assistant = setAssistantSessionContextMode(current.assistant, current.session.id, mode);
    commitAssistantState(set, assistant, current.screenId, current.session.id);
  },

  setSessionMode: (mode) => {
    const current = ensureWritableSession(get());
    const assistant = setAssistantSessionMode(current.assistant, current.session.id, mode);
    commitAssistantState(set, assistant, current.screenId, current.session.id);
  },

  activeSession: () => {
    const state = get();
    return (
      state.assistant.sessions.find((session) => session.id === state.activeSessionId) ??
      activeAssistantSessionForScreen(state.assistant, state.activeScreenId)
    );
  },

  ensureSessionForScreen: (screenId) => {
    const state = get();
    const targetScreenId = screenId ?? state.activeScreenId ?? GLOBAL_ASSISTANT_SCREEN_ID;
    const existing = activeAssistantSessionForScreen(state.assistant, targetScreenId);
    if (existing) return { screenId: targetScreenId, sessionId: existing.id };
    const now = new Date().toISOString();
    const started = startAssistantTask(state.assistant, targetScreenId, now);
    const shouldSelect = state.activeScreenId === targetScreenId;
    commitAssistantState(
      set,
      started.assistant,
      state.activeScreenId,
      shouldSelect ? started.session.id : state.activeSessionId,
    );
    if (shouldSelect) {
      set({
        messages: messagesForSession(started.session),
        lastContextSummary: null,
        ...runStateForSession(started.session),
      });
    }
    return { screenId: targetScreenId, sessionId: started.session.id };
  },

  contextMessages: (latestUserMessageId) => {
    const session = get().activeSession();
    return get().contextMessagesForSession(session?.id ?? '', latestUserMessageId);
  },

  contextMessagesForSession: (sessionId, latestUserMessageId) => {
    const session =
      get().assistant.sessions.find((candidate) => candidate.id === sessionId) ?? null;
    const context = buildAgentMessageContext({
      session,
      ...(latestUserMessageId ? { latestUserMessageId } : {}),
      ...(session?.contextMode ? { mode: session.contextMode } : {}),
    });
    const visibleById = new Map(get().messages.map((message) => [message.id, message]));
    set({ lastContextSummary: { mode: context.mode, includedCount: context.includedCount } });
    return context.messages.map(
      (message) => visibleById.get(message.id) ?? fromPersistedMessage(message),
    );
  },

  appendUser: (content, attachments) => {
    const target = get().ensureSessionForScreen(get().activeScreenId);
    return get().appendUserToSession(target.sessionId, content, attachments);
  },

  appendUserToSession: (sessionId, content, attachments, options = {}) => {
    const id = nextId();
    const now = new Date().toISOString();
    const current = ensureWritableSessionForId(get(), sessionId, now);
    const message: ChatMessage = {
      id,
      role: 'user',
      content,
      createdAt: now,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
      ...(options.contextEligible === false ? { contextEligible: false } : {}),
      ...(options.metadata ? { metadata: options.metadata } : {}),
    };
    const assistant = appendAssistantMessages(
      current.assistant,
      current.session.id,
      [toPersistedMessage(message, now)],
      now,
    );
    commitAssistantState(
      set,
      assistant,
      get().activeScreenId,
      get().activeSessionId,
      options.persistProject ?? true,
    );
    if (isVisibleSession(get(), current.session.id)) {
      set({
        messages: [...get().messages.filter((m) => m.id !== 'seed-welcome'), message],
      });
    }
    return id;
  },

  appendAssistantToSession: (sessionId, content, options = {}) => {
    const id = nextId('assistant');
    const now = new Date().toISOString();
    const current = ensureWritableSessionForId(get(), sessionId, now);
    const message: ChatMessage = {
      id,
      role: 'assistant',
      content,
      createdAt: now,
      ...(options.contextEligible === false ? { contextEligible: false } : {}),
      ...(options.metadata ? { metadata: options.metadata } : {}),
    };
    const assistant = appendAssistantMessages(
      current.assistant,
      current.session.id,
      [toPersistedMessage(message, now)],
      now,
    );
    commitAssistantState(
      set,
      assistant,
      get().activeScreenId,
      get().activeSessionId,
      options.persistProject ?? true,
    );
    if (isVisibleSession(get(), current.session.id)) {
      set({
        messages: [...get().messages.filter((item) => item.id !== 'seed-welcome'), message],
      });
    }
    return id;
  },

  appendExternalAssistant: (content, meta) => {
    const id = nextId('bridge');
    const now = new Date().toISOString();
    const current = ensureWritableSession(get(), now);
    const message: ChatMessage = {
      id,
      role: 'assistant',
      content,
      meta,
      external: true,
      contextEligible: false,
      createdAt: now,
    };
    const assistant = appendAssistantMessages(
      current.assistant,
      current.session.id,
      [toPersistedMessage(message, now)],
      now,
    );
    commitAssistantState(set, assistant, current.screenId, current.session.id);
    set({
      messages: [...get().messages.filter((m) => m.id !== 'seed-welcome'), message],
    });
    return id;
  },

  replaceTurn: (next, info) => {
    const current = ensureWritableSession(get());
    get().replaceTurnForSession(current.session.id, next, info);
  },

  replaceTurnForSession: (sessionId, next, info, options = {}) => {
    const current = ensureWritableSessionForId(get(), sessionId);
    const externals = get().messages.filter((m) => m.external);
    const shouldUpdateVisible = isVisibleSession(get(), current.session.id);
    const sessionMessages = messagesForSession(current.session).filter((m) => m.external);
    const visible = [
      ...next.filter((m) => !m.external && m.id !== 'seed-welcome'),
      ...(shouldUpdateVisible ? externals : sessionMessages),
    ];
    const now = new Date().toISOString();
    const visibleWithTimestamps = visible.map((message) =>
      message.createdAt ? message : { ...message, createdAt: now },
    );
    let latestUserIndex = -1;
    for (let index = visibleWithTimestamps.length - 1; index >= 0; index -= 1) {
      if (visibleWithTimestamps[index]?.role === 'user') {
        latestUserIndex = index;
        break;
      }
    }
    const visibleWithRunIdentity = visibleWithTimestamps.map((message, index) => ({
      ...message,
      ...(info.runManifestPath &&
      index > latestUserIndex &&
      !message.runManifestId &&
      (message.role === 'assistant' || message.role === 'tool')
        ? { runManifestId: info.runManifestPath }
        : {}),
    }));
    let assistant = replaceAssistantSessionMessages(
      current.assistant,
      current.session.id,
      visibleWithRunIdentity.map((message) => toPersistedMessage(message, now)),
      now,
    );
    assistant = updateAssistantSessionRunMetadata(
      assistant,
      current.session.id,
      {
        lastAttemptId: info.attemptId ?? null,
        lastDebugLogPath: info.debugLogPath ?? null,
        lastRunManifestPath: info.runManifestPath ?? null,
        lastRunStatus: info.runStatus ?? (info.truncated ? 'failed' : 'complete'),
        lastRunSummary: info.runSummary ?? null,
        lastRunErrorCode: info.runErrorCode ?? null,
        lastBlockingRun: info.blockingRun ?? null,
        lastComponentReuse: info.componentReuse ?? null,
        lastRunMetrics: info.runMetrics ?? null,
        ...runtimeSessionMetadata(info.runtimeSession),
      },
      now,
    );
    commitAssistantState(
      set,
      assistant,
      get().activeScreenId,
      get().activeSessionId,
      options.persistProject ?? true,
    );
    if (shouldUpdateVisible) {
      set({
        messages: visibleWithRunIdentity.length > 0 ? visibleWithRunIdentity : SEED,
        lastIterations: info.iterations,
        lastTruncated: info.truncated,
        lastDebugLogPath: info.debugLogPath ?? null,
        lastRunManifestPath: info.runManifestPath ?? null,
        lastAttemptId: info.attemptId ?? null,
        lastRunStatus: info.runStatus ?? (info.truncated ? 'failed' : 'complete'),
        lastRunSummary: info.runSummary ?? null,
        lastRunErrorCode: info.runErrorCode ?? null,
        lastBlockingRun: info.blockingRun ?? null,
        lastComponentReuse: info.componentReuse ?? null,
        lastRenderProof: info.renderProof ?? null,
        lastRunMetrics: info.runMetrics ?? null,
        error: null,
      });
    }
  },

  markRunStartedForSession: (sessionId, info = {}, options = {}) => {
    const current = ensureWritableSessionForId(get(), sessionId);
    const now = new Date().toISOString();
    const archivedNotice = createArchivedRunNotice(current.session, now);
    const assistantWithArchivedNotice = archivedNotice
      ? appendAssistantMessages(
          current.assistant,
          current.session.id,
          [toPersistedMessage(archivedNotice, now)],
          now,
        )
      : current.assistant;
    const assistant = updateAssistantSessionRunMetadata(
      assistantWithArchivedNotice,
      current.session.id,
      {
        lastAttemptId: info.attemptId ?? null,
        lastDebugLogPath: info.debugLogPath ?? null,
        lastRunManifestPath: info.runManifestPath ?? null,
        lastRunStatus: 'running',
        lastRunSummary: null,
        lastRunErrorCode: null,
        lastBlockingRun: null,
        lastComponentReuse: null,
        lastRunMetrics: null,
      },
      now,
    );
    commitAssistantState(
      set,
      assistant,
      get().activeScreenId,
      get().activeSessionId,
      options.persistProject ?? false,
    );
    if (isVisibleSession(get(), current.session.id)) {
      const updatedSession =
        assistant.sessions.find((session) => session.id === current.session.id) ?? current.session;
      set({
        ...(archivedNotice ? { messages: messagesForSession(updatedSession) } : {}),
        lastIterations: null,
        lastTruncated: false,
        lastDebugLogPath: info.debugLogPath ?? null,
        lastRunManifestPath: info.runManifestPath ?? null,
        lastAttemptId: info.attemptId ?? null,
        lastRunStatus: 'running',
        lastRunSummary: null,
        lastRunErrorCode: null,
        lastBlockingRun: null,
        lastComponentReuse: null,
        lastRenderProof: null,
        lastRunMetrics: null,
        error: null,
      });
    }
  },

  settleCancelledRunForSession: (sessionId, options = {}) => {
    const current = ensureWritableSessionForId(get(), sessionId);
    const metadata = current.session.metadata;
    const messages = current.session.messages.map(fromPersistedMessage);
    const settled = settleCancelledToolCalls(messages, {
      afterMessageId: options.afterMessageId ?? lastUserMessageId(messages),
    });
    const visibleIterations = isVisibleSession(get(), current.session.id)
      ? get().lastIterations
      : null;
    get().replaceTurnForSession(
      current.session.id,
      settled,
      {
        iterations: visibleIterations ?? metadata?.lastRunMetrics?.iterations ?? 0,
        truncated: false,
        runStatus: 'cancelled',
        runSummary: options.summary?.trim() || 'Cancelled by user.',
        ...(metadata?.lastAttemptId ? { attemptId: metadata.lastAttemptId } : {}),
        ...(metadata?.lastDebugLogPath ? { debugLogPath: metadata.lastDebugLogPath } : {}),
        ...(metadata?.lastRunManifestPath ? { runManifestPath: metadata.lastRunManifestPath } : {}),
        ...(metadata?.lastComponentReuse ? { componentReuse: metadata.lastComponentReuse } : {}),
        ...(metadata?.lastRunMetrics ? { runMetrics: metadata.lastRunMetrics } : {}),
      },
      { persistProject: options.persistProject ?? true },
    );
  },

  setVisibleMessages: (next) => {
    const current = ensureWritableSession(get());
    get().setVisibleMessagesForSession(current.session.id, next);
  },

  setVisibleMessagesForSession: (sessionId, next, options = {}) => {
    const current = ensureWritableSessionForId(get(), sessionId);
    const visible = next.filter((message) => message.id !== 'seed-welcome');
    const now = new Date().toISOString();
    const assistant = replaceAssistantSessionMessages(
      current.assistant,
      current.session.id,
      visible.map((message) => toPersistedMessage(message, now)),
      now,
    );
    commitAssistantState(
      set,
      assistant,
      get().activeScreenId,
      get().activeSessionId,
      options.persistProject ?? true,
    );
    if (isVisibleSession(get(), current.session.id)) {
      set({ messages: next.length > 0 ? next : SEED });
    }
  },

  setPending: (pending) => set({ pending }),
  setError: (error) => set({ error }),
  setUseStreaming: (useStreaming) => set({ useStreaming }),
  setCancel: (cancel) => set({ cancel }),
  setPendingPermission: (request) =>
    set((state) => {
      if (!request) return { pendingPermission: null };
      const keys = permissionRunKeys(request.runId ?? request.id, request);
      const next = { ...state.pendingPermissionsByRunId };
      for (const key of keys) next[key] = request;
      return { pendingPermission: request, pendingPermissionsByRunId: next };
    }),
  setPendingPermissionForRun: (runKey, request) =>
    set((state) => {
      const keys = permissionRunKeys(runKey, request);
      const next = { ...state.pendingPermissionsByRunId };
      for (const key of keys) {
        if (request) next[key] = request;
        else delete next[key];
      }
      return {
        pendingPermissionsByRunId: next,
        pendingPermission: request ?? firstPendingPermission(next),
      };
    }),
  pendingPermissionForRun: (runKey) => {
    const key = typeof runKey === 'string' ? runKey.trim() : '';
    if (!key) return null;
    return get().pendingPermissionsByRunId[key] ?? null;
  },
  clearPendingPermissionForTool: (toolCallId, runKey) =>
    set((state) => {
      const next = { ...state.pendingPermissionsByRunId };
      for (const [key, request] of Object.entries(next)) {
        if (request.toolCallId === toolCallId || key === runKey) delete next[key];
      }
      const current =
        state.pendingPermission?.toolCallId === toolCallId
          ? firstPendingPermission(next)
          : state.pendingPermission;
      return { pendingPermissionsByRunId: next, pendingPermission: current };
    }),
  clearPendingPermissionsForRun: (runKey) =>
    set((state) => {
      const key = typeof runKey === 'string' ? runKey.trim() : '';
      if (!key) return {};
      const next = { ...state.pendingPermissionsByRunId };
      const request = next[key];
      for (const candidate of permissionRunKeys(key, request ?? null)) delete next[candidate];
      const current =
        state.pendingPermission && Object.values(next).includes(state.pendingPermission)
          ? state.pendingPermission
          : firstPendingPermission(next);
      return { pendingPermissionsByRunId: next, pendingPermission: current };
    }),
  setSessionAgentName: (name) => {
    const sessionId = get().activeSessionId;
    if (!sessionId) return;
    set((state) => {
      const next = { ...state.sessionAgentBySession };
      if (name) next[sessionId] = name;
      else delete next[sessionId];
      return { sessionAgentBySession: next };
    });
  },
  activeSessionAgentName: () => {
    const { activeSessionId, sessionAgentBySession } = get();
    return (activeSessionId && sessionAgentBySession[activeSessionId]) || null;
  },
  reset: () =>
    set({
      messages: SEED,
      assistant: createEmptyAssistantState(),
      projectIdentity: null,
      activeScreenId: null,
      activeSessionId: null,
      lastContextSummary: null,
      pending: false,
      lastIterations: null,
      lastTruncated: false,
      lastDebugLogPath: null,
      lastRunManifestPath: null,
      lastAttemptId: null,
      lastRunStatus: null,
      lastRunErrorCode: null,
      lastBlockingRun: null,
      lastComponentReuse: null,
      lastRenderProof: null,
      lastRunMetrics: null,
      error: null,
      pendingPermission: null,
      pendingPermissionsByRunId: {},
      sessionAgentBySession: {},
    }),
}));
