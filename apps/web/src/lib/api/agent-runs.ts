/**
 * Local CLI agent runtimes (OpenCode / Claude Code / Codex / Kimi / GigaCode): inventory,
 * connect/select, plus active agent runs and run evidence export.
 */
import type { AgentRunReviewAnnotation, AssistantActiveRun } from '@sber-designer/shared-types';
import type { AgentPermissionRequest, AgentRunRenderProof } from './chat';

import { API_URL, ApiError, authHeaders, safeJson, withSignal } from './http';

export const OPENCODE_RUNTIME_PROVIDER_ID = 'opencode-runtime';
export const CLAUDE_CODE_RUNTIME_PROVIDER_ID = 'claude-code-runtime';
export const CODEX_RUNTIME_PROVIDER_ID = 'codex-runtime';
export const KIMI_RUNTIME_PROVIDER_ID = 'kimi-runtime';
export const GIGACODE_RUNTIME_PROVIDER_ID = 'gigacode-runtime';

export type AgentRuntimeKind = 'opencode' | 'claude-code' | 'codex' | 'kimi' | 'gigacode';

export interface AgentRuntimeModel {
  runtime: AgentRuntimeKind;
  id: string;
  provider: string;
  model: string;
  label: string;
  description?: string;
  contextWindowSize?: number;
}

export interface AgentRuntimeMcpServer {
  runtime: AgentRuntimeKind;
  name: string;
  status: 'enabled' | 'disabled' | 'connected' | 'failed' | 'unknown';
  transport: 'stdio' | 'http' | 'unknown';
  detail?: string;
}

export interface AgentRuntimeStatus {
  kind: AgentRuntimeKind;
  displayName: string;
  installed: boolean;
  connected: boolean;
  command: string | null;
  version: string | null;
  launch?: {
    command: string;
    selectedBin: string;
    launchPath?: string;
    source?: 'profile' | 'env' | 'path';
    probeCwd?: string | null;
  };
  selectedModel?: string;
  auth: {
    status: 'unknown' | 'none' | 'ready' | 'failed';
    providers: string[];
    message?: string;
    action?: 'sign-in';
  };
  models: AgentRuntimeModel[];
  mcpServers: AgentRuntimeMcpServer[];
  capabilities: {
    modelList: boolean;
    mcpList: boolean;
    runJson: boolean;
    modelFlag: boolean;
    promptViaStdin: boolean;
    jsonEventStream: boolean;
    cancel: boolean;
    usesOwnMcpConfig: boolean;
    supportsProjectMcpHandoff: boolean;
    chatHandoff: boolean;
    imageInputMode: 'cli-native' | 'cli-files-warning' | 'none';
    imageDeliveryMode?:
      | 'none'
      | 'prompt_path'
      | 'cli_native_arg'
      | 'cli_native_file'
      | 'mcp_resource';
    rasterImageInput: boolean;
    svgSourceInput: boolean;
    nativeFileInput: boolean;
  };
  diagnostics: { code: string; message: string; severity: 'info' | 'warning' | 'error' }[];
}

export interface AgentRuntimesResponse {
  runtimes: AgentRuntimeStatus[];
  enabledKinds: AgentRuntimeKind[];
}

export interface ActiveAgentPermissionRequest extends AgentPermissionRequest {
  status: 'pending';
  createdAt: number;
  expiresAt?: number;
  clientRunId?: string;
  sessionId?: string;
  screenId?: string;
}

