import { randomUUID } from 'node:crypto';

import type { AgentRunRuntimeSessionDiagnostics } from '../agent/run-recorder';
import type {
  AgentRuntimeDef,
  AgentRuntimeKind,
  AgentRuntimeRunSession,
  AgentRuntimeStatus,
} from './types';
import type { AgentKitRuntimeSessionContext } from './agent-kit-handoff';

export interface AgentRuntimeSessionPlan {
  runSession: AgentRuntimeRunSession | null;
  handoffSession: AgentKitRuntimeSessionContext | null;
  diagnostics?: AgentRunRuntimeSessionDiagnostics;
}

export interface AgentRuntimeSessionMetadata {
  runtimeSessionId?: unknown;
  runtimeSessionRuntime?: unknown;
  runtimeSessionModel?: unknown;
  runtimeSessionWorkspacePath?: unknown;
  runtimeSessionUsage?: unknown;
  runtimeSessionUpdatedAt?: unknown;
  lastRunMetrics?: unknown;
}

const CODEX_SESSION_MAX_IDLE_MS = 30 * 60 * 1_000;

export function planAgentRuntimeSession(input: {
  def: AgentRuntimeDef;
  capabilities: Pick<
    AgentRuntimeStatus['capabilities'],
    'sessionSpecify' | 'sessionResume' | 'sessionCapture'
  >;
  sessionMetadata?: AgentRuntimeSessionMetadata | null;
  model: string | null;
  workspacePath: string | null;
  createSessionId?: () => string;
  now?: () => number;
}): AgentRuntimeSessionPlan {
  if (!input.def.session) {
    return { runSession: null, handoffSession: null };
  }

  const normalizedModel = normalizeRuntimeSessionModel(input.model);
  const normalizedWorkspacePath = normalizeWorkspacePath(input.workspacePath);
  const existing = readRuntimeSessionMetadata(input.sessionMetadata);
  const resumeMissReason = runtimeSessionResumeMissReason({
    existing,
    runtime: input.def.kind,
    model: normalizedModel,
    workspacePath: normalizedWorkspacePath,
    now: input.now?.() ?? Date.now(),
  });
  const canResume = Boolean(
    input.capabilities.sessionResume &&
    existing.sessionId &&
    existing.runtime === input.def.kind &&
    existing.model === normalizedModel &&
    existing.workspacePath === normalizedWorkspacePath &&
    resumeMissReason !== 'idle_expired',
  );

  if (canResume) {
    return sessionPlan({
      def: input.def,
      mode: 'resume',
      sessionId: existing.sessionId!,
      model: normalizedModel,
      workspacePath: normalizedWorkspacePath,
      source: 'metadata',
      resumeUsed: true,
      captureSeen: true,
      usageBaseline:
        readRuntimeUsageBaseline(input.sessionMetadata?.runtimeSessionUsage) ??
        readRuntimeUsageBaseline(input.sessionMetadata?.lastRunMetrics),
    });
  }

  if (input.def.session.style === 'specify') {
    if (!input.capabilities.sessionSpecify) {
      return unavailableSessionPlan({
        def: input.def,
        model: normalizedModel,
        workspacePath: normalizedWorkspacePath,
        missReason: 'capability_unavailable',
      });
    }
    return sessionPlan({
      def: input.def,
      mode: 'new',
      sessionId: input.createSessionId?.() ?? randomUUID(),
      model: normalizedModel,
      workspacePath: normalizedWorkspacePath,
      source: 'new',
      resumeUsed: false,
      captureSeen: true,
      ...(resumeMissReason && resumeMissReason !== 'metadata_missing'
        ? { missReason: resumeMissReason }
        : {}),
    });
  }

  if (!input.capabilities.sessionCapture) {
    return unavailableSessionPlan({
      def: input.def,
      model: normalizedModel,
      workspacePath: normalizedWorkspacePath,
      missReason: 'capability_unavailable',
    });
  }
  return sessionPlan({
    def: input.def,
    mode: 'new',
    model: normalizedModel,
    workspacePath: normalizedWorkspacePath,
    source: 'new',
    resumeUsed: false,
    captureSeen: false,
    missReason:
      resumeMissReason && resumeMissReason !== 'metadata_missing'
        ? resumeMissReason
        : 'capture_event_pending',
  });
}

