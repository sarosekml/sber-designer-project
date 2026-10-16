/** Screen assistant history and prompt attachments (0051). */

export type AssistantContextMode = 'clean' | 'current-task' | 'full-thread';
export type AssistantSessionMode = 'ask' | 'plan' | 'design';
export type AssistantSessionStatus = 'active' | 'archived';
export type AssistantSessionTitleSource = 'user' | 'llm' | 'fallback';
export type AssistantMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface PersistedAssistantAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'text';
}

export type PromptAttachmentKind = 'image' | 'text';
export type PromptImageSource =
  | { type: 'upload'; dataUrl: string }
  | { type: 'remote-url'; url: string };

export const PROMPT_RASTER_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const PROMPT_IMAGE_MIME_TYPES = [
  ...PROMPT_RASTER_IMAGE_MIME_TYPES,
  'image/svg+xml',
] as const;

export type PromptRasterImageMimeType = (typeof PROMPT_RASTER_IMAGE_MIME_TYPES)[number];
export type PromptImageMimeType = (typeof PROMPT_IMAGE_MIME_TYPES)[number];

const PROMPT_RASTER_IMAGE_MIME_TYPE_SET = new Set<string>(PROMPT_RASTER_IMAGE_MIME_TYPES);
const PROMPT_IMAGE_MIME_TYPE_SET = new Set<string>(PROMPT_IMAGE_MIME_TYPES);

export function isPromptRasterImageMimeType(
  mimeType: string,
): mimeType is PromptRasterImageMimeType {
  return PROMPT_RASTER_IMAGE_MIME_TYPE_SET.has(mimeType);
}

export function isPromptImageMimeType(mimeType: string): mimeType is PromptImageMimeType {
  return PROMPT_IMAGE_MIME_TYPE_SET.has(mimeType);
}

export function normalizePromptImageMimeType(
  mimeType: string,
  name = '',
): PromptImageMimeType | null {
  const clean = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (isPromptImageMimeType(clean)) return clean;
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return null;
}

export interface PromptAttachmentUpload {
  id: string;
  kind: PromptAttachmentKind;
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string | undefined;
  text?: string | undefined;
  source?: PromptImageSource | undefined;
}

export interface PromptImageAttachmentEvidence {
  id: string;
  kind?: 'image';
  name: string;
  mimeType: PromptImageMimeType;
  size: number;
  sha256: string;
  runPath: string;
  width?: number;
  height?: number;
  sourceKind?: 'upload' | 'remote-url';
  originalUrl?: string;
  providerImageUrl?: string;
  sourceExcerpt?: string;
}

export interface PromptTextAttachmentEvidence {
  id: string;
  kind: 'text';
  documentKind: 'html' | 'css' | 'markdown' | 'json' | 'yaml' | 'plain';
  name: string;
  mimeType: string;
  size: number;
  sha256: string;
  runPath: string;
  excerpt: string;
  analysis?: PromptHtmlAttachmentAnalysis;
}

export type PromptAttachmentEvidence = PromptImageAttachmentEvidence | PromptTextAttachmentEvidence;

export interface PromptHtmlAttachmentAnalysis {
  title?: string;
  headings: Array<{ level: number; text: string }>;
  landmarks: Array<{ role: string; label?: string }>;
  sections: Array<{ heading?: string; summary: string }>;
  forms: Array<{ label?: string; fields: string[]; actions: string[] }>;
  tables: Array<{ caption?: string; columns: string[]; sampleRows: string[][] }>;
  lists: Array<{ label?: string; items: string[] }>;
  actions: string[];
  mockText: string[];
  classHints: string[];
  warnings: string[];
}