export async function fetchAgentRuntimes(signal?: AbortSignal): Promise<AgentRuntimesResponse> {
  const res = await fetch(
    `${API_URL}/api/agent-runtimes`,
    withSignal({ headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as AgentRuntimesResponse;
}

export async function connectAgentRuntime(
  kind: AgentRuntimeKind,
  model?: string,
  signal?: AbortSignal,
): Promise<{ runtime: AgentRuntimeStatus }> {
  const res = await fetch(
    `${API_URL}/api/agent-runtimes/${encodeURIComponent(kind)}/connect`,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(model ? { model } : {}),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as { runtime: AgentRuntimeStatus };
}

export async function refreshAgentRuntime(
  kind: AgentRuntimeKind,
  signal?: AbortSignal,
): Promise<{ runtime: AgentRuntimeStatus }> {
  const res = await fetch(
    `${API_URL}/api/agent-runtimes/${encodeURIComponent(kind)}/refresh`,
    withSignal({ method: 'POST', headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as { runtime: AgentRuntimeStatus };
}

export async function disconnectAgentRuntime(
  kind: AgentRuntimeKind,
  signal?: AbortSignal,
): Promise<{ runtime: AgentRuntimeStatus }> {
  const res = await fetch(
    `${API_URL}/api/agent-runtimes/${encodeURIComponent(kind)}/disconnect`,
    withSignal({ method: 'POST', headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as { runtime: AgentRuntimeStatus };
}

export async function selectAgentRuntimeModel(
  kind: AgentRuntimeKind,
  model: string,
  signal?: AbortSignal,
): Promise<{ runtime: AgentRuntimeStatus }> {
  const res = await fetch(
    `${API_URL}/api/agent-runtimes/${encodeURIComponent(kind)}/model`,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ model }),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as { runtime: AgentRuntimeStatus };
}

export async function connectOpenCodeRuntime(
  model?: string,
  signal?: AbortSignal,
): Promise<{ runtime: AgentRuntimeStatus }> {
  return connectAgentRuntime('opencode', model, signal);
}

export async function disconnectOpenCodeRuntime(
  signal?: AbortSignal,
): Promise<{ runtime: AgentRuntimeStatus }> {
  return disconnectAgentRuntime('opencode', signal);
}

export async function fetchActiveAgentRuns(
  signal?: AbortSignal,
): Promise<{ runs: AssistantActiveRun[]; pendingPermissions?: ActiveAgentPermissionRequest[] }> {
  const res = await fetch(
    `${API_URL}/api/agent-runs/active`,
    withSignal({ headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as {
    runs: AssistantActiveRun[];
    pendingPermissions?: ActiveAgentPermissionRequest[];
  };
}

export async function cancelAgentRun(runId: string, signal?: AbortSignal): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/agent-runs/${encodeURIComponent(runId)}/cancel`,
    withSignal(
      {
        method: 'POST',
        headers: authHeaders(),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
}

export interface AgentRunFeedback {
  version: 1;
  runId: string;
  rating: 'up' | 'down';
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchAgentRunFeedback(
  runId: string,
  signal?: AbortSignal,
): Promise<AgentRunFeedback | null> {
  const res = await fetch(
    `${API_URL}/api/agent-runs/${encodeURIComponent(runId)}/feedback`,
    withSignal({ headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  const body = (await res.json()) as { feedback?: AgentRunFeedback | null };
  return body.feedback ?? null;
}

export async function saveAgentRunFeedback(
  runId: string,
  input: { rating: 'up' | 'down'; reason?: string | null },
  signal?: AbortSignal,
): Promise<AgentRunFeedback> {
  const res = await fetch(
    `${API_URL}/api/agent-runs/${encodeURIComponent(runId)}/feedback`,
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
  return ((await res.json()) as { feedback: AgentRunFeedback }).feedback;
}

export async function fetchAgentRunReview(
  runId: string,
  signal?: AbortSignal,
): Promise<AgentRunReviewAnnotation | null> {
  const res = await fetch(
    `${API_URL}/api/agent-runs/${encodeURIComponent(runId)}/review`,
    withSignal({ headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return ((await res.json()) as { review?: AgentRunReviewAnnotation | null }).review ?? null;
}

export async function markAgentRunReviewed(
  runId: string,
  signal?: AbortSignal,
): Promise<AgentRunReviewAnnotation> {
  const res = await fetch(
    `${API_URL}/api/agent-runs/${encodeURIComponent(runId)}/review`,
    withSignal(
      {
        method: 'POST',
        headers: authHeaders(),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return ((await res.json()) as { review: AgentRunReviewAnnotation }).review;
}

export interface AgentRunRenderReprobeResponse {
  ok: boolean;
  code?: string;
  detail?: string;
  renderProof: AgentRunRenderProof;
  health?: {
    status: 'ok' | 'failed' | 'warning' | 'unavailable';
    reason: string;
    reasonCode?: string;
    evidenceSource?: string;
  };
}

export async function reprobeAgentRunRender(
  runId: string,
  canvasUrl?: string | null,
  signal?: AbortSignal,
): Promise<AgentRunRenderReprobeResponse> {
  const res = await fetch(
    `${API_URL}/api/agent-runs/${encodeURIComponent(runId)}/render-reprobe`,
    withSignal(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders() },
        body: JSON.stringify(canvasUrl ? { canvasUrl } : {}),
      },
      signal,
    ),
  );
  if (!res.ok) {
    const body = (await safeJson(res)) as
      | (Awaited<ReturnType<typeof safeJson>> & Partial<AgentRunRenderReprobeResponse>)
      | null;
    if (body?.renderProof) return body as AgentRunRenderReprobeResponse;
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as AgentRunRenderReprobeResponse;
}

export interface AgentRunEvidenceArtifact {
  kind: string;
  path: string;
  required: boolean;
  exists: boolean;
  source?: string;
}

export interface AgentRunExternalLog {
  kind: 'attempt-log' | 'debug-log' | 'run-manifest-link';
  path: string;
}

export interface AgentRunEvidenceExportManifest {
  version: 1;
  runId: string;
  status: 'running' | 'complete' | 'failed' | 'needs_review' | 'cancelled';
  provider: string | null;
  model: string | null;
  runtimeKind: 'api' | 'cli' | null;
  summary: string | null;
  rootPath: string;
  workspacePath: string;
  generatedAt: number;
  activeScreen: {
    id: string;
    name: string;
    kind: string;
    storyId?: string;
    filePath?: string;
    implementationFilePath?: string;
    folder?: string;
    description?: string;
  } | null;
  activeTarget: {
    screenId?: string;
    screenName?: string;
    files: string[];
  } | null;
  diagnostics: Record<string, unknown> | null;
  metrics: Record<string, unknown> | null;
  componentReuse: Record<string, unknown> | null;
  receiptSummary: {
    total: number;
    byStatus: Record<string, number>;
    tools: string[];
    latest: {
      tool: string;
      status: string;
      summary: string | null;
      changedFiles: string[];
      createdAt: number;
    } | null;
  };
  pendingPermissions: Array<{
    id: string;
    toolCallId: string;
    toolName: string;
    category: string;
    resource: string;
    pattern: string;
    runId?: string;
    createdAt: number;
    expiresAt?: number;
    elapsedMs: number;
  }>;
  lastTimelineEvent: Record<string, unknown> | null;
  artifacts: AgentRunEvidenceArtifact[];
  externalLogs: AgentRunExternalLog[];
}

export async function fetchAgentRunEvidence(
  runId: string,
  signal?: AbortSignal,
): Promise<AgentRunEvidenceExportManifest> {
  const res = await fetch(
    `${API_URL}/api/agent-runs/${encodeURIComponent(runId)}/evidence`,
    withSignal({ headers: authHeaders() }, signal),
  );
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(body?.detail ?? `HTTP ${res.status}`, res.status, body?.error);
  }
  return (await res.json()) as AgentRunEvidenceExportManifest;
}

// ---------- /api/share (Phase 5.5) ----------
