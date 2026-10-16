/**
 * Assistant history recovery and merge (0136 R12 — extracted from
 * project-store.ts).
 *
 * Two jobs that both reason about assistant state rather than about the
 * project file:
 *
 *   - merging the assistant section on save, so a stale editor payload
 *     cannot drop turns another writer already recorded;
 *   - rebuilding a session's transcript from the run records on disk when
 *     the `.sdproj` copy is missing or behind.
 *
 * Reads run artifacts; never writes them.
 */
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { normalizeAssistantSessionMode } from '@sber-designer/shared-types';
import type {
  PersistedAssistantMessage,
  PersistedAssistantToolCall,
  ProjectAssistantSession,
  ProjectAssistantState,
  SberDesignerProject,
} from '@sber-designer/shared-types';
import { resolveInside } from '@sber-designer/ast-bridge';

/** One run transcript that could back-fill a session. */
interface RunTranscriptCandidate {
  manifestPath: string;
  transcriptPath: string;
  activeScreenId: string | null;
  activeScreenStoryId: string | null;
  activeScreenFilePath: string | null;
  activeScreenImplementationFilePath: string | null;
  sortTime: number;
}

export function mergeProjectAssistantForSave(
  current: SberDesignerProject,
  next: SberDesignerProject,
): SberDesignerProject {
  if (!sameWorkspace(current.workspacePath, next.workspacePath)) return next;
  if (!current.assistant && !next.assistant) return next;
  return {
    ...next,
    assistant: mergeAssistantStateByFreshness({
      local: current.assistant,
      incoming: next.assistant,
    }),
  };
}

function sameWorkspace(left: string, right: string): boolean {
  const cleanLeft = left.trim();
  const cleanRight = right.trim();
  if (!cleanLeft || !cleanRight) return false;
  return resolve(cleanLeft) === resolve(cleanRight);
}

function mergeAssistantStateByFreshness(input: {
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
    const incomingId = incoming.activeSessionByScreenId?.[screenId];
    const localId = local.activeSessionByScreenId?.[screenId];
    // `incoming` is the editor snapshot being saved. Its active pointer is a
    // deliberate user selection and must not be replaced by an older task
    // merely because that task received a later server metadata update.
    if (incomingId && sessions.some((session) => session.id === incomingId)) {
      activeSessionByScreenId[screenId] = incomingId;
    } else if (localId && sessions.some((session) => session.id === localId)) {
      activeSessionByScreenId[screenId] = localId;
    } else {
      delete activeSessionByScreenId[screenId];
    }
  }

  const incomingById = new Map(incoming.sessions.map((session) => [session.id, session]));
  const sessionsWithStableSelection = sessions.map((session) => {
    const activeId = activeSessionByScreenId[session.primaryScreenId];
    if (!activeId) return session;
    if (session.id === activeId) {
      if (session.status === 'active' && !session.archivedAt) return session;
      const { archivedAt: _archivedAt, ...rest } = session;
      return { ...rest, status: 'active' as const };
    }
    if (session.status !== 'active') return session;
    const incomingSession = incomingById.get(session.id);
    return {
      ...session,
      status: 'archived' as const,
      ...(incomingSession?.archivedAt ? { archivedAt: incomingSession.archivedAt } : {}),
    };
  });

  return {
    storageVersion: Math.max(local.storageVersion ?? 1, incoming.storageVersion ?? 1),
    activeSessionByScreenId,
    sessions: sessionsWithStableSelection,
  };
}

