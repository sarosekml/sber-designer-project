/**
 * Assistant chat endpoints: non-streaming chat, SSE streaming with
 * AgentStreamEvent frames, permission resolution, task summaries, and
 * editor-state pushes that feed the agent's editor context.
 */
import type { ChatMessage, ChatRequest, ChatResponse } from '@sber-designer/llm-gateway';
import type {
  AssistantSessionMode,
  ComponentEntry,
  ComponentPackRunSummary,
  ComponentReuseRunSummary,
  DesignBrief,
  DesignDirectionSelection,
  ModalDefaults,
  ProjectScreenSurface,
  ProjectTask,
  PromptAttachmentUpload,
  ScreenReadinessProfileInput,
  RunQualitySummary,
} from '@sber-designer/shared-types';
import type { SelectedNode } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';
import { useSandboxStore } from '@/stores/sandbox-store';

import { API_URL, ApiError, authHeaders, safeJson, withSignal } from './http';

export interface AgentChatResponse extends ChatResponse {
  /** Full transcript — user + assistant + tool messages (no system). */
  transcript: ChatMessage[];
  iterations: number;
  truncated: boolean;
  debugLogPath?: string;
  runId?: string;
  runManifestPath?: string;
  componentReuse?: ComponentReuseRunSummary;
}

export interface AgentChatRequest extends ChatRequest {
  provider?: string;
  model?: string;
  primaryAgent?: string;
  agent?: string;
  maxIterations?: number;
  attachments?: PromptAttachmentUpload[];
  generation?: ChatGenerationOptions;
  sessionMode?: AssistantSessionMode;
}

export interface ChatGenerationOptions {
  wireframe?: boolean;
  critique?: boolean;
  designBrief?: DesignBrief;
  directionSelection?: DesignDirectionSelection;
  surface?: ProjectScreenSurface;
  modal?: ModalDefaults;
}

export async function postChat(
  req: AgentChatRequest,
  signal?: AbortSignal,
): Promise<AgentChatResponse> {
  const res = await fetch(
    `${API_URL}/api/chat`,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(req),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as AgentChatResponse;
}

export interface SummarizeChatTaskInput {
  messages: { role: 'user' | 'assistant'; content: string }[];
}

export interface SummarizeChatTaskResult {
  title: string;
  summary: string;
  source: 'llm' | 'fallback';
}

export async function summarizeChatTask(
  input: SummarizeChatTaskInput,
  signal?: AbortSignal,
): Promise<SummarizeChatTaskResult> {
  const res = await fetch(
    `${API_URL}/api/chat/summarize-task`,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(input),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as SummarizeChatTaskResult;
}

/**
 * Push a slice of editor state to the api so proj-mcp tools can read it.
 * Fire-and-forget — never throws at the call site.
 */
export async function pushEditorState(patch: {
  mode?: 'interact' | 'design' | 'code';
  canvasView?: 'screen' | 'storybook' | 'design-system';
  selection?: {
    loc: string;
    sourceKind?: 'react-source' | 'sd-loc' | 'dom-fallback';
    domPath?: string;
    componentPath?: string[];
    tagName: string;
    text?: string;
    selector?: string;
    componentName?: string;
    componentLoc?: string;
    attributes?: Record<string, string>;
    selectionNotice?: string;
    inspectId?: string;
    computedStyles?: Record<string, string>;
    rect: { x: number; y: number; width: number; height: number };
  } | null;
  projectName?: string | null;
  projectInstructions?: string | null;
  activeScreen?: {
    id: string;
    name: string;
    kind: 'story' | 'page';
    storyId?: string;
    filePath?: string;
    implementationFilePath?: string;
    folder?: string;
    description?: string;
  } | null;
  activeComponent?: ComponentEntry | null;
  selectedComment?: {
    id: string;
    screenId: string;
    body: string;
    anchor: { x: number; y: number };
    status: 'open' | 'resolved';
    selector?: string;
    elementText?: string;
  } | null;
  commentContext?: {
    id: string;
    screenId: string;
    body: string;
    anchor: { x: number; y: number };
    status: 'open' | 'resolved';
    selector?: string;
    elementText?: string;
  }[];
  taskContext?: ProjectTask[];
  assistantTaskIntent?:
    | { kind: 'edit-current-screen'; targetScreenId: string }
    | {
        kind: 'create-screen-from-story';
        targetScreenId: string;
        sourceStoryId: string;
        sourceStoryFilePath?: string;
        targetName: string;
        targetFolder: string;
        targetStoryFilePath: string;
        targetImplementationFilePath?: string;
        targetStoryId: string;
      }
    | {
        kind: 'fill-generated-screen';
        targetScreenId: string;
        targetName: string;
        targetFolder: string;
        targetStoryFilePath: string;
        targetImplementationFilePath?: string;
        targetStoryId: string;
      }
    | null;
  visualDesign?: {
    draftChanges: {
      kind: string;
      label: string;
      filePath?: string;
      loc?: { line: number; column: number };
    }[];
  };
  agentCraftPostCheckEnabled?: boolean;
  screenReadiness?: ScreenReadinessProfileInput;
  storybookReloadPending?: boolean;
  canvasUrl?: string | null;
  workspacePath?: string | null;
}): Promise<void> {
  try {
    const workspacePath =
      patch.workspacePath ??
      useProjectStore.getState().project?.workspacePath ??
      useSandboxStore.getState().session?.workspacePath;
    const res = await fetch(`${API_URL}/api/state`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        ...patch,
        ...(workspacePath ? { workspacePath } : {}),
      }),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn('pushEditorState failed', res.status, await safeJson(res));
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('pushEditorState network error', err);
  }
}

// ---------- /api/chat/stream (Phase 2.5 SSE) ---------------------------

export interface AgentPermissionRequest {
  id: string;
  toolCallId: string;
  toolName: string;
  runId?: string;
  category: string;
  resource: string;
  pattern: string;
  arguments: string;
}

export interface AgentRuntimeSessionInfo {
  runtime: string;
  style: 'specify' | 'capture';
  mode: 'new' | 'resume';
  resumeUsed: boolean;
  model: string | null;
  workspacePath: string | null;
  sessionId?: string;
  source: 'metadata' | 'new' | 'runtime-event';
  captureSeen?: boolean;
  missReason?:
    | 'metadata_missing'
    | 'runtime_mismatch'
    | 'model_mismatch'
    | 'workspace_mismatch'
    | 'idle_expired'
    | 'capability_unavailable'
    | 'capture_event_pending'
    | 'capture_event_runtime_mismatch';
  captureEvent?: string;
  cumulativeUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    costUsd?: number;
  };
  updatedAt?: string;
}

