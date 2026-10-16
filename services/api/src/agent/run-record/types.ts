/** Agent run record types: manifest, metrics, receipts, evidence shapes. */
import type {
  AssistantSessionMode,
  ComponentReuseRunSummary,
  DesignBrief,
  DesignDirectionSelection,
  ExternalDesignSourceIntent,
  PromptAttachmentEvidence,
  ProjectProfileContract,
  ScreenStructurePlan,
  RunQualitySummary,
} from '@sber-designer/shared-types';
import type { AgentKitHandoffResult } from '../../agent-runtimes/agent-kit-handoff';
import type { TaskRelevantComponentPack } from '../../component-intelligence/component-pack';
import type { ToolContext } from '../types';

export type AgentRunRoute = 'chat' | 'chat-stream' | 'manual';

export type LegacyAgentRunStatus = 'needs_review';

export type AgentRunStatus = 'running' | 'complete' | 'failed' | 'needs_review' | 'cancelled';

export type WritableAgentRunStatus = 'complete' | 'failed' | 'cancelled';

export type AgentToolReceiptStatus = 'ok' | 'error' | 'skipped';

export type AgentRunRuntimeKind = 'api' | 'cli';

export interface AgentRunTargetCapabilities {
  targetKind: 'api' | 'cli';
  runtimeKind: string;
  imageInputMode: string;
  imageDeliveryMode?: string;
  rasterImageInput: boolean;
  svgSourceInput: boolean;
  nativeFileInput: boolean;
  projectMcpTools: boolean;
  ownMcpConfig: boolean;
  mcpExpectedTargets?: AgentRunMcpExpectedTarget[];
}

export interface AgentRunMcpExpectedTarget {
  server: string;
  transport?: string | null;
  tools?: string[];
  configPath?: string | null;
}

export interface AgentRunManifest {
  version: 1;
  runId: string;
  route: AgentRunRoute;
  user: string;
  provider: string | null;
  model: string | null;
  runtimeKind: AgentRunRuntimeKind | null;
  sessionMode?: AssistantSessionMode;
  modeEnforcement?: 'native' | 'promptOnly';
  projectName: string | null;
  userGoal: string | null;
  workspacePath: string;
  createdAt: number;
  updatedAt: number;
  status: AgentRunStatus;
  activeScreen: CompactActiveScreen | null;
  /** Stable ids attributed from the active target, screen receipts, and changed files. */
  affectedScreenIds?: string[];
  /** Per-screen provenance retained after run folders are pruned. */
  affectedScreenAttribution?: Record<string, 'active-screen' | 'receipt' | 'changed-files'>;
  assistantTaskIntent: ToolContext['assistantTaskIntent'] | null;
  /** Generation mode captured before the agent starts, for live-run evidence. */
  generationMode?: 'standard' | 'wireframe';
  /** Whether this run explicitly requested the Design Jury. */
  designJuryRequested?: boolean;
  designBrief?: DesignBrief;
  directionSelection?: DesignDirectionSelection;
  projectProfile?: ProjectProfileContract;
  targetCapabilities?: AgentRunTargetCapabilities;
  promptAttachments?: PromptAttachmentEvidence[];
  summary?: string;
  diagnostics?: AgentRunDiagnostics;
  metrics?: AgentRunMetrics;
  componentReuse?: ComponentReuseRunSummary;
  completedAt?: number;
}

export interface AgentRunMetrics {
  startedAt: number;
  completedAt: number;
  durationMs: number;
  iterations?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
}

export interface AgentRunDiagnostics {
  iterations?: number;
  truncated?: boolean;
  hadErrors?: boolean;
  stoppedAfterPermissionDeny?: boolean;
  finishReason?: string;
  attemptId?: string;
  attemptLogPath?: string;
  debugLogPath?: string;
  runManifestPath?: string;
  errorCode?: string;
  runtimeLaunch?: AgentRunRuntimeLaunchDiagnostics;
  runtimeMcp?: AgentRunRuntimeMcpToolHealth;
  runtimeModel?: AgentRunRuntimeModelDiagnostics;
  runtimeSession?: AgentRunRuntimeSessionDiagnostics;
  contextBudget?: AgentRunContextBudgetDiagnostics;
  renderProof?: AgentRunRenderProofDiagnostics;
  designJury?: AgentRunDesignJuryDiagnostics;
  qualitySummary?: RunQualitySummary;
}

export interface AgentRunRuntimeModelDiagnostics {
  runtime: string;
  model: string;
  source: string;
}

export interface AgentRunDesignJuryDiagnostics {
  status: 'passed' | 'needs_review' | 'unavailable';
  threshold: number;
  rounds: number;
  revisionAttempted: boolean;
  juryComposite?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  detail?: string;
}

