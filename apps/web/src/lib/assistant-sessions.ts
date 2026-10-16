import type {
  AssistantContextMode,
  AssistantSessionMode,
  PersistedAssistantMessage,
  ProjectAssistantSession,
  ProjectAssistantState,
} from '@sber-designer/shared-types';
import { normalizeAssistantSessionMode } from '@sber-designer/shared-types';
import {
  fallbackTaskTitle,
  nextAssistantSessionId,
  titleFromMessages,
  titleSourceFromMessages,
} from './assistant-session-titles';

export const ASSISTANT_STORAGE_VERSION = 1;
export const DEFAULT_ASSISTANT_CONTEXT_MODE: AssistantContextMode = 'current-task';
export const MAX_ASSISTANT_SESSIONS_PER_SCREEN = 20;
export const MAX_ASSISTANT_MESSAGES_PER_SESSION = 200;
const COMPACT_CONTEXT_SOURCE_PROMPT_MAX_CHARS = 4000;

export interface StartAssistantTaskResult {
  assistant: ProjectAssistantState;
  session: ProjectAssistantSession;
}

export interface RetargetAssistantTaskOptions {
  targetScreenName?: string;
  now?: string;
}

export interface RetargetAssistantTaskResult extends StartAssistantTaskResult {
  sourceSession: ProjectAssistantSession;
}

export interface BuildAgentMessageContextInput {
  session: ProjectAssistantSession | null;
  latestUserMessageId?: string;
  mode?: AssistantContextMode;
  maxMessages?: number;
}

export interface BuildAgentMessageContextResult {
  mode: AssistantContextMode;
  messages: PersistedAssistantMessage[];
  includedCount: number;
  excludedReasons: string[];
}

export interface AssistantTaskSummaryPatch {
  title?: string;
  summary?: string;
  lastSummarizedMessageId?: string;
}

export function createEmptyAssistantState(): ProjectAssistantState {
  return {
    storageVersion: ASSISTANT_STORAGE_VERSION,
    activeSessionByScreenId: {},
    sessions: [],
  };
}

export function normalizeAssistantState(
  assistant: ProjectAssistantState | null | undefined,
): ProjectAssistantState {
  return pruneAssistantState({
    storageVersion: assistant?.storageVersion ?? ASSISTANT_STORAGE_VERSION,
    activeSessionByScreenId: { ...assistant?.activeSessionByScreenId },
    sessions: (assistant?.sessions ?? []).map((session) => ({
      ...session,
      sessionMode: normalizeAssistantSessionMode(session.sessionMode),
    })),
  });
}

export function activeAssistantSessionForScreen(
  assistant: ProjectAssistantState | null | undefined,
  screenId: string | null,
): ProjectAssistantSession | null {
  if (!assistant || !screenId) return null;
  const activeId = assistant.activeSessionByScreenId?.[screenId];
  if (activeId) {
    const active = assistant.sessions.find((session) => session.id === activeId);
    if (active) return active;
  }
  return (
    assistant.sessions.find(
      (session) => session.primaryScreenId === screenId && session.status === 'active',
    ) ?? null
  );
}