function normalizeAssistantState(
  assistant: ProjectAssistantState | null | undefined,
): ProjectAssistantState {
  return {
    storageVersion: assistant?.storageVersion ?? 1,
    activeSessionByScreenId: { ...assistant?.activeSessionByScreenId },
    sessions: (assistant?.sessions ?? []).map((session) => ({
      ...session,
      sessionMode: normalizeAssistantSessionMode(session.sessionMode),
    })),
  };
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

export async function recoverProjectAssistantFromRunTranscripts(
  project: SberDesignerProject,
): Promise<SberDesignerProject> {
  if (!project.workspacePath || !project.assistant?.sessions.length) return project;
  let changed = false;
  let matchingRunCandidates: RunTranscriptCandidate[] | null = null;
  const sessions = await Promise.all(
    project.assistant.sessions.map(async (session) => {
      let recovered = await recoverAssistantSessionFromRunTranscript(
        project.workspacePath,
        session,
      );
      if (recovered === session && shouldRecoverFromMatchingRunTranscripts(session)) {
        matchingRunCandidates ??= await readRunTranscriptCandidates(project.workspacePath);
        recovered = await recoverAssistantSessionFromMatchingRunTranscripts(
          project,
          session,
          matchingRunCandidates,
        );
      }
      if (recovered !== session) changed = true;
      return recovered;
    }),
  );
  if (!changed) return project;
  return {
    ...project,
    assistant: {
      ...project.assistant,
      sessions,
    },
  };
}

function shouldRecoverFromMatchingRunTranscripts(session: ProjectAssistantSession): boolean {
  if (sessionRunManifestPath(session)) return false;
  if (session.messages.some((message) => message.role === 'assistant' || message.role === 'tool')) {
    return false;
  }
  return session.messages.length <= 1;
}

async function recoverAssistantSessionFromRunTranscript(
  workspacePath: string,
  session: ProjectAssistantSession,
): Promise<ProjectAssistantSession> {
  const runManifestPath = sessionRunManifestPath(session);
  if (!runManifestPath) return session;
  const transcriptPath = transcriptPathFromRunManifestPath(workspacePath, runManifestPath);
  if (!transcriptPath) return session;
  const transcript = await readRunTranscriptMessages(transcriptPath, session, runManifestPath);
  const recoveredTurn = recoveredTranscriptTurn(session.messages, transcript, runManifestPath);
  if (!recoveredTurn.some((message) => message.role === 'assistant' || message.role === 'tool')) {
    return session;
  }
  return {
    ...session,
    messages: [...session.messages, ...recoveredTurn],
    linkedRunManifestIds: Array.from(
      new Set([...(session.linkedRunManifestIds ?? []), runManifestPath]),
    ),
    metadata: {
      ...session.metadata,
      lastRunManifestPath: session.metadata?.lastRunManifestPath ?? runManifestPath,
    },
  };
}

function recoveredTranscriptTurn(
  existing: PersistedAssistantMessage[],
  transcript: PersistedAssistantMessage[],
  runManifestPath: string,
): PersistedAssistantMessage[] {
  const latestUserIndex = findLatestUserIndex(existing);
  const latestUser = latestUserIndex >= 0 ? existing[latestUserIndex] : null;
  if (!latestUser) return transcript;
  const existingTurn = existing.slice(latestUserIndex + 1);
  if (hasPersistedFinalReply(existingTurn, runManifestPath)) return [];
  let boundary = -1;
  for (let index = 0; index < transcript.length; index += 1) {
    const message = transcript[index];
    if (message?.role === 'user' && message.content.trim() === latestUser.content.trim()) {
      boundary = index;
    }
  }
  const transcriptTurn = boundary < 0 ? transcript : transcript.slice(boundary + 1);
  let matchedPrefix = 0;
  for (const message of existingTurn) {
    if (sameRecoveredMessage(message, transcriptTurn[matchedPrefix])) {
      matchedPrefix += 1;
      if (matchedPrefix === transcriptTurn.length) break;
    }
  }
  return transcriptTurn.slice(matchedPrefix);
}

function hasPersistedFinalReply(
  messages: PersistedAssistantMessage[],
  runManifestPath: string,
): boolean {
  return messages.some(
    (message) =>
      message.role === 'assistant' &&
      message.runManifestId === runManifestPath &&
      message.contextEligible !== false &&
      (!message.toolCalls?.length || Boolean(message.tokenUsage)),
  );
}

function sameRecoveredMessage(
  existing: PersistedAssistantMessage,
  recovered: PersistedAssistantMessage | undefined,
): boolean {
  return Boolean(
    recovered &&
    existing.role === recovered.role &&
    existing.content.trim() === recovered.content.trim() &&
    existing.toolCallId === recovered.toolCallId,
  );
}

function findLatestUserIndex(messages: PersistedAssistantMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') return index;
  }
  return -1;
}