export interface AgentRunRenderProofDiagnostics {
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

export interface AgentRunRuntimeLaunchDiagnostics {
  runtime: string;
  command: string;
  launchPath?: string;
  launchSource?: 'profile' | 'env' | 'path';
  selectedBin?: string;
  args: string[];
  cwd: string;
  workspaceCwd?: string | null;
  probeCwd?: string | null;
  model: string | null;
  version: string | null;
  authStatus: 'unknown' | 'none' | 'ready' | 'failed';
  env: {
    home: string | null;
    pathEntries: number;
    authOverrideNames: string[];
  };
  probe: {
    kind: 'print-mode-auth' | 'smoke' | 'launch';
    ok: boolean;
    code?: string;
    detail: string;
    rawTail?: string;
  };
}

export interface AgentRunRuntimeSessionDiagnostics {
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

export interface AgentRunContextBudgetDiagnostics {
  status: 'ok' | 'warning' | 'degraded' | 'blocked';
  thresholdTokens: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  detail: string;
}

export type AgentRunRuntimeMcpToolHealthStatus =
  | 'forwarded'
  | 'forwarded_verified'
  | 'forwarded_unverified'
  | 'own_config'
  | 'not_supported'
  | 'auth_failed'
  | 'config_invalid'
  | 'unavailable'
  | 'unknown';

export interface AgentRunRuntimeMcpToolHealth {
  runtime: string;
  status: AgentRunRuntimeMcpToolHealthStatus;
  source: 'capabilities' | 'stderr' | 'runtime-event';
  event?: string | null;
  mcpServer?: string | null;
  mcpTool?: string | null;
  expectedTargets?: AgentRunMcpExpectedTarget[];
  detail: string;
}

export interface AgentToolReceipt {
  version: 1;
  runId: string;
  receiptId: string;
  tool: string;
  status: AgentToolReceiptStatus;
  changedFiles: string[];
  summary: string | null;
  metadata: Record<string, unknown>;
  createdAt: number;
}

export interface CreateAgentRunInput {
  route: AgentRunRoute;
  user: string;
  provider?: string | null;
  model?: string | null;
  runtimeKind?: AgentRunRuntimeKind | null;
  sessionMode?: AssistantSessionMode;
  modeEnforcement?: 'native' | 'promptOnly';
  targetCapabilities?: AgentRunTargetCapabilities | undefined;
  projectName?: string | null;
  userGoal?: string | null;
  workspacePath: string;
  activeScreen?: ToolContext['activeScreen'];
  assistantTaskIntent?: ToolContext['assistantTaskIntent'];
  generationMode?: 'standard' | 'wireframe';
  designJuryRequested?: boolean;
  designBrief?: DesignBrief;
  directionSelection?: DesignDirectionSelection;
}

export interface RecordToolReceiptInput {
  workspacePath: string | null;
  runId: string | null | undefined;
  tool: string;
  status: AgentToolReceiptStatus;
  changedFiles?: string[];
  summary?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CompleteAgentRunInput {
  workspacePath: string | null;
  runId: string | null | undefined;
  /** chat-stream built-in finalization still emits the legacy
   *  `needs_review` for uncertain render health; handoff maps it. */
  status: WritableAgentRunStatus | LegacyAgentRunStatus;
  summary?: string;
  diagnostics?: AgentRunDiagnostics;
  metrics?: Partial<AgentRunMetrics>;
}

export interface RecordDesignSourceEvidencePackInput {
  workspacePath: string | null;
  runId: string | null | undefined;
  intent: ExternalDesignSourceIntent;
}

export interface RecordExternalRuntimeContextBundleInput {
  workspacePath: string | null;
  runId: string | null | undefined;
  runtimeLabel: string;
  handoff: AgentKitHandoffResult;
}

export interface RecordComponentPackInput {
  workspacePath: string | null;
  runId: string | null | undefined;
  componentPack: TaskRelevantComponentPack;
}

export interface RecordScreenStructurePlanInput {
  workspacePath: string | null;
  runId: string | null | undefined;
  plan: ScreenStructurePlan;
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
  status: AgentRunStatus;
  provider: string | null;
  model: string | null;
  runtimeKind: AgentRunRuntimeKind | null;
  summary: string | null;
  rootPath: string;
  workspacePath: string;
  generatedAt: number;
  activeScreen: CompactActiveScreen | null;
  activeTarget: AgentRunEvidenceActiveTarget | null;
  diagnostics: AgentRunDiagnostics | null;
  metrics: AgentRunMetrics | null;
  componentReuse: ComponentReuseRunSummary | null;
  receiptSummary: AgentRunEvidenceReceiptSummary;
  pendingPermissions: AgentRunEvidencePendingPermission[];
  lastTimelineEvent: TimelineEvent | null;
  artifacts: AgentRunEvidenceArtifact[];
  externalLogs: AgentRunExternalLog[];
}

export interface AgentRunEvidenceActiveTarget {
  screenId?: string;
  screenName?: string;
  files: string[];
}

export interface AgentRunEvidenceReceiptSummary {
  total: number;
  byStatus: Record<string, number>;
  tools: string[];
  latest: AgentRunEvidenceLatestReceipt | null;
}

export interface AgentRunEvidenceLatestReceipt {
  tool: string;
  status: AgentToolReceiptStatus;
  summary: string | null;
  changedFiles: string[];
  createdAt: number;
}

export interface AgentRunEvidencePendingPermission {
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
}

export interface CompactActiveScreen {
  id: string;
  name: string;
  kind: string;
  surface?: 'page' | 'modal';
  storyId?: string;
  filePath?: string;
  implementationFilePath?: string;
  folder?: string;
  description?: string;
}

export interface TimelineEvent {
  type:
    | 'run_started'
    | 'tool_receipt'
    | 'run_completed'
    | 'run_failed'
    | 'permission_requested'
    | 'permission_resolved'
    | 'permission_timeout';
  runId: string;
  createdAt: number;
  route?: AgentRunRoute;
  receiptId?: string;
  tool?: string;
  status?: AgentRunStatus | AgentToolReceiptStatus;
  changedFiles?: string[];
  summary?: string;
  permissionId?: string;
  toolName?: string;
  category?: string;
  resource?: string;
  pattern?: string;
  decision?: 'allow' | 'deny';
  reason?: string;
  expiresAt?: number;
  elapsedMs?: number;
}