export function runtimeSessionMetadataFromDiagnostics(
  diagnostics: AgentRunRuntimeSessionDiagnostics | null | undefined,
): Record<string, unknown> {
  if (!diagnostics?.sessionId?.trim()) return {};
  return {
    runtimeSessionId: diagnostics.sessionId.trim(),
    runtimeSessionRuntime: diagnostics.runtime,
    runtimeSessionModel: diagnostics.model ?? null,
    runtimeSessionWorkspacePath: diagnostics.workspacePath ?? null,
    ...(diagnostics.cumulativeUsage ? { runtimeSessionUsage: diagnostics.cumulativeUsage } : {}),
    runtimeSessionUpdatedAt: diagnostics.updatedAt ?? new Date().toISOString(),
  };
}

export function updateRuntimeSessionFromEvent(input: {
  current?: AgentRunRuntimeSessionDiagnostics;
  event: string;
  data: Record<string, unknown>;
}): AgentRunRuntimeSessionDiagnostics | null {
  const current = input.current;
  if (!current || current.style !== 'capture') return null;
  if (input.event === 'runtime.usage.cumulative') {
    const eventRuntime = runtimeKindValue(input.data.runtime);
    if (eventRuntime && eventRuntime !== current.runtime) return null;
    const cumulativeUsage = readRuntimeUsageBaseline(input.data);
    if (!cumulativeUsage) return null;
    return {
      ...current,
      cumulativeUsage,
      updatedAt: new Date().toISOString(),
    };
  }
  if (input.event !== 'runtime.session' && input.event !== current.captureEvent) return null;
  const eventRuntime = runtimeKindValue(input.data.runtime);
  if (eventRuntime && eventRuntime !== current.runtime) return null;
  const sessionId = stringValue(input.data.sessionId) ?? stringValue(input.data.threadId);
  if (!sessionId) return null;
  const { missReason: _missReason, ...currentWithoutMissReason } = current;
  return {
    ...currentWithoutMissReason,
    sessionId,
    source: 'runtime-event',
    captureSeen: true,
    updatedAt: new Date().toISOString(),
  };
}

function sessionPlan(input: {
  def: AgentRuntimeDef;
  mode: 'new' | 'resume';
  sessionId?: string;
  model: string | null;
  workspacePath: string | null;
  source: AgentRunRuntimeSessionDiagnostics['source'];
  resumeUsed: boolean;
  captureSeen?: boolean;
  missReason?: AgentRunRuntimeSessionDiagnostics['missReason'];
  usageBaseline?: AgentRuntimeRunSession['usageBaseline'];
}): AgentRuntimeSessionPlan {
  const runSession: AgentRuntimeRunSession = input.sessionId
    ? {
        mode: input.mode,
        sessionId: input.sessionId,
        ...(input.usageBaseline ? { usageBaseline: input.usageBaseline } : {}),
      }
    : { mode: input.mode, ...(input.usageBaseline ? { usageBaseline: input.usageBaseline } : {}) };
  const handoffSession: AgentKitRuntimeSessionContext = {
    mode: input.mode,
    runtime: input.def.kind,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(input.workspacePath ? { workspacePath: input.workspacePath } : {}),
  };
  return {
    runSession,
    handoffSession,
    diagnostics: {
      runtime: input.def.kind,
      style: input.def.session!.style,
      mode: input.mode,
      resumeUsed: input.resumeUsed,
      model: input.model,
      workspacePath: input.workspacePath,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      source: input.source,
      ...(input.captureSeen !== undefined ? { captureSeen: input.captureSeen } : {}),
      ...(input.missReason ? { missReason: input.missReason } : {}),
      ...(input.def.session!.captureEvent ? { captureEvent: input.def.session!.captureEvent } : {}),
      updatedAt: new Date().toISOString(),
    },
  };
}

