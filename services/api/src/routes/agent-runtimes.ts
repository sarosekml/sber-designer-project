import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import { defaultRuntimeProbeCwd, detectRuntime } from '../agent-runtimes/detection';
import { AGENT_RUNTIME_DEFS, getAgentRuntimeDef } from '../agent-runtimes/registry';
import {
  createAgentRuntimeStore,
  createStoredRuntimeStatus,
  mergeConnectionState,
  type AgentRuntimeStore,
  type RuntimeConnectionRecord,
} from '../agent-runtimes/store';
import type { AgentRuntimeKind, AgentRuntimeStatus } from '../agent-runtimes/types';
import { authMode, getAuthStore } from '../auth';
import { enabledCliRuntimeKinds } from '../auth/system-settings';
import { getState } from '../state-store';

const ConnectSchema = z
  .object({
    model: z.string().optional(),
  })
  .strict();

const SelectModelSchema = z
  .object({
    model: z.string().min(1),
  })
  .strict();

export const agentRuntimesRouter = new Hono()
  .use('/:kind/*', runtimeAvailabilityGuard())
  .get('/', async (c) => {
    const enabledKinds = await readEnabledRuntimeKinds();
    const statuses = await listStoredRuntimeStatuses(enabledKinds);
    return c.json({ runtimes: statuses, enabledKinds });
  })
  .get('/status', async (c) => c.json(await getRuntimeStatusEnvelope()))
  .get('/:kind/status', async (c) => {
    const kind = parseRuntimeKind(c.req.param('kind') ?? '');
    if (!kind) return c.json({ error: 'runtime_not_found' }, 404);
    return c.json(await getRuntimeStatusEnvelope(kind));
  })
  .post('/:kind/refresh', async (c) => {
    const kind = parseRuntimeKind(c.req.param('kind') ?? '');
    if (!kind) return c.json({ error: 'runtime_not_found' }, 404);
    const def = getAgentRuntimeDef(kind);
    if (!def) return c.json({ error: 'runtime_not_found' }, 404);
    const detected = await detectRuntime(def, {}, runtimeDetectionContext());
    const store = createAgentRuntimeStore();
    const state = await store.read();
    const record = state.agentRuntimes[kind];
    return c.json({ runtime: await synchronizeDetectedRuntime(store, detected, record) });
  })
  .post('/:kind/connect', async (c) => {
    const kind = parseRuntimeKind(c.req.param('kind'));
    if (!kind) return c.json({ error: 'runtime_not_found' }, 404);
    const raw = await c.req.json().catch(() => ({}));
    const parsed = ConnectSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'invalid_input', detail: parsed.error.message }, 400);
    }
    const def = getAgentRuntimeDef(kind);
    if (!def) return c.json({ error: 'runtime_not_found' }, 404);
    const detected = await detectRuntime(def, {}, runtimeDetectionContext());
    if (!detected.installed || !detected.command) {
      return c.json(
        { error: 'runtime_not_found', detail: `${detected.displayName} was not found.` },
        404,
      );
    }
    if (detected.auth.status !== 'ready') {
      return c.json(
        {
          error: 'runtime_not_authenticated',
          detail: `${detected.displayName} is installed but no authenticated account was detected.`,
        },
        409,
      );
    }
    const store = createAgentRuntimeStore();
    const state = await store.read();
    if (kind === 'gigacode' && detected.models.length === 0) {
      return c.json(
        {
          error: 'runtime_models_unavailable',
          detail: 'GigaCode did not expose any usable chat models. Refresh after GigaCode updates.',
        },
        409,
      );
    }
    if (
      kind === 'gigacode' &&
      parsed.data.model &&
      !detected.models.some((model) => model.id === parsed.data.model)
    ) {
      return c.json(
        {
          error: 'runtime_model_unavailable',
          detail: 'The requested GigaCode model is not present in the current catalogue.',
        },
        400,
      );
    }
    const selectedModel = selectDetectedRuntimeModel(detected, {
      requested: parsed.data.model,
      stored: state.agentRuntimes[kind]?.selectedModel,
      fallback: def.fallbackModels?.[0]?.id,
    });
    await store.connect(kind, runtimeConnectionRecord(detected, selectedModel));
    const nextState = await store.read();
    return c.json({
      runtime: mergeConnectionState(detected, nextState.agentRuntimes[kind]),
    });
  })
  .post('/:kind/disconnect', async (c) => {
    const kind = parseRuntimeKind(c.req.param('kind'));
    if (!kind) return c.json({ error: 'runtime_not_found' }, 404);
    const def = getAgentRuntimeDef(kind);
    if (!def) return c.json({ error: 'runtime_not_found' }, 404);
    const store = createAgentRuntimeStore();
    await store.disconnect(kind);
    const nextState = await store.read();
    return c.json({
      runtime: createStoredRuntimeStatus(
        def,
        nextState.agentRuntimes[kind] ?? { connected: false },
      ),
    });
  })
  .post('/:kind/model', async (c) => {
    const kind = parseRuntimeKind(c.req.param('kind'));
    if (!kind) return c.json({ error: 'runtime_not_found' }, 404);
    const raw = await c.req.json().catch(() => ({}));
    const parsed = SelectModelSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'invalid_input', detail: parsed.error.message }, 400);
    }
    const def = getAgentRuntimeDef(kind);
    if (!def) return c.json({ error: 'runtime_not_found' }, 404);
    const store = createAgentRuntimeStore();
    const state = await store.read();
    const record = state.agentRuntimes[kind];
    if (kind === 'gigacode' && !record?.models?.some((model) => model.id === parsed.data.model)) {
      return c.json(
        {
          error: 'runtime_model_unavailable',
          detail: 'The requested GigaCode model is not present in the connected catalogue.',
        },
        400,
      );
    }
    await store.selectModel(kind, parsed.data.model);
    const nextState = await store.read();
    return c.json({
      runtime: createStoredRuntimeStatus(
        def,
        nextState.agentRuntimes[kind] ?? { connected: false },
      ),
    });
  });

