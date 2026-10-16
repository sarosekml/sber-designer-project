/**
 * Pure helpers behind the chat store (0136 R12 — extracted from
 * chat-store.ts).
 *
 * Session selection, persisted-message conversion, assistant-state merges and
 * archived-run notices. Everything here is a function of its arguments: no
 * `set`, no `get`, no subscriptions — which is what makes it testable on its
 * own and keeps the store file about state transitions.
 */
import type {
  PersistedAssistantMessage,
  ProjectAssistantSession,
  ProjectAssistantState,
  SberDesignerProject,
} from '@sber-designer/shared-types';

import {
  activeAssistantSessionForScreen,
  mergeAssistantStateByFreshness,
  normalizeAssistantState,
  startAssistantTask,
} from '@/lib/assistant-sessions';
import type { AgentRuntimeSessionInfo } from '@/lib/api-client';
import { settleCancelledToolCalls } from '@/lib/cancelled-transcript';
import { useProjectStore } from '@/stores/project-store';

import { GLOBAL_ASSISTANT_SCREEN_ID, SEED, nextId } from './chat-store-constants';
import type { ChatMessage, ChatProjectIdentity, ChatStoreState } from './chat-store-types';

export function ensureWritableSession(
  state: ChatStoreState,
  now = new Date().toISOString(),
): { assistant: ProjectAssistantState; session: ProjectAssistantSession; screenId: string } {
  const screenId = state.activeScreenId ?? GLOBAL_ASSISTANT_SCREEN_ID;
  const existing =
    (state.activeSessionId
      ? state.assistant.sessions.find((session) => session.id === state.activeSessionId)
      : null) ?? activeAssistantSessionForScreen(state.assistant, screenId);
  if (existing) {
    return { assistant: state.assistant, session: existing, screenId };
  }
  const started = startAssistantTask(state.assistant, screenId, now);
  return { assistant: started.assistant, session: started.session, screenId };
}

export function ensureWritableSessionForId(
  state: ChatStoreState,
  sessionId: string,
  now = new Date().toISOString(),
): { assistant: ProjectAssistantState; session: ProjectAssistantSession; screenId: string } {
  const existing = state.assistant.sessions.find((session) => session.id === sessionId);
  if (existing) {
    return {
      assistant: state.assistant,
      session: existing,
      screenId: existing.primaryScreenId,
    };
  }
  return ensureWritableSession(state, now);
}

export function isVisibleSession(state: ChatStoreState, sessionId: string): boolean {
  return state.activeSessionId === sessionId;
}

export function commitAssistantState(
  set: (partial: Partial<ChatStoreState>) => void,
  assistant: ProjectAssistantState,
  activeScreenId: string | null,
  activeSessionId: string | null,
  persistProject = true,
): void {
  set({ assistant, activeScreenId, activeSessionId });
  if (!persistProject) return;
  const project = useProjectStore.getState().project;
  if (!project) return;
  useProjectStore.getState().setProject({ ...project, assistant });
}

export function mergeIncomingAssistantWithLiveHistory(
  localAssistant: ProjectAssistantState,
  incomingAssistant: ProjectAssistantState | null | undefined,
  shouldMergeLiveHistory: boolean,
): ProjectAssistantState {
  const local = normalizeAssistantState(localAssistant);
  if (!incomingAssistant) return local;
  const incoming = normalizeAssistantState(incomingAssistant);
  if (!shouldMergeLiveHistory || !assistantHasMessages(local)) return incoming;
  return mergeAssistantStateByFreshness({ local, incoming });
}

function assistantHasMessages(assistant: ProjectAssistantState): boolean {
  return assistant.sessions.some((session) => session.messages.length > 0);
}

export function projectIdentityFromProject(
  project: SberDesignerProject | null | undefined,
): ChatProjectIdentity | null {
  if (!project) return null;
  return {
    name: project.name,
    workspacePath: project.workspacePath?.trim() || null,
  };
}

export function isSameProjectIdentity(
  current: ChatProjectIdentity | null,
  next: ChatProjectIdentity | null,
): boolean {
  if (!current || !next) return false;
  if (current.workspacePath && next.workspacePath) {
    return current.workspacePath === next.workspacePath;
  }
  return current.name === next.name;
}

export function messagesForSession(session: ProjectAssistantSession | null): ChatMessage[] {
  if (!session || session.messages.length === 0) return SEED;
  const messages = session.messages.map(fromPersistedMessage);
  return session.metadata?.lastRunStatus === 'cancelled'
    ? settleCancelledToolCalls(messages, { afterMessageId: lastUserMessageId(messages) })
    : messages;
}

export function settleCancelledAssistantSessions(
  assistant: ProjectAssistantState,
): ProjectAssistantState {
  let changed = false;
  const sessions = assistant.sessions.map((session) => {
    if (session.metadata?.lastRunStatus !== 'cancelled') return session;
    const messages = session.messages.map(fromPersistedMessage);
    const settled = settleCancelledToolCalls(messages, {
      afterMessageId: lastUserMessageId(messages),
      now: session.updatedAt,
    });
    if (settled === messages) return session;
    changed = true;
    return {
      ...session,
      messages: settled.map((message) => toPersistedMessage(message, session.updatedAt)),
    };
  });
  return changed ? { ...assistant, sessions } : assistant;
}

export function lastUserMessageId(messages: ChatMessage[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user') return message.id;
  }
  return undefined;
}

