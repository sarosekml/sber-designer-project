/**
 * Shapes the editor chat store works with (0136 R12 — extracted from
 * chat-store.ts).
 *
 * Types only: no zustand, no behaviour. Components and the store's own
 * helpers import from here, so adding a field to a message or a session is a
 * change to one file rather than a scroll through the store.
 */
import type { ChatRole, ToolCall } from '@sber-designer/llm-gateway';
import type {
  AssistantActiveRun,
  AssistantContextMode,
  AssistantRunMetrics,
  AssistantSessionMode,
  AssistantTokenUsage,
  ComponentReuseRunSummary,
  ProjectAssistantSession,
  ProjectAssistantState,
  SberDesignerProject,
} from '@sber-designer/shared-types';

import type {
  AgentPermissionRequest,
  AgentRunRenderProof,
  AgentRuntimeSessionInfo,
} from '@/lib/api-client';

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'text';
  dataUrl?: string;
  sourceUrl?: string;
  text?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt?: string;
  attachments?: ChatAttachment[];
  /** Set on assistant messages where the model asked for tools. */
  toolCalls?: ToolCall[];
  /** Set on role:'tool' messages — links the result back to the assistant turn. */
  toolCallId?: string;
  /** Provider/model that produced an assistant message. */
  meta?: { provider?: string; model?: string; sessionMode?: AssistantSessionMode };
  /** Workspace-relative manifest path for the agent run that produced this message. */
  runManifestId?: string;
  /** Token counters for this completed assistant turn only. */
  tokenUsage?: AssistantTokenUsage;
  /** True when this message came from outside the /api/chat agent loop
   *  (currently: WS bridge events from external Claude Code). */
  external?: boolean;
  /** False for operational noise that should stay visible but not enter context. */
  contextEligible?: boolean;
  /** Structured UI-only metadata for operational status rows and receipts. */
  metadata?: Record<string, unknown>;
}

export interface ChatContextSummary {
  mode: AssistantContextMode;
  includedCount: number;
}

export interface ChatProjectIdentity {
  name: string;
  workspacePath: string | null;
}

export interface ReplaceTurnInfo {
  iterations: number;
  truncated: boolean;
  debugLogPath?: string;
  runManifestPath?: string;
  attemptId?: string;
  runStatus?:
    | 'running'
    | 'complete'
    | 'failed'
    | 'needs_review'
    | 'cancelled'
    | 'preflight_rejected';
  runSummary?: string;
  runErrorCode?: string;
  blockingRun?: AssistantActiveRun;
  componentReuse?: ComponentReuseRunSummary;
  renderProof?: AgentRunRenderProof;
  runMetrics?: AssistantRunMetrics;
  runtimeSession?: AgentRuntimeSessionInfo;
}

export interface ChatStoreState {
  messages: ChatMessage[];
  assistant: ProjectAssistantState;
  projectIdentity: ChatProjectIdentity | null;
  activeScreenId: string | null;
  activeSessionId: string | null;
  lastContextSummary: ChatContextSummary | null;
  pending: boolean;
  /** Iterations of the last agent loop (for the "n turns · truncated?" badge). */
  lastIterations: number | null;
  lastTruncated: boolean;
  /** Absolute JSONL log path for the last dev-mode agent run, when enabled. */
  lastDebugLogPath: string | null;
  /** Workspace-relative manifest path for the last persistent assistant run. */
  lastRunManifestPath: string | null;
  lastAttemptId: string | null;
  lastRunStatus:
    | 'running'
    | 'complete'
    | 'failed'
    | 'needs_review'
    | 'cancelled'
    | 'preflight_rejected'
    | null;
  lastRunSummary: string | null;
  lastRunErrorCode: string | null;
  lastBlockingRun: AssistantActiveRun | null;
  lastComponentReuse: ComponentReuseRunSummary | null;
  lastRenderProof: AgentRunRenderProof | null;
  lastRunMetrics: AssistantRunMetrics | null;
  error: string | null;
  /** When true, useChat goes through /api/chat/stream (Phase 2.5). */
  useStreaming: boolean;
  /** Set while a turn is in flight; calling it aborts the underlying fetch. */
  cancel: (() => void) | null;
  pendingPermission: AgentPermissionRequest | null;
  pendingPermissionsByRunId: Record<string, AgentPermissionRequest>;
  /**
   * 0083 D6/D7 — sticky per-session agent override (e.g. `ai-description-layer`).
   * Keyed by sessionId so each chat keeps its own selection and a fresh chat
   * defaults back to the primary agent. Sent as `agentName` on every message so a
   * typed follow-up does not silently revert to the primary agent mid-interview.
   * In-memory UI state (not persisted to the project, per CLAUDE.md rule 11).
   */
  sessionAgentBySession: Record<string, string>;