async function recoverAssistantSessionFromMatchingRunTranscripts(
  project: SberDesignerProject,
  session: ProjectAssistantSession,
  candidates: RunTranscriptCandidate[],
): Promise<ProjectAssistantSession> {
  const screen = project.screens.find((candidate) => candidate.id === session.primaryScreenId);
  const sessionCreatedAt = Date.parse(session.createdAt);
  const matchingCandidates = candidates
    .filter((candidate) => candidateMatchesSession(candidate, session, screen))
    .filter((candidate) => {
      if (!Number.isFinite(sessionCreatedAt) || candidate.sortTime <= 0) return true;
      return candidate.sortTime >= sessionCreatedAt - 5 * 60 * 1000;
    })
    .sort((left, right) => left.sortTime - right.sortTime);
  if (matchingCandidates.length === 0) return session;

  const messages: PersistedAssistantMessage[] = [];
  const linkedRunManifestIds: string[] = [];
  let latestRun: RunTranscriptCandidate | null = null;

  for (const candidate of matchingCandidates) {
    const createdAt =
      candidate.sortTime > 0 ? new Date(candidate.sortTime).toISOString() : undefined;
    const transcript = await readRunTranscriptMessages(
      candidate.transcriptPath,
      messages.length === 0 ? session : { ...session, messages: [] },
      candidate.manifestPath,
      createdAt ? { createdAt } : {},
    );
    if (!transcript.some((message) => message.role === 'assistant' || message.role === 'tool')) {
      continue;
    }
    for (const message of transcript) pushRecoveredMessage(messages, message);
    linkedRunManifestIds.push(candidate.manifestPath);
    latestRun = candidate;
  }

  if (messages.length <= session.messages.length) return session;
  if (!messages.some((message) => message.role === 'assistant' || message.role === 'tool')) {
    return session;
  }

  return {
    ...session,
    messages,
    linkedRunManifestIds: Array.from(
      new Set([...(session.linkedRunManifestIds ?? []), ...linkedRunManifestIds]),
    ),
    metadata: {
      ...session.metadata,
      ...(latestRun
        ? {
            lastRunManifestPath: latestRun.manifestPath,
          }
        : {}),
    },
    updatedAt:
      latestRun && latestRun.sortTime > 0
        ? new Date(Math.max(Date.parse(session.updatedAt) || 0, latestRun.sortTime)).toISOString()
        : session.updatedAt,
  };
}

function candidateMatchesSession(
  candidate: RunTranscriptCandidate,
  session: ProjectAssistantSession,
  screen: SberDesignerProject['screens'][number] | undefined,
): boolean {
  if (candidate.activeScreenId && candidate.activeScreenId === session.primaryScreenId) {
    return true;
  }
  if (screen?.storyId && candidate.activeScreenStoryId === screen.storyId) return true;
  if (screen?.filePath && candidate.activeScreenFilePath === screen.filePath) return true;
  if (
    screen?.implementationFilePath &&
    candidate.activeScreenImplementationFilePath === screen.implementationFilePath
  ) {
    return true;
  }
  return false;
}

function pushRecoveredMessage(
  messages: PersistedAssistantMessage[],
  message: PersistedAssistantMessage,
): void {
  const previous = messages[messages.length - 1];
  if (previous?.role === 'user' && message.role === 'user') {
    if (previous.content.trim() === message.content.trim()) return;
  }
  if (
    message.runManifestId &&
    messages.some(
      (existing) =>
        existing.runManifestId === message.runManifestId &&
        existing.role === message.role &&
        existing.content === message.content &&
        existing.toolCallId === message.toolCallId,
    )
  ) {
    return;
  }
  messages.push(message);
}

function sessionRunManifestPath(session: ProjectAssistantSession): string | null {
  return (
    session.metadata?.lastRunManifestPath ??
    session.linkedRunManifestIds?.[session.linkedRunManifestIds.length - 1] ??
    [...session.messages].reverse().find((message) => message.runManifestId)?.runManifestId ??
    null
  );
}

function transcriptPathFromRunManifestPath(
  workspacePath: string,
  runManifestPath: string,
): string | null {
  const normalized = runManifestPath.replace(/\\/gu, '/');
  if (!normalized.startsWith('.sber-designer/runs/')) return null;
  if (!normalized.endsWith('/run-manifest.json')) return null;
  return resolveInside(
    workspacePath,
    normalized.replace(/\/run-manifest\.json$/u, '/transcript.jsonl'),
  );
}

async function readRunTranscriptMessages(
  path: string,
  session: ProjectAssistantSession,
  runManifestPath: string,
  options: { createdAt?: string } = {},
): Promise<PersistedAssistantMessage[]> {
  const raw = await readFile(path, 'utf8').catch(() => '');
  const messages: PersistedAssistantMessage[] = [];
  for (const line of raw
    .split('\n')
    .map((candidate) => candidate.trim())
    .filter(Boolean)) {
    const parsed = parseRunTranscriptLine(line);
    if (!parsed || parsed.role === 'system') continue;
    const existing = session.messages[messages.length];
    const content = normalizeRunTranscriptContent(parsed.role, parsed.content);
    const message: PersistedAssistantMessage = {
      id:
        existing?.role === parsed.role
          ? existing.id
          : `run-transcript-${parsed.runId}-${messages.length}`,
      role: parsed.role,
      content,
      createdAt: existing?.createdAt ?? options.createdAt ?? session.updatedAt,
      ...(parsed.toolCalls ? { toolCalls: parsed.toolCalls } : {}),
      ...(parsed.toolCallId ? { toolCallId: parsed.toolCallId } : {}),
      ...(parsed.role === 'assistant' || parsed.role === 'tool'
        ? { runManifestId: runManifestPath }
        : {}),
      ...(parsed.role === 'tool' ? { contextEligible: false } : {}),
    };
    if (
      existing?.role === 'user' &&
      message.role === 'user' &&
      existing.content.trim() === message.content.trim()
    ) {
      messages.push({ ...existing, content: message.content });
    } else {
      messages.push(message);
    }
  }
  return messages;
}