export function startAssistantTask(
  assistant: ProjectAssistantState | null | undefined,
  screenId: string,
  now = new Date().toISOString(),
): StartAssistantTaskResult {
  const normalized = normalizeAssistantState(assistant);
  const archivedSessions = normalized.sessions.map((session) =>
    session.primaryScreenId === screenId && session.status === 'active'
      ? { ...session, status: 'archived' as const, archivedAt: now, updatedAt: now }
      : session,
  );
  const session: ProjectAssistantSession = {
    id: nextAssistantSessionId(screenId),
    title: fallbackTaskTitle(now),
    titleSource: 'fallback',
    primaryScreenId: screenId,
    status: 'active',
    sessionMode: 'design',
    contextMode: DEFAULT_ASSISTANT_CONTEXT_MODE,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  const next = pruneAssistantState({
    storageVersion: normalized.storageVersion ?? ASSISTANT_STORAGE_VERSION,
    activeSessionByScreenId: {
      ...normalized.activeSessionByScreenId,
      [screenId]: session.id,
    },
    sessions: [...archivedSessions, session],
  });
  return { assistant: next, session };
}

export function appendAssistantMessages(
  assistant: ProjectAssistantState,
  sessionId: string,
  messages: PersistedAssistantMessage[],
  now = new Date().toISOString(),
): ProjectAssistantState {
  return updateAssistantSession(assistant, sessionId, (session) => ({
    ...session,
    title:
      session.titleSource === 'fallback'
        ? titleFromMessages(messages, session.title)
        : session.title,
    titleSource:
      session.titleSource === 'fallback'
        ? titleSourceFromMessages(messages)
        : (session.titleSource ?? 'fallback'),
    messages: pruneMessages([...session.messages, ...messages]),
    updatedAt: now,
  }));
}

export function restoreAssistantTask(
  assistant: ProjectAssistantState,
  sessionId: string,
  now = new Date().toISOString(),
): StartAssistantTaskResult | null {
  const normalized = normalizeAssistantState(assistant);
  const target = normalized.sessions.find((session) => session.id === sessionId);
  if (!target) return null;
  const sessions = normalized.sessions.map((session) => {
    if (session.id === sessionId) {
      const { archivedAt: _archivedAt, ...rest } = session;
      return {
        ...rest,
        status: 'active' as const,
        contextMode: DEFAULT_ASSISTANT_CONTEXT_MODE,
        updatedAt: now,
      };
    }
    if (session.primaryScreenId === target.primaryScreenId && session.status === 'active') {
      return { ...session, status: 'archived' as const, archivedAt: now, updatedAt: now };
    }
    return session;
  });
  const next = pruneAssistantState({
    storageVersion: normalized.storageVersion ?? ASSISTANT_STORAGE_VERSION,
    activeSessionByScreenId: {
      ...normalized.activeSessionByScreenId,
      [target.primaryScreenId]: sessionId,
    },
    sessions,
  });
  const session = next.sessions.find((candidate) => candidate.id === sessionId);
  return session ? { assistant: next, session } : null;
}

export function retargetAssistantTask(
  assistant: ProjectAssistantState | null | undefined,
  sourceSessionId: string,
  targetScreenId: string,
  options: RetargetAssistantTaskOptions = {},
): RetargetAssistantTaskResult | null {
  const normalized = normalizeAssistantState(assistant);
  const source = normalized.sessions.find((session) => session.id === sourceSessionId);
  if (!source || !targetScreenId || source.primaryScreenId === targetScreenId) return null;

  const now = options.now ?? new Date().toISOString();
  const targetSessionId = nextAssistantSessionId(targetScreenId);
  const targetScreenName = options.targetScreenName?.trim() || targetScreenId;
  const sourceHandoff = retargetHandoffMessage({
    direction: 'from',
    now,
    source,
    targetScreenId,
    targetScreenName,
    targetSessionId,
  });
  const targetHandoff = retargetHandoffMessage({
    direction: 'to',
    now,
    source,
    targetScreenId,
    targetScreenName,
    targetSessionId,
  });

  const targetSession: ProjectAssistantSession = {
    id: targetSessionId,
    title: source.title,
    titleSource: source.titleSource ?? 'fallback',
    primaryScreenId: targetScreenId,
    linkedScreenIds: uniqueScreenIds([
      source.primaryScreenId,
      ...(source.linkedScreenIds ?? []),
    ]).filter((screenId) => screenId !== targetScreenId),
    status: 'active',
    sessionMode: normalizeAssistantSessionMode(source.sessionMode),
    contextMode: source.contextMode ?? DEFAULT_ASSISTANT_CONTEXT_MODE,
    ...(source.summary ? { summary: source.summary } : {}),
    ...(source.summaryUpdatedAt ? { summaryUpdatedAt: source.summaryUpdatedAt } : {}),
    ...(source.lastSummarizedMessageId
      ? { lastSummarizedMessageId: source.lastSummarizedMessageId }
      : {}),
    ...(source.contextCutoffMessageId
      ? { contextCutoffMessageId: source.contextCutoffMessageId }
      : {}),
    ...(source.linkedRunManifestIds ? { linkedRunManifestIds: source.linkedRunManifestIds } : {}),
    metadata: {
      ...(source.metadata ?? {}),
      retargetedFromSessionId: source.id,
      retargetedFromScreenId: source.primaryScreenId,
      retargetedAt: now,
    },
    messages: pruneMessages([...source.messages, targetHandoff]),
    createdAt: now,
    updatedAt: now,
  };

  const sessions = normalized.sessions.map((session) => {
    if (session.id === source.id) {
      return {
        ...session,
        linkedScreenIds: uniqueScreenIds([...(session.linkedScreenIds ?? []), targetScreenId]),
        metadata: {
          ...(session.metadata ?? {}),
          retargetedToSessionId: targetSessionId,
          retargetedToScreenId: targetScreenId,
          retargetedAt: now,
        },
        messages: pruneMessages([...session.messages, sourceHandoff]),
        updatedAt: now,
      };
    }
    if (session.primaryScreenId === targetScreenId && session.status === 'active') {
      return { ...session, status: 'archived' as const, archivedAt: now, updatedAt: now };
    }
    return session;
  });

  const next = pruneAssistantState({
    storageVersion: normalized.storageVersion ?? ASSISTANT_STORAGE_VERSION,
    activeSessionByScreenId: {
      ...normalized.activeSessionByScreenId,
      [targetScreenId]: targetSessionId,
    },
    sessions: [...sessions, targetSession],
  });
  const session = next.sessions.find((candidate) => candidate.id === targetSessionId);
  const sourceSession = next.sessions.find((candidate) => candidate.id === source.id);
  return session && sourceSession ? { assistant: next, session, sourceSession } : null;
}

export function deleteAssistantTask(
  assistant: ProjectAssistantState,
  sessionId: string,
): ProjectAssistantState {
  const normalized = normalizeAssistantState(assistant);
  const target = normalized.sessions.find((session) => session.id === sessionId);
  let sessions = normalized.sessions.filter((session) => session.id !== sessionId);
  const activeSessionByScreenId = { ...normalized.activeSessionByScreenId };
  if (target && activeSessionByScreenId[target.primaryScreenId] === sessionId) {
    const fallback = sessions
      .filter((session) => session.primaryScreenId === target.primaryScreenId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (fallback) {
      activeSessionByScreenId[target.primaryScreenId] = fallback.id;
      sessions = sessions.map((session) =>
        session.id === fallback.id ? { ...session, status: 'active' as const } : session,
      );
    } else {
      delete activeSessionByScreenId[target.primaryScreenId];
    }
  }
  return pruneAssistantState({
    storageVersion: normalized.storageVersion ?? ASSISTANT_STORAGE_VERSION,
    activeSessionByScreenId,
    sessions,
  });
}

export function archiveAssistantSessionsForDeletedScreen(
  assistant: ProjectAssistantState | null | undefined,
  screenId: string,
  now = new Date().toISOString(),
): ProjectAssistantState {
  const normalized = normalizeAssistantState(assistant);
  const { [screenId]: _deletedActiveSessionId, ...activeSessionByScreenId } =
    normalized.activeSessionByScreenId ?? {};
  return pruneAssistantState({
    storageVersion: normalized.storageVersion ?? ASSISTANT_STORAGE_VERSION,
    activeSessionByScreenId,
    sessions: normalized.sessions.map((session) =>
      session.primaryScreenId === screenId
        ? {
            ...session,
            status: 'archived' as const,
            archivedAt: session.archivedAt ?? now,
            updatedAt: now,
          }
        : session,
    ),
  });
}

export function replaceAssistantSessionMessages(
  assistant: ProjectAssistantState,
  sessionId: string,
  messages: PersistedAssistantMessage[],
  now = new Date().toISOString(),
): ProjectAssistantState {
  return updateAssistantSession(assistant, sessionId, (session) => ({
    ...session,
    title:
      session.titleSource === 'fallback'
        ? titleFromMessages(messages, session.title)
        : session.title,
    titleSource:
      session.titleSource === 'fallback'
        ? titleSourceFromMessages(messages)
        : (session.titleSource ?? 'fallback'),
    messages: pruneMessages(messages),
    updatedAt: now,
  }));
}

export function updateAssistantSessionRunMetadata(
  assistant: ProjectAssistantState,
  sessionId: string,
  metadata: NonNullable<ProjectAssistantSession['metadata']>,
  now = new Date().toISOString(),
): ProjectAssistantState {
  return updateAssistantSession(assistant, sessionId, (session) => {
    const linkedRunManifestIds = metadata.lastRunManifestPath
      ? Array.from(new Set([...(session.linkedRunManifestIds ?? []), metadata.lastRunManifestPath]))
      : session.linkedRunManifestIds;
    return {
      ...session,
      ...(linkedRunManifestIds ? { linkedRunManifestIds } : {}),
      metadata: {
        ...session.metadata,
        ...metadata,
        ...(metadata.lastRunManifestPath && !metadata.lastContinuationContextPath
          ? {
              lastContinuationContextPath: continuationContextPathFromRunManifest(
                metadata.lastRunManifestPath,
              ),
            }
          : {}),
      },
      updatedAt: now,
    };
  });
}

export function mergeAssistantStateByFreshness(input: {
  local: ProjectAssistantState | null | undefined;
  incoming: ProjectAssistantState | null | undefined;
}): ProjectAssistantState {
  const local = normalizeAssistantState(input.local);
  const incoming = normalizeAssistantState(input.incoming);
  const byId = new Map<string, ProjectAssistantSession>();

  for (const session of incoming.sessions) byId.set(session.id, session);
  for (const session of local.sessions) {
    const current = byId.get(session.id);
    byId.set(session.id, chooseFresherSession(session, current));
  }

  const sessions = Array.from(byId.values());
  const activeSessionByScreenId: Record<string, string> = {
    ...incoming.activeSessionByScreenId,
  };
  const screenIds = new Set([
    ...Object.keys(incoming.activeSessionByScreenId ?? {}),
    ...Object.keys(local.activeSessionByScreenId ?? {}),
  ]);
  for (const screenId of screenIds) {
    const localId = local.activeSessionByScreenId?.[screenId];
    const incomingId = incoming.activeSessionByScreenId?.[screenId];
    if (!localId) continue;
    // The active pointer represents the task the user selected in this tab,
    // not the session whose transcript happened to receive the latest server
    // update. Letting `updatedAt` arbitrate here can reopen an older runtime
    // immediately after New task while an in-flight save/refresh settles.
    if (sessions.some((session) => session.id === localId)) {
      activeSessionByScreenId[screenId] = localId;
    } else if (!incomingId) {
      delete activeSessionByScreenId[screenId];
    }
  }

  const localById = new Map(local.sessions.map((session) => [session.id, session]));
  const sessionsWithStableSelection = sessions.map((session) => {
    const activeId = activeSessionByScreenId[session.primaryScreenId];
    if (!activeId) return session;
    if (session.id === activeId) {
      if (session.status === 'active' && !session.archivedAt) return session;
      const { archivedAt: _archivedAt, ...rest } = session;
      return { ...rest, status: 'active' as const };
    }
    if (session.status !== 'active') return session;
    const localSession = localById.get(session.id);
    return {
      ...session,
      status: 'archived' as const,
      ...(localSession?.archivedAt ? { archivedAt: localSession.archivedAt } : {}),
    };
  });

  return pruneAssistantState({
    storageVersion: Math.max(
      local.storageVersion ?? ASSISTANT_STORAGE_VERSION,
      incoming.storageVersion ?? ASSISTANT_STORAGE_VERSION,
    ),
    activeSessionByScreenId,
    sessions: sessionsWithStableSelection,
  });
}

export function setAssistantSessionContextMode(
  assistant: ProjectAssistantState,
  sessionId: string,
  mode: AssistantContextMode,
  now = new Date().toISOString(),
): ProjectAssistantState {
  return updateAssistantSession(assistant, sessionId, (session) => ({
    ...session,
    contextMode: mode,
    updatedAt: now,
  }));
}

export function setAssistantSessionMode(
  assistant: ProjectAssistantState,
  sessionId: string,
  sessionMode: AssistantSessionMode,
  now = new Date().toISOString(),
): ProjectAssistantState {
  return updateAssistantSession(assistant, sessionId, (session) => ({
    ...session,
    sessionMode,
    updatedAt: now,
  }));
}

function chooseFresherSession(
  a: ProjectAssistantSession | null | undefined,
  b: ProjectAssistantSession | null | undefined,
): ProjectAssistantSession {
  if (!a && !b) throw new Error('chooseFresherSession requires at least one session');
  if (!a) return b!;
  if (!b) return a;
  const time = a.updatedAt.localeCompare(b.updatedAt);
  if (time > 0) return a;
  if (time < 0) return b;
  return a.messages.length >= b.messages.length ? a : b;
}

export function updateAssistantTaskSummary(
  assistant: ProjectAssistantState,
  sessionId: string,
  patch: AssistantTaskSummaryPatch,
  now = new Date().toISOString(),
): ProjectAssistantState {
  return updateAssistantSession(assistant, sessionId, (session) => ({
    ...session,
    ...(patch.title?.trim()
      ? {
          title: patch.title.trim(),
          titleSource: 'llm' as const,
        }
      : {}),
    ...(patch.summary?.trim()
      ? {
          summary: patch.summary.trim(),
          summaryUpdatedAt: now,
        }
      : {}),
    ...(patch.lastSummarizedMessageId
      ? { lastSummarizedMessageId: patch.lastSummarizedMessageId }
      : {}),
    updatedAt: now,
  }));
}

export function buildAgentMessageContext(
  input: BuildAgentMessageContextInput,
): BuildAgentMessageContextResult {
  const mode = input.mode ?? input.session?.contextMode ?? DEFAULT_ASSISTANT_CONTEXT_MODE;
  const maxMessages = input.maxMessages ?? 8;
  if (!input.session) {
    return {
      mode,
      messages: [],
      includedCount: 0,
      excludedReasons: ['no active assistant session'],
    };
  }

  const eligible = input.session.messages.filter((message) => {
    if (message.external) return false;
    if (message.id === 'seed-welcome') return false;
    return message.contextEligible !== false;
  });
  let messages: PersistedAssistantMessage[];
  if (mode === 'clean') {
    messages = input.latestUserMessageId
      ? eligible.filter((message) => message.id === input.latestUserMessageId)
      : eligible.slice(-1);
  } else if (mode === 'full-thread') {
    messages = eligible;
  } else {
    const latestUser = input.latestUserMessageId
      ? eligible.find((message) => message.id === input.latestUserMessageId)
      : eligible.filter((message) => message.role === 'user').at(-1);
    const isContinueContext =
      latestUser?.role === 'user' && isContinueAssistantDirective(latestUser.content);
    messages = eligible.slice(-maxMessages);
    if (
      input.latestUserMessageId &&
      !messages.some((message) => message.id === input.latestUserMessageId)
    ) {
      const latest = eligible.find((message) => message.id === input.latestUserMessageId);
      if (latest) messages = [...messages.slice(1), latest];
    }
    const compactTaskContext = buildCompactTaskContextMessage({
      session: input.session,
      eligible,
      ...(input.latestUserMessageId ? { latestUserMessageId: input.latestUserMessageId } : {}),
    });
    if (compactTaskContext && isContinueContext && latestUser) {
      messages = [compactTaskContext, latestUser];
    } else if (compactTaskContext) {
      messages = [compactTaskContext, ...messages];
    } else if (input.session.summary?.trim()) {
      messages = [buildSummaryContextMessage(input.session), ...messages];
    }
  }

  return {
    mode,
    messages,
    includedCount: messages.length,
    excludedReasons: ['archived sessions are not part of a session context'],
  };
}

function buildSummaryContextMessage(session: ProjectAssistantSession): PersistedAssistantMessage {
  return {
    id: `assistant-summary-${session.id}`,
    role: 'system',
    content: `Active assistant task summary: ${session.summary?.trim()}`,
    createdAt: session.summaryUpdatedAt ?? session.updatedAt,
    contextEligible: false,
  };
}

function buildCompactTaskContextMessage(input: {
  session: ProjectAssistantSession;
  eligible: PersistedAssistantMessage[];
  latestUserMessageId?: string;
}): PersistedAssistantMessage | null {
  const latestUser = input.latestUserMessageId
    ? input.eligible.find((message) => message.id === input.latestUserMessageId)
    : input.eligible.filter((message) => message.role === 'user').at(-1);
  const shouldInclude =
    Boolean(input.session.metadata?.lastRunManifestPath) ||
    Boolean(input.session.metadata?.lastContinuationContextPath) ||
    Boolean(input.session.linkedRunManifestIds?.length) ||
    Boolean(latestUser?.role === 'user' && isContinueAssistantDirective(latestUser.content));
  if (!shouldInclude) return null;

  const sourcePrompt = latestRealUserPrompt(input.eligible);
  const attachmentLines = promptAttachmentLines(input.eligible);
  const runManifestPath =
    input.session.metadata?.lastRunManifestPath ?? input.session.linkedRunManifestIds?.at(-1);
  const continuationContextPath =
    input.session.metadata?.lastContinuationContextPath ??
    (runManifestPath ? continuationContextPathFromRunManifest(runManifestPath) : null);
  const lines = [
    'Compact assistant task context',
    '',
    'Source prompt:',
    sourcePrompt
      ? compactContextText(sourcePrompt.content)
      : '_No non-continue user prompt found._',
    '',
    ...(input.session.summary?.trim() ? ['Task summary:', input.session.summary.trim(), ''] : []),
    'Active target:',
    `- screenId: ${input.session.primaryScreenId}`,
    '',
    ...(runManifestPath || continuationContextPath || input.session.metadata?.lastRunStatus
      ? [
          'Last run:',
          ...(input.session.metadata?.lastRunStatus
            ? [`- status: ${input.session.metadata.lastRunStatus}`]
            : []),
          ...(input.session.metadata?.lastRunSummary
            ? [`- summary: ${input.session.metadata.lastRunSummary}`]
            : []),
          ...(runManifestPath ? [`- runManifest: ${runManifestPath}`] : []),
          ...(continuationContextPath ? [`- continuationContext: ${continuationContextPath}`] : []),
          '',
        ]
      : []),
    ...(attachmentLines.length > 0 ? ['Prompt attachments:', ...attachmentLines, ''] : []),
    'Use this compact context with the visible latest user instruction. Do not restart completed work.',
  ];
  return {
    id: `assistant-compact-context-${input.session.id}`,
    role: 'system',
    content: lines.join('\n'),
    createdAt: input.session.summaryUpdatedAt ?? input.session.updatedAt,
    contextEligible: false,
  };
}

function compactContextText(
  value: string,
  maxLength = COMPACT_CONTEXT_SOURCE_PROMPT_MAX_CHARS,
): string {
  const compacted = value.trim();
  if (compacted.length <= maxLength) return compacted;
  return `${compacted.slice(0, Math.max(0, maxLength - 3))}...`;
}

function latestRealUserPrompt(
  messages: PersistedAssistantMessage[],
): PersistedAssistantMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== 'user') continue;
    if (!message.content.trim() || isContinueAssistantDirective(message.content)) continue;
    return message;
  }
  return null;
}