  hydrateFromProject: (project: SberDesignerProject | null) => void;
  switchToScreen: (screenId: string | null) => void;
  startNewTask: (screenId?: string | null) => string;
  restoreTask: (sessionId: string) => void;
  retargetTaskToScreen: (
    sessionId: string,
    screenId: string,
    options?: { targetScreenName?: string; persistProject?: boolean },
  ) => string | null;
  deleteTask: (sessionId: string) => void;
  updateTaskSummary: (
    sessionId: string,
    patch: { title?: string; summary?: string; lastSummarizedMessageId?: string },
  ) => void;
  setContextMode: (mode: AssistantContextMode) => void;
  setSessionMode: (mode: AssistantSessionMode) => void;
  activeSession: () => ProjectAssistantSession | null;
  ensureSessionForScreen: (screenId?: string | null) => {
    screenId: string;
    sessionId: string;
  };
  contextMessages: (latestUserMessageId?: string) => ChatMessage[];
  contextMessagesForSession: (sessionId: string, latestUserMessageId?: string) => ChatMessage[];
  appendUser: (content: string, attachments?: ChatAttachment[]) => string;
  appendUserToSession: (
    sessionId: string,
    content: string,
    attachments?: ChatAttachment[],
    options?: {
      persistProject?: boolean;
      contextEligible?: boolean;
      metadata?: Record<string, unknown>;
    },
  ) => string;
  appendAssistantToSession: (
    sessionId: string,
    content: string,
    options?: {
      metadata?: Record<string, unknown>;
      contextEligible?: boolean;
      persistProject?: boolean;
    },
  ) => string;
  appendExternalAssistant: (content: string, meta: { provider: string; model: string }) => string;
  /** Replace the active task transcript with the agent's view. */
  replaceTurn: (next: ChatMessage[], info: ReplaceTurnInfo) => void;
  replaceTurnForSession: (
    sessionId: string,
    next: ChatMessage[],
    info: ReplaceTurnInfo,
    options?: { persistProject?: boolean },
  ) => void;
  markRunStartedForSession: (
    sessionId: string,
    info?: {
      attemptId?: string;
      debugLogPath?: string;
      runManifestPath?: string;
    },
    options?: { persistProject?: boolean },
  ) => void;
  settleCancelledRunForSession: (
    sessionId: string,
    options?: { afterMessageId?: string; summary?: string; persistProject?: boolean },
  ) => void;
  /** Progressive streaming update for the active task transcript. */
  setVisibleMessages: (next: ChatMessage[]) => void;
  setVisibleMessagesForSession: (
    sessionId: string,
    next: ChatMessage[],
    options?: { persistProject?: boolean },
  ) => void;
  setPending: (pending: boolean) => void;
  setError: (error: string | null) => void;
  setUseStreaming: (useStreaming: boolean) => void;
  setCancel: (cancel: (() => void) | null) => void;
  setPendingPermission: (request: AgentPermissionRequest | null) => void;
  setPendingPermissionForRun: (
    runKey: string | null | undefined,
    request: AgentPermissionRequest | null,
  ) => void;
  pendingPermissionForRun: (runKey: string | null | undefined) => AgentPermissionRequest | null;
  clearPendingPermissionForTool: (toolCallId: string, runKey?: string | null | undefined) => void;
  clearPendingPermissionsForRun: (runKey: string | null | undefined) => void;
  /** Pin the active session to an agent (subagent or primary); null clears it. */
  setSessionAgentName: (name: string | null) => void;
  /** Agent pinned to the active session, or null when none is selected. */
  activeSessionAgentName: () => string | null;
  reset: () => void;
}