export async function listStoredRuntimeStatuses(
  enabledKinds?: readonly AgentRuntimeKind[],
): Promise<AgentRuntimeStatus[]> {
  const enabled = new Set(enabledKinds ?? (await readEnabledRuntimeKinds()));
  const store = createAgentRuntimeStore();
  const state = await store.read();
  const statuses = AGENT_RUNTIME_DEFS.flatMap((def) => {
    const record = state.agentRuntimes[def.kind];
    if (!record || (!record.connected && !record.command && !record.selectedModel)) return [];
    return [createStoredRuntimeStatus(def, record)];
  });
  return filterEnabledRuntimeItems(statuses, [...enabled]);
}

export async function getStoredRuntimeStatus(
  kind: AgentRuntimeKind,
): Promise<AgentRuntimeStatus | null> {
  if (!(await isCliRuntimeEnabled(kind))) return null;
  const def = getAgentRuntimeDef(kind);
  if (!def) return null;
  const store = createAgentRuntimeStore();
  const state = await store.read();
  const record = state.agentRuntimes[kind];
  if (!record) return null;
  return createStoredRuntimeStatus(def, record);
}

export async function listRuntimeStatuses(): Promise<AgentRuntimeStatus[]> {
  return listStoredRuntimeStatuses();
}

export async function getRuntimeStatusEnvelope(kind?: AgentRuntimeKind): Promise<{
  runtimes: AgentRuntimeStatus[];
  enabledKinds: AgentRuntimeKind[];
  workspacePath: string | null;
  checkedAt: number;
}> {
  const enabledKinds = await readEnabledRuntimeKinds();
  const statuses = await listStoredRuntimeStatuses(enabledKinds);
  return {
    runtimes: kind ? statuses.filter((status) => status.kind === kind) : statuses,
    enabledKinds,
    workspacePath: getState().workspacePath ?? null,
    checkedAt: Date.now(),
  };
}

export async function isCliRuntimeEnabled(kind: AgentRuntimeKind): Promise<boolean> {
  return (await readEnabledRuntimeKinds()).includes(kind);
}