function promptAttachmentLines(messages: PersistedAssistantMessage[]): string[] {
  const attachments = messages.flatMap((message) => message.attachments ?? []);
  const unique = new Map<string, (typeof attachments)[number]>();
  for (const attachment of attachments) unique.set(attachment.id, attachment);
  return Array.from(unique.values()).map(
    (attachment) =>
      `- ${attachment.name} (${attachment.kind}, ${attachment.mimeType}, ${attachment.size} bytes)`,
  );
}

function retargetHandoffMessage(input: {
  direction: 'from' | 'to';
  now: string;
  source: ProjectAssistantSession;
  targetScreenId: string;
  targetScreenName: string;
  targetSessionId: string;
}): PersistedAssistantMessage {
  const fromLabel = input.source.primaryScreenId;
  const content =
    input.direction === 'from'
      ? `Task continued on ${input.targetScreenName}.`
      : `Continuing task from ${fromLabel}.`;
  return {
    id: `assistant-retarget-${input.direction}-${safeMessageIdPart(input.targetSessionId)}-${safeMessageIdPart(input.now)}`,
    role: 'assistant',
    content,
    createdAt: input.now,
    contextEligible: false,
    metadata: {
      retargetHandoff: {
        direction: input.direction,
        fromSessionId: input.source.id,
        fromScreenId: input.source.primaryScreenId,
        toSessionId: input.targetSessionId,
        toScreenId: input.targetScreenId,
        at: input.now,
      },
    },
  };
}