export interface RunContinuationContextSnapshot {
  version: 1;
  runId: string;
  sessionId?: string;
  screenId?: string;
  sourcePrompt: {
    messageId?: string;
    text: string;
    compacted: boolean;
  };
  taskSummary?: string;
  activeTarget?:
    | {
        screenId?: string | undefined;
        screenName?: string | undefined;
        implementationFilePath?: string | undefined;
        storyFilePath?: string | undefined;
      }
    | undefined;
  attachments: PromptAttachmentEvidence[];
  changedFiles: string[];
  lastToolCalls: Array<{
    name: string;
    status: 'ok' | 'error' | 'skipped' | 'needs_review' | 'warning' | 'unavailable';
    summary: string;
  }>;
  runStatus?:
    | 'queued'
    | 'running'
    | 'complete'
    | 'failed'
    | 'needs_review'
    | 'cancelled'
    | undefined;
  runSummary?: string | undefined;
}

export interface PersistedAssistantToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface PersistedAssistantMessageMeta {
  provider?: string;
  model?: string;
  /** Chat-session intent used for the run that produced this message. */
  sessionMode?: AssistantSessionMode;
}

/**
 * Migrate the former composer modes without leaking the old `auto` launcher
 * into project-owned conversation state.
 */
export function normalizeAssistantSessionMode(value: unknown): AssistantSessionMode {
  return value === 'ask' || value === 'plan' || value === 'design' ? value : 'design';
}

export interface AssistantTokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

/**
 * Keep the three token counters honest across API and CLI runtimes.
 * A derived total is only valid when both sides of the split are known.
 */
export function normalizeAssistantTokenUsage(
  usage: AssistantTokenUsage | null | undefined,
): AssistantTokenUsage | null {
  if (!usage) return null;
  const inputTokens = validTokenCount(usage.inputTokens);
  const outputTokens = validTokenCount(usage.outputTokens);
  const explicitTotalTokens = validTokenCount(usage.totalTokens);
  const totalTokens =
    inputTokens !== undefined && outputTokens !== undefined
      ? inputTokens + outputTokens
      : explicitTotalTokens;
  if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) {
    return null;
  }
  return {
    ...(totalTokens !== undefined ? { totalTokens } : {}),
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
  };
}

function validTokenCount(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : undefined;
}