export function createArchivedRunNotice(
  session: ProjectAssistantSession,
  now: string,
): ChatMessage | null {
  const metadata = session.metadata;
  const status = metadata?.lastRunStatus;
  if (status !== 'failed' && status !== 'preflight_rejected' && status !== 'cancelled') {
    return null;
  }
  if (!metadata) return null;
  const summary = metadata.lastRunSummary?.trim();
  if (!summary) return null;
  const runManifestPath = metadata.lastRunManifestPath ?? null;
  const errorCode = metadata.lastRunErrorCode ?? null;
  const alreadyArchived = session.messages.some((message) => {
    const notice = message.metadata?.archivedRunNotice;
    if (!notice || typeof notice !== 'object') return false;
    const value = notice as Record<string, unknown>;
    return (
      value.status === status &&
      value.summary === summary &&
      (value.runManifestPath ?? null) === runManifestPath &&
      (value.errorCode ?? null) === errorCode
    );
  });
  if (alreadyArchived) return null;
  const prefix =
    status === 'preflight_rejected'
      ? 'Previous run was rejected before start'
      : status === 'cancelled'
        ? 'Previous run was cancelled'
        : 'Previous run failed';
  return {
    id: nextId('run-notice'),
    role: 'assistant',
    content: `${prefix}: ${summary}`,
    createdAt: now,
    contextEligible: false,
    metadata: {
      archivedRunNotice: {
        status,
        summary,
        ...(errorCode ? { errorCode } : {}),
        ...(metadata.lastAttemptId ? { attemptId: metadata.lastAttemptId } : {}),
        ...(metadata.lastDebugLogPath ? { debugLogPath: metadata.lastDebugLogPath } : {}),
        ...(runManifestPath ? { runManifestPath } : {}),
      },
    },
  };
}

export function runStateForSession(
  session: ProjectAssistantSession | null,
): Pick<
  ChatStoreState,
  | 'lastDebugLogPath'
  | 'lastRunManifestPath'
  | 'lastAttemptId'
  | 'lastRunStatus'
  | 'lastRunSummary'
  | 'lastRunErrorCode'
  | 'lastBlockingRun'
  | 'lastComponentReuse'
  | 'lastRenderProof'
  | 'lastRunMetrics'
> {
  if (!session) {
    return {
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
    };
  }
  const latestMessageRunManifest = [...session.messages]
    .reverse()
    .find((message) => message.runManifestId)?.runManifestId;
  const linkedRunManifestIds = session.linkedRunManifestIds ?? [];
  return {
    lastDebugLogPath: session.metadata?.lastDebugLogPath ?? null,
    lastRunManifestPath:
      session.metadata?.lastRunManifestPath ??
      linkedRunManifestIds[linkedRunManifestIds.length - 1] ??
      latestMessageRunManifest ??
      null,
    lastAttemptId: session.metadata?.lastAttemptId ?? null,
    lastRunStatus: session.metadata?.lastRunStatus ?? null,
    lastRunSummary: session.metadata?.lastRunSummary ?? null,
    lastRunErrorCode: session.metadata?.lastRunErrorCode ?? null,
    lastBlockingRun: session.metadata?.lastBlockingRun ?? null,
    lastComponentReuse: session.metadata?.lastComponentReuse ?? null,
    lastRenderProof: null,
    lastRunMetrics: session.metadata?.lastRunMetrics ?? null,
  };
}

export function runtimeSessionMetadata(
  runtimeSession: AgentRuntimeSessionInfo | undefined,
): Record<string, unknown> {
  const sessionId = runtimeSession?.sessionId?.trim();
  if (!runtimeSession || !sessionId) return {};
  return {
    runtimeSessionId: sessionId,
    runtimeSessionRuntime: runtimeSession.runtime,
    runtimeSessionModel: runtimeSession.model ?? null,
    runtimeSessionWorkspacePath: runtimeSession.workspacePath ?? null,
    runtimeSessionUpdatedAt: runtimeSession.updatedAt ?? new Date().toISOString(),
    ...(runtimeSession.cumulativeUsage
      ? { runtimeSessionUsage: runtimeSession.cumulativeUsage }
      : {}),
  };
}

export function toPersistedMessage(message: ChatMessage, now: string): PersistedAssistantMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt ?? now,
    ...(message.attachments && message.attachments.length > 0
      ? {
          attachments: message.attachments.map((attachment) => ({
            id: attachment.id,
            name: attachment.name,
            mimeType: attachment.mimeType,
            size: attachment.size,
            kind: attachment.kind,
          })),
        }
      : {}),
    ...(message.toolCalls ? { toolCalls: message.toolCalls } : {}),
    ...(message.toolCallId ? { toolCallId: message.toolCallId } : {}),
    ...(message.meta ? { meta: message.meta } : {}),
    ...(message.external ? { external: true, contextEligible: false } : {}),
    ...(message.contextEligible === false ? { contextEligible: false } : {}),
    ...(message.runManifestId ? { runManifestId: message.runManifestId } : {}),
    ...(message.tokenUsage ? { tokenUsage: message.tokenUsage } : {}),
    ...(message.metadata ? { metadata: message.metadata } : {}),
  };
}

export function fromPersistedMessage(message: PersistedAssistantMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    ...(message.attachments ? { attachments: message.attachments } : {}),
    ...(message.toolCalls ? { toolCalls: message.toolCalls } : {}),
    ...(message.toolCallId ? { toolCallId: message.toolCallId } : {}),
    ...(message.meta ? { meta: message.meta } : {}),
    ...(message.runManifestId ? { runManifestId: message.runManifestId } : {}),
    ...(message.tokenUsage ? { tokenUsage: message.tokenUsage } : {}),
    ...(message.external ? { external: true } : {}),
    ...(message.contextEligible === false ? { contextEligible: false } : {}),
    ...(message.metadata ? { metadata: message.metadata } : {}),
  };
}
