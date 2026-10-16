/**
 * Pure chat transcript/format helpers: server transcript merge and
 * normalization, run info extraction, canvas-url selection, send-error
 * formatting. No React, no stores at call time beyond pure reads.
 */
import type {
  ChatMessage as GatewayChatMessage,
  ChatContentPart,
} from '@sber-designer/llm-gateway';
import {
  normalizeAssistantTokenUsage,
  type AssistantTokenUsage,
  type ComponentPackRunSummary,
  type RunQualitySummary,
} from '@sber-designer/shared-types';
import { ApiError, type AgentStreamEvent } from '@/lib/api-client';
import { type ChatMessage } from '@/stores/chat-store';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';

export function selectChatCanvasUrl(
  activeScreenUrl: string | null | undefined,
  fallbackCanvasUrl: string | null | undefined,
  sandboxPreviewUrl?: string | null | undefined,
): string | null {
  const sandbox = sandboxPreviewUrl?.trim();
  if (sandbox) return sandbox;
  const active = activeScreenUrl?.trim();
  if (active && !isPreviewProxyUrl(active)) return active;
  return fallbackCanvasUrl?.trim() || null;
}

function isPreviewProxyUrl(value: string): boolean {
  try {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost';
    const path = new URL(value, origin).pathname.replace(/\/+$/u, '');
    return path === '/api/preview' || path.startsWith('/api/preview/');
  } catch {
    return value.startsWith('/api/preview');
  }
}

export function activeScreenChangedByToolResult(changedFiles: string[] | undefined): boolean {
  const editor = useEditorStore.getState();
  return screenChangedByToolResult(editor.activeScreenId, changedFiles);
}

export function screenChangedByToolResult(
  screenId: string | null | undefined,
  changedFiles: string[] | undefined,
): boolean {
  if (!screenId || !changedFiles?.length) return false;
  const project = useProjectStore.getState().project;
  const screen = project?.screens.find((candidate) => candidate.id === screenId);
  if (!screen) return false;
  const targets = new Set(
    [screen.implementationFilePath, screen.filePath]
      .filter((path): path is string => Boolean(path))
      .map(normalizeWorkspacePathForChat),
  );
  return changedFiles.map(normalizeWorkspacePathForChat).some((path) => targets.has(path));
}

function normalizeWorkspacePathForChat(path: string): string {
  return path.replace(/\\/gu, '/').replace(/^\.\//u, '');
}

export function toolTimingMessageMetadata(
  ev: Extract<AgentStreamEvent, { type: 'tool-result' }>,
): { metadata: { toolTiming: Record<string, number> } } | Record<string, never> {
  const toolTiming: Record<string, number> = {};
  if (typeof ev.permissionWaitMs === 'number') toolTiming.permissionWaitMs = ev.permissionWaitMs;
  if (typeof ev.handlerDurationMs === 'number') toolTiming.handlerDurationMs = ev.handlerDurationMs;
  if (typeof ev.totalDurationMs === 'number') toolTiming.totalDurationMs = ev.totalDurationMs;
  return Object.keys(toolTiming).length > 0 ? { metadata: { toolTiming } } : {};
}

export function mergeDoneTranscriptMessages(input: {
  snapshot: ChatMessage[];
  turnMessages: ChatMessage[];
  transcript: GatewayChatMessage[];
  meta?: ChatMessage['meta'] | null | undefined;
}): ChatMessage[] {
  const base = input.snapshot.filter((m) => !m.external).map((m) => ({ ...m }));
  const fromServer = normalizeServerTranscript(input.transcript, input.meta ?? null);
  const currentServerTurn = serverTranscriptFromLatestUser(base, fromServer);
  const turn =
    currentServerTurn.length > 0 ? currentServerTurn : input.turnMessages.map((m) => ({ ...m }));
  const withoutDuplicateUser = dropDuplicateLeadingUser(base, turn);
  return [...base, ...withoutDuplicateUser].filter((m) => !m.external);
}

/** Attach aggregate run usage to the final assistant reply after the latest user prompt. */
export function attachRunTokenUsage(
  messages: ChatMessage[],
  usage: AssistantTokenUsage | null | undefined,
): ChatMessage[] {
  if (!usage) return messages;
  const tokenUsage = normalizeAssistantTokenUsage(usage) ?? {};
  let lastUserIndex = -1;
  let targetIndex = -1;
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message?.role === 'user') {
      lastUserIndex = index;
      targetIndex = -1;
    } else if (
      index > lastUserIndex &&
      message?.role === 'assistant' &&
      message.contextEligible !== false
    ) {
      targetIndex = index;
    }
  }
  if (targetIndex < 0) return messages;
  return messages.map((message, index) =>
    index === targetIndex ? { ...message, tokenUsage } : message,
  );
}