export interface AgentRunRenderProof {
  status: 'confirmed' | 'pending' | 'failed';
  attempt: number;
  checkedAt: string;
  reason: string;
  reasonCode?: string;
  evidenceSource?: string;
  evidenceJsCapable?: boolean;
  canReprobe?: boolean;
  canvasUrl?: string;
}

export type AgentStreamEvent =
  | { type: 'heartbeat' }
  | {
      type: 'run-started';
      clientRunId: string;
      sessionId: string;
      screenId: string;
      provider: string;
      model: string;
      runId?: string;
      runManifestPath?: string;
      componentPack?: ComponentPackRunSummary;
    }
  | {
      type: 'run-rejected';
      clientRunId?: string;
      sessionId?: string;
      screenId?: string;
      reason: string;
    }
  | { type: 'iteration-start'; iteration: number }
  | { type: 'text-delta'; iteration: number; delta: string }
  | {
      type: 'tool-call';
      iteration: number;
      call: { id: string; name: string; arguments: string };
    }
  | { type: 'permission-request'; iteration: number; request: AgentPermissionRequest }
  | {
      type: 'tool-result';
      iteration: number;
      toolCallId: string;
      content: string;
      isError: boolean;
      toolName?: string;
      status?: 'ok' | 'error';
      componentPack?: ComponentPackRunSummary;
      changedFiles?: string[];
      permissionWaitMs?: number;
      handlerDurationMs?: number;
      totalDurationMs?: number;
    }
  | {
      type: 'iteration-end';
      iteration: number;
      hadToolCalls: boolean;
      finishReason?: string;
    }
  | {
      type: 'external-runtime-context';
      runtime: string;
      agent: string;
      skillInventoryCount: number;
      contextBundlePath?: string;
      omittedSections: { section: string; reason: string }[];
      runtimeWarnings?: string[];
    }
  | {
      type: 'external-runtime-diagnostic';
      name: string;
      data: Record<string, unknown>;
    }
  | {
      type: 'usage';
      iteration: number;
      usage: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        costUsd?: number;
      };
    }
  | {
      type: 'done';
      transcript: ChatMessage[];
      iterations: number;
      truncated: boolean;
      hadErrors?: boolean;
      stoppedAfterPermissionDeny?: boolean;
      finalResponse: ChatResponse;
      attemptId?: string;
      debugLogPath?: string;
      runId?: string;
      runManifestPath?: string;
      runStatus?: 'complete' | 'failed' | 'needs_review' | 'cancelled';
      runSummary?: string;
      componentPack?: ComponentPackRunSummary;
      componentReuse?: ComponentReuseRunSummary;
      qualitySummary?: RunQualitySummary;
      renderProof?: AgentRunRenderProof;
      runtimeSession?: AgentRuntimeSessionInfo;
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        costUsd?: number;
      };
    }
  | {
      type: 'error';
      message: string;
      attemptId?: string;
      debugLogPath?: string;
      runId?: string;
      runManifestPath?: string;
    };