async function readRunTranscriptCandidates(
  workspacePath: string,
): Promise<RunTranscriptCandidate[]> {
  const runsRoot = resolveInside(workspacePath, '.sber-designer/runs');
  if (!runsRoot) return [];
  const entries = await readdir(runsRoot, { withFileTypes: true }).catch(() => []);
  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => readRunTranscriptCandidate(workspacePath, entry.name)),
  );
  return candidates.filter((candidate): candidate is RunTranscriptCandidate => Boolean(candidate));
}

async function readRunTranscriptCandidate(
  workspacePath: string,
  runDirectoryName: string,
): Promise<RunTranscriptCandidate | null> {
  if (!runDirectoryName || runDirectoryName.includes('/')) return null;
  const manifestPath = `.sber-designer/runs/${runDirectoryName}/run-manifest.json`;
  const transcriptRelativePath = `.sber-designer/runs/${runDirectoryName}/transcript.jsonl`;
  const manifestAbsolutePath = resolveInside(workspacePath, manifestPath);
  const transcriptPath = resolveInside(workspacePath, transcriptRelativePath);
  if (!manifestAbsolutePath || !transcriptPath) return null;
  const raw = await readFile(manifestAbsolutePath, 'utf8').catch(() => '');
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const activeScreen = isRecord(parsed.activeScreen) ? parsed.activeScreen : null;
  return {
    manifestPath,
    transcriptPath,
    activeScreenId: stringOrNull(activeScreen?.id),
    activeScreenStoryId: stringOrNull(activeScreen?.storyId),
    activeScreenFilePath: stringOrNull(activeScreen?.filePath),
    activeScreenImplementationFilePath: stringOrNull(activeScreen?.implementationFilePath),
    sortTime: firstFiniteNumber(parsed.completedAt, parsed.updatedAt, parsed.createdAt),
  };
}

function parseRunTranscriptLine(line: string): {
  runId: string;
  role: PersistedAssistantMessage['role'];
  content: string;
  toolCalls?: PersistedAssistantToolCall[];
  toolCallId?: string;
} | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const entry = parsed as {
    runId?: unknown;
    role?: unknown;
    content?: unknown;
    toolCalls?: unknown;
    toolCallId?: unknown;
  };
  if (typeof entry.runId !== 'string' || typeof entry.content !== 'string') return null;
  if (
    entry.role !== 'system' &&
    entry.role !== 'user' &&
    entry.role !== 'assistant' &&
    entry.role !== 'tool'
  ) {
    return null;
  }
  return {
    runId: entry.runId,
    role: entry.role,
    content: entry.content,
    ...(isPersistedToolCalls(entry.toolCalls) ? { toolCalls: entry.toolCalls } : {}),
    ...(typeof entry.toolCallId === 'string' ? { toolCallId: entry.toolCallId } : {}),
  };
}

function normalizeRunTranscriptContent(
  role: PersistedAssistantMessage['role'],
  content: string,
): string {
  if (role !== 'user') return content;
  return extractExternalRuntimeUserRequest(content) ?? content;
}

function extractExternalRuntimeUserRequest(content: string): string | null {
  const normalized = content.replace(/\r\n/gu, '\n');
  const match = normalized.match(/(?:^|\n)## User Request\n\n([\s\S]*?)(?:\n\n---(?:\n|$)|$)/u);
  if (!match?.[1]) return null;
  const request = match[1].replace(/\n\nAttached [^\n]* files:[\s\S]*$/u, '').trim();
  return request.length > 0 ? request : null;
}

function isPersistedToolCalls(value: unknown): value is PersistedAssistantToolCall[] {
  return (
    Array.isArray(value) &&
    value.every(
      (call) =>
        call &&
        typeof call === 'object' &&
        typeof (call as { id?: unknown }).id === 'string' &&
        typeof (call as { name?: unknown }).name === 'string' &&
        typeof (call as { arguments?: unknown }).arguments === 'string',
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function firstFiniteNumber(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
}