function normalizeServerTranscript(
  transcript: GatewayChatMessage[],
  meta: ChatMessage['meta'] | null,
): ChatMessage[] {
  return transcript
    .filter(
      (message) =>
        message.role === 'assistant' || message.role === 'tool' || message.role === 'user',
    )
    .filter((message) => !(message.role === 'user' && isInternalAutoUserMessage(message.content)))
    .map((message, index) => {
      const content =
        typeof message.content === 'string' ? message.content : partsToText(message.content);
      const chatMessage: ChatMessage = {
        id: `server-transcript-${Date.now()}-${index}`,
        role: message.role,
        content,
        createdAt: new Date().toISOString(),
        ...(message.role === 'assistant' && meta ? { meta } : {}),
        ...(message.role === 'assistant' && message.toolCalls
          ? { toolCalls: message.toolCalls }
          : {}),
        ...(message.role === 'tool' && message.toolCallId
          ? { toolCallId: message.toolCallId }
          : {}),
        ...(message.role === 'tool' ? { contextEligible: false } : {}),
      };
      return chatMessage;
    });
}

function isInternalAutoUserMessage(content: GatewayChatMessage['content']): boolean {
  const text = typeof content === 'string' ? content : partsToText(content);
  const trimmed = text.trim();
  return (
    trimmed.startsWith('[sber-designer · auto]') ||
    trimmed.startsWith('# sber-designer bounded craft repair') ||
    trimmed.includes('# sber-designer External Runtime Handoff')
  );
}

function partsToText(content: GatewayChatMessage['content']): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      const candidate = part as ChatContentPart;
      return candidate.type === 'text' ? candidate.text : '';
    })
    .filter(Boolean)
    .join('\n');
}

function dropDuplicateLeadingUser(base: ChatMessage[], turn: ChatMessage[]): ChatMessage[] {
  const first = turn[0];
  const latestBaseUser = latestUserMessage(base);
  if (
    first?.role === 'user' &&
    latestBaseUser &&
    first.content.trim() === latestBaseUser.content.trim()
  ) {
    return turn.slice(1);
  }
  return turn;
}

function serverTranscriptFromLatestUser(
  base: ChatMessage[],
  transcript: ChatMessage[],
): ChatMessage[] {
  const latestBaseUser = latestUserMessage(base);
  if (!latestBaseUser) return transcript;
  let boundary = -1;
  for (let index = 0; index < transcript.length; index += 1) {
    const message = transcript[index];
    if (message?.role === 'user' && message.content.trim() === latestBaseUser.content.trim()) {
      boundary = index;
    }
  }
  return boundary >= 0 ? transcript.slice(boundary) : transcript;
}

function latestUserMessage(messages: ChatMessage[]): ChatMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'user') return message;
  }
  return null;
}

type DoneAgentStreamEvent = Extract<AgentStreamEvent, { type: 'done' }> & {
  runStatus?: 'complete' | 'failed' | 'needs_review' | 'cancelled';
  runSummary?: string;
};

export function doneEventRunInfo(ev: DoneAgentStreamEvent) {
  const runFailed =
    ev.runStatus === 'failed' ||
    (ev.runStatus === undefined &&
      (ev.truncated ||
        Boolean(ev.hadErrors) ||
        Boolean(ev.stoppedAfterPermissionDeny) ||
        ev.finalResponse.finishReason === 'tool_calls' ||
        ev.finalResponse.finishReason === 'other'));
  const runStatus = ev.runStatus ?? (runFailed ? 'failed' : 'complete');
  const runSummary =
    ev.runSummary ??
    (runFailed ? extractRunSummaryFromFinalText(ev.finalResponse.text) : undefined);
  const runMetrics = runMetricsFromDoneEvent(ev);
  return {
    iterations: ev.iterations,
    truncated: ev.truncated,
    runStatus,
    ...(ev.attemptId ? { attemptId: ev.attemptId } : {}),
    ...(ev.debugLogPath ? { debugLogPath: ev.debugLogPath } : {}),
    ...(ev.runManifestPath ? { runManifestPath: ev.runManifestPath } : {}),
    ...(runSummary ? { runSummary } : {}),
    ...(ev.componentReuse ? { componentReuse: ev.componentReuse } : {}),
    ...(ev.renderProof ? { renderProof: ev.renderProof } : {}),
    ...(ev.runtimeSession ? { runtimeSession: ev.runtimeSession } : {}),
    ...(runMetrics ? { runMetrics } : {}),
  };
}

function runMetricsFromDoneEvent(ev: DoneAgentStreamEvent) {
  const usage:
    | {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        costUsd?: number;
      }
    | undefined = ev.usage ?? ev.finalResponse.usage;
  if (!usage) return null;
  const tokenUsage = normalizeAssistantTokenUsage(usage);
  return {
    iterations: ev.iterations,
    ...tokenUsage,
    ...(usage.costUsd !== undefined ? { costUsd: usage.costUsd } : {}),
  };
}

function extractRunSummaryFromFinalText(text: string): string | undefined {
  const marker = 'sber-designer:';
  const markerIndex = text.lastIndexOf(marker);
  const summaryText = markerIndex >= 0 ? text.slice(markerIndex) : text;
  const firstLine = summaryText
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine || undefined;
}