export interface ChatEditorContext {
  mode?: 'interact' | 'design' | 'code';
  canvasView?: 'screen' | 'storybook' | 'design-system';
  selection?: SelectedNode | null;
  projectName?: string | null;
  projectInstructions?: string | null;
  activeScreen?: {
    id: string;
    name: string;
    kind: 'story' | 'page';
    storyId?: string;
    filePath?: string;
    implementationFilePath?: string;
    folder?: string;
    description?: string;
  } | null;
  activeComponent?: ComponentEntry | null;
  selectedComment?: {
    id: string;
    screenId: string;
    body: string;
    anchor: { x: number; y: number };
    status: 'open' | 'resolved';
    selector?: string;
    elementText?: string;
  } | null;
  commentContext?: {
    id: string;
    screenId: string;
    body: string;
    anchor: { x: number; y: number };
    status: 'open' | 'resolved';
    selector?: string;
    elementText?: string;
  }[];
  taskContext?: ProjectTask[];
  assistantTaskIntent?:
    | { kind: 'edit-current-screen'; targetScreenId: string }
    | {
        kind: 'create-screen-from-story';
        targetScreenId: string;
        sourceStoryId: string;
        sourceStoryFilePath?: string;
        targetName: string;
        targetFolder: string;
        targetStoryFilePath: string;
        targetImplementationFilePath?: string;
        targetStoryId: string;
      }
    | {
        kind: 'fill-generated-screen';
        targetScreenId: string;
        targetName: string;
        targetFolder: string;
        targetStoryFilePath: string;
        targetImplementationFilePath?: string;
        targetStoryId: string;
      }
    | null;
  visualDesign?: {
    draftChanges: {
      kind: string;
      label: string;
      filePath?: string;
      loc?: { line: number; column: number };
    }[];
  };
  agentCraftPostCheckEnabled?: boolean;
  screenReadiness?: ScreenReadinessProfileInput;
  canvasUrl?: string | null;
  workspacePath?: string | null;
}

export interface StreamChatRequest extends AgentChatRequest {
  attachContext?: boolean;
  enableTools?: boolean;
  maxIterations?: number;
  clientRunId?: string;
  sessionId?: string;
  screenId?: string;
  editorContext?: ChatEditorContext;
}

export async function resolveChatPermission(
  id: string,
  decision: 'allow' | 'deny',
  options: { remember?: boolean; signal?: AbortSignal } = {},
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/chat/stream/permission/${encodeURIComponent(id)}`,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          decision,
          ...(options.remember ? { remember: true } : {}),
        }),
      },
      options.signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
}

/**
 * Open a streaming chat. Yields AgentStreamEvent values until the
 * server emits `done` (or `error`).
 */
export async function* streamChat(
  req: StreamChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<AgentStreamEvent> {
  const res = await fetch(
    `${API_URL}/api/chat/stream`,
    withSignal(
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'text/event-stream',
          ...authHeaders(),
        },
        body: JSON.stringify(req),
      },
      signal,
    ),
  );

  if (!res.ok || !res.body) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error, {
      ...(body?.attemptId ? { attemptId: body.attemptId } : {}),
      ...(body?.debugLogPath ? { debugLogPath: body.debugLogPath } : {}),
      ...(body?.runManifestPath ? { runManifestPath: body.runManifestPath } : {}),
      ...(body?.blockingRun ? { blockingRun: body.blockingRun } : {}),
      ...(body?.activeRuns ? { activeRuns: body.activeRuns } : {}),
    });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nlIdx;
      while ((nlIdx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, nlIdx).trim();
        buffer = buffer.slice(nlIdx + 2);
        if (!frame) continue;
        const dataLines = frame
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim());
        if (dataLines.length === 0) continue;
        const data = dataLines.join('\n');
        try {
          yield JSON.parse(data) as AgentStreamEvent;
        } catch {
          // Skip malformed frames.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