export interface PersistedAssistantMessage {
  id: string;
  role: AssistantMessageRole;
  content: string;
  createdAt: string;
  attachments?: PersistedAssistantAttachment[];
  toolCalls?: PersistedAssistantToolCall[];
  meta?: PersistedAssistantMessageMeta;
  contextEligible?: boolean;
  external?: boolean;
  runManifestId?: string;
  /** Per completed assistant turn; never cumulative across the chat. */
  tokenUsage?: AssistantTokenUsage;
  toolName?: string;
  toolCallId?: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectAssistantSession {
  id: string;
  title: string;
  titleSource?: AssistantSessionTitleSource;
  primaryScreenId: string;
  linkedScreenIds?: string[];
  status: AssistantSessionStatus;
  /** Project-owned Ask / Plan / Design intent for this conversation. */
  sessionMode?: AssistantSessionMode;
  contextMode?: AssistantContextMode;
  summary?: string;
  summaryUpdatedAt?: string;
  lastSummarizedMessageId?: string;
  contextCutoffMessageId?: string;
  linkedRunManifestIds?: string[];
  metadata?: {
    lastAttemptId?: string | null;
    lastDebugLogPath?: string | null;
    lastRunManifestPath?: string | null;
    lastRunStatus?:
      | 'running'
      | 'complete'
      | 'failed'
      | 'needs_review'
      | 'cancelled'
      | 'preflight_rejected'
      | null;
    lastRunSummary?: string | null;
    lastRunErrorCode?: string | null;
    lastBlockingRun?: AssistantActiveRun | null;
    lastContinuationContextPath?: string | null;
    lastComponentReuse?: ComponentReuseRunSummary | null;
    lastRunMetrics?: AssistantRunMetrics | null;
    runtimeSessionId?: string | null;
    runtimeSessionRuntime?: string | null;
    runtimeSessionModel?: string | null;
    runtimeSessionWorkspacePath?: string | null;
    runtimeSessionUsage?: AssistantRunMetrics | null;
    runtimeSessionUpdatedAt?: string | null;
    retargetedFromSessionId?: string | null;
    retargetedFromScreenId?: string | null;
    retargetedToSessionId?: string | null;
    retargetedToScreenId?: string | null;
    retargetedAt?: string | null;
  };
  messages: PersistedAssistantMessage[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface AssistantRunMetrics {
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  iterations?: number;
}

export interface ProjectAssistantState {
  storageVersion?: number;
  activeSessionByScreenId?: Record<string, string>;
  sessions: ProjectAssistantSession[];
}

export type AssistantRunUiStatus =
  | 'queued'
  | 'running'
  | 'stopping'
  | 'complete'
  | 'error'
  | 'rejected';

export interface AssistantActiveRun {
  clientRunId: string;
  runId?: string;
  sessionId: string;
  screenId: string;
  provider: string;
  model: string;
  /** Ask / Plan / Design intent captured when the run acquired its lease. */
  sessionMode?: AssistantSessionMode;
  /** Human who started the run; present for authenticated password sessions. */
  displayName?: string;
  status: AssistantRunUiStatus;
  startedAt: number;
  updatedAt: number;
  title?: string;
  reason?: string;
  runManifestPath?: string;
  /** Workspace-relative files/globs reserved by the run concurrency lease. */
  targetPaths?: string[];
}

export interface ComponentReuseRunSummary {
  expected: string[];
  used: string[];
  missing: string[];
  exact?: string[];
  substituted?: ComponentReuseSubstitution[];
  skipped?: ComponentReuseSkipped[];
  requiredRoles?: string[];
  usedComponentIds?: string[];
  missingRequiredRoles?: string[];
  designSystemGaps?: string[];
  optionalSkipped?: ComponentReuseSkipped[];
  score?: ComponentReuseScore;
}

export interface ComponentReuseSubstitution {
  role: string;
  expected: string;
  componentId?: string;
  used: string[];
}

export interface ComponentReuseSkipped {
  role: string;
  expected: string;
  componentId?: string;
}

export interface ComponentReuseScore {
  earned: number;
  total: number;
  label: string;
}

export interface ComponentPackRunSummary {
  /** Run-local component context health; workspace index freshness is separate. */
  status: 'ready' | 'weak' | 'missing';
  workspaceFreshness?: 'current' | 'stale';
  /** @deprecated Use selectedCount in UI copy. */
  candidateCount: number;
  selectedCount?: number;
  diagnosticCount: number;
  indexedCount?: number;
  describedCount?: number;
  divergedCount?: number;
  selectionSource?: 'screen-structure-plan' | 'legacy-role-profile';
  plannedRoleCount?: number;
  gapCount?: number;
  hydratedCount?: number;
  hydrationBatchCount?: number;
  hydrationBytes?: number;
  resolvedComponentCount?: number;
  partialResolutionCount?: number;
  unverifiedResolutionCount?: number;
  lateSelectionCount?: number;
  lateSelectionBudget?: number;
  selections?: ComponentPackSelectionRunSummary[];
  gaps?: ComponentPackGapRunSummary[];
  lateSelections?: ComponentPackLateSelectionRunSummary[];
}

export interface ComponentPackSelectionRunSummary {
  role: string;
  componentId: string;
  componentName: string;
  reason: string;
  regionIds: string[];
  required: boolean;
  hydrated: boolean;
  hydrationBatchIds: string[];
  resolutionStatus?: 'resolved' | 'partial' | 'unverified';
  variants: string[];
}

export interface ComponentPackGapRunSummary {
  role: string;
  reason: string;
  regionIds: string[];
}

export interface ComponentPackLateSelectionRunSummary {
  sequence: number;
  action: 'add' | 'replace';
  role: string;
  componentId: string;
  replacedComponentId?: string;
  reason: string;
  regionIds: string[];
  resolutionStatus: 'resolved' | 'partial' | 'unverified';
}