export function filterEnabledRuntimeItems<T extends { kind: AgentRuntimeKind }>(
  items: T[],
  enabledKinds: readonly AgentRuntimeKind[],
): T[] {
  const enabled = new Set(enabledKinds);
  return items.filter((item) => enabled.has(item.kind));
}

export function runtimeDisabledError(
  kind: AgentRuntimeKind,
  enabled: boolean,
): { error: 'runtime_disabled'; detail: string } | null {
  if (enabled) return null;
  return {
    error: 'runtime_disabled',
    detail: `${getAgentRuntimeDef(kind)?.displayName ?? kind} is disabled by an administrator.`,
  };
}

async function readEnabledRuntimeKinds(): Promise<AgentRuntimeKind[]> {
  if (authMode() === 'local') return AGENT_RUNTIME_DEFS.map((runtime) => runtime.kind);
  const settings = await getAuthStore().readSystemSettings();
  return enabledCliRuntimeKinds(settings);
}

function runtimeAvailabilityGuard(): MiddlewareHandler {
  return async (c, next) => {
    const kind = parseRuntimeKind(c.req.param('kind') ?? '');
    if (!kind) {
      await next();
      return;
    }
    const disabled = runtimeDisabledError(kind, await isCliRuntimeEnabled(kind));
    if (disabled) return c.json(disabled, 403);
    await next();
  };
}

function parseRuntimeKind(raw: string): AgentRuntimeKind | null {
  const def = getAgentRuntimeDef(raw);
  return def?.kind ?? null;
}

function runtimeDetectionContext(): { cwd: string | null; probeCwd: string } {
  return {
    cwd: getState().workspacePath ?? null,
    probeCwd: runtimeProbeCwd(),
  };
}

function runtimeProbeCwd(): string {
  return defaultRuntimeProbeCwd();
}

export function runtimeCanStayConnected(status: AgentRuntimeStatus): boolean {
  return Boolean(
    status.installed &&
    status.command &&
    status.auth.status === 'ready' &&
    (status.kind !== 'gigacode' || status.models.length > 0),
  );
}

export async function synchronizeDetectedRuntime(
  store: AgentRuntimeStore,
  status: AgentRuntimeStatus,
  record: RuntimeConnectionRecord | undefined,
): Promise<AgentRuntimeStatus> {
  if (!record?.connected) return mergeConnectionState(status, record);
  if (!runtimeCanStayConnected(status)) {
    await store.disconnect(status.kind);
  } else {
    const selectedModel = selectDetectedRuntimeModel(status, {
      stored: record.selectedModel,
    });
    await store.connect(status.kind, runtimeConnectionRecord(status, selectedModel));
  }
  const nextState = await store.read();
  return mergeConnectionState(status, nextState.agentRuntimes[status.kind]);
}

export function selectDetectedRuntimeModel(
  status: AgentRuntimeStatus,
  candidates: {
    requested?: string | undefined;
    stored?: string | undefined;
    fallback?: string | undefined;
  },
): string | undefined {
  const authoritative = status.kind === 'gigacode' && status.models.length > 0;
  const available = new Set(status.models.map((model) => model.id));
  for (const candidate of [
    candidates.requested,
    candidates.stored,
    status.selectedModel,
    status.models[0]?.id,
    candidates.fallback,
  ]) {
    if (!candidate) continue;
    if (!authoritative || available.has(candidate)) return candidate;
  }
  return undefined;
}

function runtimeConnectionRecord(
  status: AgentRuntimeStatus & { command: string | null },
  selectedModel: string | undefined,
): Omit<RuntimeConnectionRecord, 'connected' | 'connectedAt'> {
  return {
    ...(status.command ? { command: status.command } : {}),
    ...(selectedModel ? { selectedModel } : {}),
    models: status.models,
    mcpServers: status.mcpServers,
    authProviders: status.auth.providers,
    diagnostics: status.diagnostics,
    lastDetectedVersion: status.version,
    ...(status.launch ? { launch: status.launch } : {}),
  };
}