function uniqueScreenIds(screenIds: string[]): string[] {
  return Array.from(new Set(screenIds.map((screenId) => screenId.trim()).filter(Boolean)));
}

function safeMessageIdPart(value: string): string {
  return value.replace(/[^a-z0-9_-]+/giu, '-').replace(/^-+|-+$/gu, '') || 'item';
}

function isContinueAssistantDirective(content: string): boolean {
  const normalized = content.replace(/\s+/gu, ' ').trim().toLowerCase();
  return (
    normalized === 'continue the previous run.' ||
    normalized === 'continue previous run.' ||
    normalized.includes('continue the previous agent run') ||
    normalized.includes('continue previous agent run')
  );
}

function continuationContextPathFromRunManifest(runManifestPath: string): string {
  return runManifestPath.replace(/run-manifest\.json$/u, 'continuation-context.json');
}

export function pruneAssistantState(
  assistant: ProjectAssistantState,
  maxSessionsPerScreen = MAX_ASSISTANT_SESSIONS_PER_SCREEN,
): ProjectAssistantState {
  const sessionsByScreen = new Map<string, ProjectAssistantSession[]>();
  for (const session of assistant.sessions) {
    const sessions = sessionsByScreen.get(session.primaryScreenId) ?? [];
    sessions.push({ ...session, messages: pruneMessages(session.messages) });
    sessionsByScreen.set(session.primaryScreenId, sessions);
  }

  const sessions: ProjectAssistantSession[] = [];
  for (const group of sessionsByScreen.values()) {
    sessions.push(
      ...group
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, maxSessionsPerScreen)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    );
  }
  const sessionIds = new Set(sessions.map((session) => session.id));
  const activeSessionByScreenId = Object.fromEntries(
    Object.entries(assistant.activeSessionByScreenId ?? {}).filter(([, sessionId]) =>
      sessionIds.has(sessionId),
    ),
  );
  return {
    storageVersion: assistant.storageVersion ?? ASSISTANT_STORAGE_VERSION,
    activeSessionByScreenId,
    sessions,
  };
}

function updateAssistantSession(
  assistant: ProjectAssistantState,
  sessionId: string,
  update: (session: ProjectAssistantSession) => ProjectAssistantSession,
): ProjectAssistantState {
  return pruneAssistantState({
    ...assistant,
    sessions: assistant.sessions.map((session) =>
      session.id === sessionId ? update(session) : session,
    ),
  });
}

function pruneMessages(messages: PersistedAssistantMessage[]): PersistedAssistantMessage[] {
  return messages.slice(-MAX_ASSISTANT_MESSAGES_PER_SESSION);
}
