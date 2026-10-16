import type { AgentPermissionRequest, AgentPermissionResponse } from './stream';
import { appendTimeline } from './run-record/store';

interface PendingPermissionRequest {
  request: AgentPermissionRequest;
  user: string;
  scope: string;
  workspacePath: string | null;
  runId: string | null;
  resolve: (response: AgentPermissionResponse) => void;
  createdAt: number;
  expiresAt: number | null;
  timeout: ReturnType<typeof setTimeout> | null;
}

const pending = new Map<string, PendingPermissionRequest>();
const remembered = new Map<string, AgentPermissionResponse>();
const DEFAULT_PERMISSION_TIMEOUT_MS = 10 * 60 * 1000;

interface PermissionScopeOptions {
  user: string;
  scope?: string | null;
  workspacePath?: string | null;
  runId?: string | null | undefined;
  timeoutMs?: number;
}

export interface PendingAgentPermissionSnapshot extends AgentPermissionRequest {
  status: 'pending';
  createdAt: number;
  expiresAt?: number;
}

export function registerAgentPermissionRequest(
  request: AgentPermissionRequest,
  options: PermissionScopeOptions,
): Promise<AgentPermissionResponse> {
  return new Promise((resolve) => {
    const existing = pending.get(request.id);
    if (existing) {
      if (existing.timeout) clearTimeout(existing.timeout);
      recordPermissionTimeline(existing, 'permission_resolved', {
        decision: 'deny',
        reason: 'superseded',
        elapsedMs: Math.max(0, Date.now() - existing.createdAt),
      });
      existing.resolve({ decision: 'deny', reason: 'abort' });
    }
    const createdAt = Date.now();
    const timeoutMs = permissionTimeoutMs(options.timeoutMs);
    const expiresAt = timeoutMs > 0 ? createdAt + timeoutMs : null;
    const timeout =
      timeoutMs > 0
        ? setTimeout(() => {
            const item = pending.get(request.id);
            if (!item) return;
            pending.delete(request.id);
            recordPermissionTimeline(item, 'permission_timeout', {
              elapsedMs: Math.max(0, Date.now() - item.createdAt),
              reason: 'timeout',
            });
            item.resolve({ decision: 'deny', reason: 'timeout' });
          }, timeoutMs)
        : null;
    timeout?.unref?.();
    const item: PendingPermissionRequest = {
      request,
      user: options.user,
      scope: resolveScope(options),
      workspacePath: options.workspacePath ?? null,
      runId: options.runId ?? request.runId ?? null,
      resolve,
      createdAt,
      expiresAt,
      timeout,
    };
    pending.set(request.id, item);
    recordPermissionTimeline(item, 'permission_requested');
  });
}

export function resolveAgentPermissionRequest(input: {
  id: string;
  user: string;
  decision: AgentPermissionResponse['decision'];
  remember?: boolean;
}): { ok: true } | { ok: false; reason: 'not_found' } {
  const item = pending.get(input.id);
  if (!item || item.user !== input.user) {
    return { ok: false, reason: 'not_found' };
  }
  pending.delete(input.id);
  if (item.timeout) clearTimeout(item.timeout);
  const response: AgentPermissionResponse = {
    decision: input.decision,
    ...(input.remember ? { remember: true } : {}),
    ...(input.decision === 'deny' ? { reason: 'denied' } : {}),
  };
  if (input.decision === 'allow' && input.remember) {
    remembered.set(rememberKey(item.request, { user: item.user, scope: item.scope }), {
      decision: 'allow',
    });
  }
  recordPermissionTimeline(item, 'permission_resolved', {
    decision: input.decision,
    reason: input.decision === 'deny' ? 'denied' : 'allowed',
    elapsedMs: Math.max(0, Date.now() - item.createdAt),
  });
  item.resolve(response);
  return { ok: true };
}

function permissionTimeoutMs(override: number | undefined): number {
  if (typeof override === 'number' && Number.isFinite(override)) {
    return Math.max(0, override);
  }
  const raw = process.env.SBER_DESIGNER_PERMISSION_TIMEOUT_MS;
  if (!raw) return DEFAULT_PERMISSION_TIMEOUT_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : DEFAULT_PERMISSION_TIMEOUT_MS;
}

export function resolveRememberedAgentPermission(
  request: AgentPermissionRequest,
  options: PermissionScopeOptions,
): AgentPermissionResponse | null {
  const response = remembered.get(rememberKey(request, options));
  return response ? { ...response } : null;
}

export function listPendingAgentPermissionRequests(input: {
  user: string;
}): PendingAgentPermissionSnapshot[] {
  return Array.from(pending.values())
    .filter((item) => item.user === input.user)
    .map((item) => ({
      ...item.request,
      status: 'pending' as const,
      createdAt: item.createdAt,
      ...(item.expiresAt ? { expiresAt: item.expiresAt } : {}),
    }));
}

function rememberKey(
  request: Pick<AgentPermissionRequest, 'category' | 'pattern'>,
  options: PermissionScopeOptions,
): string {
  return [options.user, resolveScope(options), request.category, request.pattern].join('\0');
}

function resolveScope(options: Omit<PermissionScopeOptions, 'user'>): string {
  if (options.scope && options.scope.length > 0) return options.scope;
  if (options.workspacePath && options.runId) {
    return `${options.workspacePath}\0run:${options.runId}`;
  }
  if (options.workspacePath) return options.workspacePath;
  return 'default';
}

function recordPermissionTimeline(
  item: PendingPermissionRequest,
  type: 'permission_requested' | 'permission_resolved' | 'permission_timeout',
  extra: {
    decision?: AgentPermissionResponse['decision'];
    reason?: string;
    elapsedMs?: number;
  } = {},
): void {
  if (!item.workspacePath || !item.runId) return;
  void appendTimeline(item.workspacePath, item.runId, {
    type,
    runId: item.runId,
    createdAt: Date.now(),
    permissionId: item.request.id,
    toolName: item.request.toolName,
    category: item.request.category,
    resource: item.request.resource,
    pattern: item.request.pattern,
    ...(extra.decision ? { decision: extra.decision } : {}),
    ...(extra.reason ? { reason: extra.reason } : {}),
    ...(item.expiresAt ? { expiresAt: item.expiresAt } : {}),
    ...(extra.elapsedMs !== undefined ? { elapsedMs: extra.elapsedMs } : {}),
  }).catch(() => undefined);
}
