import type { AssistantActiveRun, AssistantSessionMode } from '@sber-designer/shared-types';
import {
  DEFAULT_AGENT_CONCURRENCY_LIMITS,
  type AgentConcurrencyLimits,
} from '@sber-designer/llm-gateway';

export type AgentRunRuntimeKind = 'api' | 'cli';

export interface AgentRunAcquireRequest {
  clientRunId: string;
  sessionId: string;
  screenId: string;
  provider: string;
  model: string;
  sessionMode?: AssistantSessionMode;
  displayName?: string;
  runtimeKind: AgentRunRuntimeKind;
  title?: string;
  targetPaths?: string[];
}

export interface AgentRunLease {
  leaseId: string;
  clientRunId: string;
  sessionId: string;
  screenId: string;
  provider: string;
  model: string;
  sessionMode?: AssistantSessionMode;
  displayName?: string;
  runtimeKind: AgentRunRuntimeKind;
  title?: string | undefined;
  targetPaths: string[];
  controller: AbortController;
  startedAt: number;
  updatedAt: number;
  runId?: string;
  runManifestPath?: string;
  status: AssistantActiveRun['status'];
  reason?: string;
}

export type AgentRunAcquireResult =
  | { ok: true; lease: AgentRunLease }
  | {
      ok: false;
      code: string;
      reason: string;
      activeRuns: AssistantActiveRun[];
      blockingRun?: AssistantActiveRun;
    };

export interface AgentRunCoordinator {
  acquire(request: AgentRunAcquireRequest): AgentRunAcquireResult;
  attachRun(leaseId: string, run: { runId: string; runManifestPath?: string }): void;
  cancel(runIdOrLeaseId: string, reason?: string): boolean;
  release(leaseId: string): void;
  activeRuns(): AssistantActiveRun[];
  updateLimits(limits: AgentConcurrencyLimits): void;
  reset(): void;
}

let nextLeaseNumber = 1;

export function createAgentRunCoordinator(
  initialLimits: AgentConcurrencyLimits = DEFAULT_AGENT_CONCURRENCY_LIMITS,
): AgentRunCoordinator {
  let limits = initialLimits;
  const leases = new Map<string, AgentRunLease>();

  const activeLeases = () =>
    Array.from(leases.values()).filter(
      (lease) => lease.status !== 'complete' && lease.status !== 'error',
    );

  return {
    acquire(request) {
      const active = activeLeases();
      const sameScreen = active.find((lease) => lease.screenId === request.screenId);
      if (sameScreen && isBlockingPolicy(limits.sameScreenPolicy)) {
        return reject(
          'same_screen_active',
          'Assistant is already running for this screen.',
          sameScreen,
        );
      }
      const targetPaths = normalizeTargetPaths(request.targetPaths ?? []);
      if (isBlockingPolicy(limits.sameFilePolicy)) {
        const conflictingTarget = findTargetConflict(active, targetPaths);
        if (conflictingTarget) {
          return reject(
            'same_file_active',
            targetConflictReason(conflictingTarget, targetPaths),
            conflictingTarget,
          );
        }
      }
      if (active.length >= limits.maxTotalRuns) {
        return reject('total_capacity_reached', 'Assistant run capacity is full.');
      }
      const sameRuntimeCount = active.filter(
        (lease) => lease.runtimeKind === request.runtimeKind,
      ).length;
      const runtimeLimit = request.runtimeKind === 'cli' ? limits.maxCliRuns : limits.maxApiRuns;
      if (sameRuntimeCount >= runtimeLimit) {
        return reject(
          `${request.runtimeKind}_capacity_reached`,
          `Assistant ${request.runtimeKind.toUpperCase()} run capacity is full.`,
        );
      }

      const now = Date.now();
      const lease: AgentRunLease = {
        leaseId: `lease-${now}-${nextLeaseNumber++}`,
        clientRunId: request.clientRunId,
        sessionId: request.sessionId,
        screenId: request.screenId,
        provider: request.provider,
        model: request.model,
        ...(request.sessionMode ? { sessionMode: request.sessionMode } : {}),
        ...(request.displayName ? { displayName: request.displayName } : {}),
        runtimeKind: request.runtimeKind,
        title: request.title,
        targetPaths,
        controller: new AbortController(),
        startedAt: now,
        updatedAt: now,
        status: 'running',
      };
      leases.set(lease.leaseId, lease);
      return { ok: true, lease };

      function reject(
        code: string,
        reason: string,
        blockingLease?: AgentRunLease,
      ): AgentRunAcquireResult {
        const activeRuns = toActiveRuns(active);
        const blockingRun = blockingLease
          ? activeRuns.find((run) => run.clientRunId === blockingLease.clientRunId)
          : undefined;
        return {
          ok: false,
          code,
          reason,
          activeRuns,
          ...(blockingRun ? { blockingRun } : {}),
        };
      }
    },

    attachRun(leaseId, run) {
      const lease = leases.get(leaseId);
      if (!lease) return;
      lease.runId = run.runId;
      if (run.runManifestPath !== undefined) lease.runManifestPath = run.runManifestPath;
      lease.updatedAt = Date.now();
    },

    cancel(runIdOrLeaseId, reason = 'Cancelled by user.') {
      const lease = Array.from(leases.values()).find(
        (candidate) =>
          candidate.leaseId === runIdOrLeaseId ||
          candidate.runId === runIdOrLeaseId ||
          candidate.clientRunId === runIdOrLeaseId,
      );
      if (!lease) return false;
      lease.status = 'stopping';
      lease.reason = reason;
      lease.updatedAt = Date.now();
      lease.controller.abort(reason);
      return true;
    },

    release(leaseId) {
      leases.delete(leaseId);
    },

    activeRuns() {
      return toActiveRuns(activeLeases());
    },

    updateLimits(nextLimits) {
      limits = nextLimits;
    },

    reset() {
      leases.clear();
    },
  };
}