function unavailableSessionPlan(input: {
  def: AgentRuntimeDef;
  model: string | null;
  workspacePath: string | null;
  missReason: NonNullable<AgentRunRuntimeSessionDiagnostics['missReason']>;
}): AgentRuntimeSessionPlan {
  if (!input.def.session) return { runSession: null, handoffSession: null };
  return {
    runSession: null,
    handoffSession: null,
    diagnostics: {
      runtime: input.def.kind,
      style: input.def.session.style,
      mode: 'new',
      resumeUsed: false,
      model: input.model,
      workspacePath: input.workspacePath,
      source: 'new',
      captureSeen: false,
      missReason: input.missReason,
      ...(input.def.session.captureEvent ? { captureEvent: input.def.session.captureEvent } : {}),
      updatedAt: new Date().toISOString(),
    },
  };
}

function runtimeSessionResumeMissReason(input: {
  existing: ReturnType<typeof readRuntimeSessionMetadata>;
  runtime: AgentRuntimeKind;
  model: string | null;
  workspacePath: string | null;
  now: number;
}): AgentRunRuntimeSessionDiagnostics['missReason'] | undefined {
  if (!input.existing.sessionId) return 'metadata_missing';
  if (input.existing.runtime !== input.runtime) return 'runtime_mismatch';
  if (input.existing.model !== input.model) return 'model_mismatch';
  if (input.existing.workspacePath !== input.workspacePath) return 'workspace_mismatch';
  if (
    input.runtime === 'codex' &&
    input.existing.updatedAt !== null &&
    input.now - input.existing.updatedAt > CODEX_SESSION_MAX_IDLE_MS
  ) {
    return 'idle_expired';
  }
  return undefined;
}

function readRuntimeSessionMetadata(metadata: AgentRuntimeSessionMetadata | null | undefined): {
  sessionId: string | null;
  runtime: AgentRuntimeKind | null;
  model: string | null;
  workspacePath: string | null;
  updatedAt: number | null;
} {
  return {
    sessionId: stringValue(metadata?.runtimeSessionId),
    runtime: runtimeKindValue(metadata?.runtimeSessionRuntime),
    model: normalizeRuntimeSessionModel(stringValue(metadata?.runtimeSessionModel)),
    workspacePath: normalizeWorkspacePath(stringValue(metadata?.runtimeSessionWorkspacePath)),
    updatedAt: timestampValue(metadata?.runtimeSessionUpdatedAt),
  };
}

function normalizeRuntimeSessionModel(model: string | null | undefined): string | null {
  const trimmed = model?.trim();
  return trimmed && trimmed !== 'default' ? trimmed : null;
}

function normalizeWorkspacePath(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function runtimeKindValue(value: unknown): AgentRuntimeKind | null {
  return value === 'opencode' ||
    value === 'claude-code' ||
    value === 'codex' ||
    value === 'kimi' ||
    value === 'gigacode'
    ? value
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function timestampValue(value: unknown): number | null {
  const timestamp = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

function readRuntimeUsageBaseline(value: unknown): AgentRuntimeRunSession['usageBaseline'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const metrics = value as Record<string, unknown>;
  const inputTokens = tokenCount(metrics.inputTokens);
  const outputTokens = tokenCount(metrics.outputTokens);
  const totalTokens = tokenCount(metrics.totalTokens);
  const costUsd = tokenCount(metrics.costUsd);
  if (
    inputTokens === undefined &&
    outputTokens === undefined &&
    totalTokens === undefined &&
    costUsd === undefined
  ) {
    return undefined;
  }
  return {
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {}),
    ...(costUsd !== undefined ? { costUsd } : {}),
  };
}

function tokenCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}