export function formatComponentPackStatus(componentPack: ComponentPackRunSummary) {
  const selected = componentPack.selectedCount ?? componentPack.candidateCount;
  return `Project DS: ${displayCount(componentPack.indexedCount)} indexed · ${displayCount(componentPack.describedCount)} described · ${selected} selected · ${displayCount(componentPack.hydratedCount)} hydrated`;
}

export function componentPackSummaryFromMetadata(
  metadata: Record<string, unknown> | undefined,
): ComponentPackRunSummary | null {
  const value = metadata?.componentPack;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const summary = value as Partial<ComponentPackRunSummary>;
  if (
    !['ready', 'weak', 'missing'].includes(summary.status ?? '') ||
    typeof summary.candidateCount !== 'number' ||
    typeof summary.diagnosticCount !== 'number'
  ) {
    return null;
  }
  return summary as ComponentPackRunSummary;
}

export function latestComponentPackSummary(
  messages: ChatMessage[],
): ComponentPackRunSummary | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const summary = componentPackSummaryFromMetadata(messages[index]?.metadata);
    if (summary) return summary;
  }
  return null;
}

export function qualitySummaryFromMetadata(
  metadata: Record<string, unknown> | undefined,
): RunQualitySummary | null {
  const value = metadata?.qualitySummary;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const summary = value as Partial<RunQualitySummary>;
  if (
    summary.version !== 1 ||
    !['complete', 'needs_review', 'failed', 'cancelled'].includes(summary.terminalStatus ?? '') ||
    !summary.repair ||
    !summary.remainingFindings
  ) {
    return null;
  }
  return summary as RunQualitySummary;
}

export function upsertQualitySummaryMessage(
  messages: ChatMessage[],
  qualitySummary: RunQualitySummary,
  now = new Date().toISOString(),
): ChatMessage[] {
  let lastUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      lastUserIndex = index;
      break;
    }
  }
  const existingIndex = messages.findIndex(
    (message, index) =>
      index > lastUserIndex && Boolean(qualitySummaryFromMetadata(message.metadata)),
  );
  const summaryMessage: ChatMessage = {
    id:
      existingIndex >= 0
        ? messages[existingIndex]!.id
        : `quality-summary-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: 'assistant',
    content: 'Final quality summary',
    createdAt: existingIndex >= 0 ? (messages[existingIndex]?.createdAt ?? now) : now,
    contextEligible: false,
    metadata: { qualitySummary },
  };
  if (existingIndex >= 0) {
    return messages.map((message, index) => (index === existingIndex ? summaryMessage : message));
  }
  return [...messages, summaryMessage];
}

export function upsertComponentPackStatusMessage(
  messages: ChatMessage[],
  componentPack: ComponentPackRunSummary,
  now = new Date().toISOString(),
): ChatMessage[] {
  let lastUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      lastUserIndex = index;
      break;
    }
  }
  const existingIndex = messages.findIndex(
    (message, index) =>
      index > lastUserIndex && Boolean(componentPackSummaryFromMetadata(message.metadata)),
  );
  const statusMessage: ChatMessage = {
    id:
      existingIndex >= 0
        ? messages[existingIndex]!.id
        : `component-pack-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: 'assistant',
    content: formatComponentPackStatus(componentPack),
    createdAt: existingIndex >= 0 ? (messages[existingIndex]?.createdAt ?? now) : now,
    contextEligible: false,
    metadata: { componentPack },
  };
  if (existingIndex >= 0) {
    return messages.map((message, index) => (index === existingIndex ? statusMessage : message));
  }
  return [
    ...messages.slice(0, lastUserIndex + 1),
    statusMessage,
    ...messages.slice(lastUserIndex + 1),
  ];
}

function displayCount(value: number | undefined): string {
  return typeof value === 'number' ? String(value) : '—';
}

export function formatChatSendError(err: unknown): string {
  if (err instanceof ApiError) {
    const parts = [`${err.code ?? 'error'}: ${err.message}`];
    if (err.debugLogPath) parts.push(`Debug log: ${err.debugLogPath}`);
    if (err.runManifestPath) parts.push(`Run: ${err.runManifestPath}`);
    return parts.join(' ');
  }
  return err instanceof Error ? err.message : String(err);
}

export function failedSendRunInfo(message: string, err: ApiError) {
  return {
    iterations: 0,
    truncated: false,
    runStatus: 'preflight_rejected' as const,
    runSummary: message,
    ...(err.code ? { runErrorCode: err.code } : {}),
    ...(err.blockingRun ? { blockingRun: err.blockingRun } : {}),
    ...(err.attemptId ? { attemptId: err.attemptId } : {}),
    ...(err.debugLogPath ? { debugLogPath: err.debugLogPath } : {}),
    ...(err.runManifestPath ? { runManifestPath: err.runManifestPath } : {}),
  };
}

export function contentToDisplayText(content: GatewayChatMessage['content']): string {
  if (typeof content === 'string') return content;
  return content
    .map((part) => {
      if (part.type === 'text') return part.text;
      return '[Attached image]';
    })
    .join('\n');
}