const singleton = createAgentRunCoordinator();

export function getAgentRunCoordinator(): AgentRunCoordinator {
  return singleton;
}

export function configureAgentRunCoordinator(limits: AgentConcurrencyLimits): AgentRunCoordinator {
  singleton.updateLimits(limits);
  return singleton;
}

function toActiveRuns(leases: AgentRunLease[]): AssistantActiveRun[] {
  return leases.map((lease) => ({
    clientRunId: lease.clientRunId,
    ...(lease.runId !== undefined ? { runId: lease.runId } : {}),
    sessionId: lease.sessionId,
    screenId: lease.screenId,
    provider: lease.provider,
    model: lease.model,
    ...(lease.sessionMode ? { sessionMode: lease.sessionMode } : {}),
    ...(lease.displayName ? { displayName: lease.displayName } : {}),
    status: lease.status,
    startedAt: lease.startedAt,
    updatedAt: lease.updatedAt,
    ...(lease.title !== undefined ? { title: lease.title } : {}),
    ...(lease.reason !== undefined ? { reason: lease.reason } : {}),
    ...(lease.runManifestPath !== undefined ? { runManifestPath: lease.runManifestPath } : {}),
    targetPaths: lease.targetPaths,
  }));
}

function normalizeTargetPaths(paths: string[]): string[] {
  return Array.from(
    new Set(paths.map((path) => path.replace(/\\/gu, '/').replace(/^\.\//u, '')).filter(Boolean)),
  );
}

function isBlockingPolicy(policy: AgentConcurrencyLimits['sameScreenPolicy']): boolean {
  return policy === 'reject' || policy === 'queue';
}

function findTargetConflict(
  active: AgentRunLease[],
  targetPaths: string[],
): AgentRunLease | undefined {
  if (targetPaths.length === 0) return active[0];
  return active.find((lease) => {
    if (lease.targetPaths.length === 0) return true;
    return lease.targetPaths.some((path) => targetPaths.includes(path));
  });
}

function targetConflictReason(conflictingTarget: AgentRunLease, targetPaths: string[]): string {
  if (targetPaths.length === 0 || conflictingTarget.targetPaths.length === 0) {
    return 'Assistant is already running a workspace-wide task.';
  }
  return 'Assistant is already changing one of these files.';
}
