import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

import type {
  AgentRuntimeDef,
  AgentRuntimeLaunchStatus,
  AgentRuntimeKind,
  AgentRuntimeMcpServer,
  AgentRuntimeModel,
  AgentRuntimeStatus,
  RuntimeDiagnostic,
} from './types';

export interface RuntimeConnectionRecord {
  connected: boolean;
  command?: string;
  selectedModel?: string;
  models?: AgentRuntimeModel[];
  mcpServers?: AgentRuntimeMcpServer[];
  launch?: AgentRuntimeLaunchStatus;
  authProviders?: string[];
  diagnostics?: RuntimeDiagnostic[];
  connectedAt?: string;
  lastDetectedVersion?: string | null;
}

export interface AgentRuntimeStoreState {
  agentRuntimes: Partial<Record<AgentRuntimeKind, RuntimeConnectionRecord>>;
}

export interface AgentRuntimeStore {
  read(): Promise<AgentRuntimeStoreState>;
  connect(
    kind: AgentRuntimeKind,
    record: Omit<RuntimeConnectionRecord, 'connected' | 'connectedAt'>,
  ): Promise<void>;
  selectModel(kind: AgentRuntimeKind, model: string): Promise<void>;
  disconnect(kind: AgentRuntimeKind): Promise<void>;
}

const EMPTY_STATE: AgentRuntimeStoreState = { agentRuntimes: {} };

export function defaultAgentRuntimeStorePath(): string {
  return (
    process.env.SBER_DESIGNER_AGENT_RUNTIMES_PATH ??
    join(homedir(), '.config', 'sber-designer', 'agent-runtimes.json')
  );
}

export function createAgentRuntimeStore(path = defaultAgentRuntimeStorePath()): AgentRuntimeStore {
  return {
    async read() {
      try {
        const raw = await readFile(path, 'utf8');
        const parsed = JSON.parse(raw) as AgentRuntimeStoreState;
        return {
          agentRuntimes:
            parsed && typeof parsed === 'object' && parsed.agentRuntimes
              ? parsed.agentRuntimes
              : {},
        };
      } catch {
        return EMPTY_STATE;
      }
    },
    async connect(kind, record) {
      const current = await this.read();
      const previous = current.agentRuntimes[kind];
      const next: AgentRuntimeStoreState = {
        agentRuntimes: {
          ...current.agentRuntimes,
          [kind]: {
            ...previous,
            ...record,
            connected: true,
            connectedAt: previous?.connectedAt ?? new Date().toISOString(),
          },
        },
      };
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(next, null, 2), 'utf8');
    },
    async selectModel(kind, model) {
      const current = await this.read();
      const previous = current.agentRuntimes[kind] ?? { connected: false };
      const next: AgentRuntimeStoreState = {
        agentRuntimes: {
          ...current.agentRuntimes,
          [kind]: {
            ...previous,
            selectedModel: model,
            models: ensureModelOption(kind, previous.models, model),
          },
        },
      };
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(next, null, 2), 'utf8');
    },
    async disconnect(kind) {
      const current = await this.read();
      const previous = current.agentRuntimes[kind];
      const next: AgentRuntimeStoreState = {
        agentRuntimes: {
          ...current.agentRuntimes,
          [kind]: { ...previous, connected: false },
        },
      };
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(next, null, 2), 'utf8');
    },
  };
}

export function mergeConnectionState(
  status: AgentRuntimeStatus,
  record: RuntimeConnectionRecord | undefined,
): AgentRuntimeStatus {
  if (!record?.connected) return { ...status, connected: false };
  const authoritativeModels = isAuthoritativeGigaCodeInventory(status.kind, status.models);
  const models = authoritativeModels
    ? status.models
    : mergeModelInventory(
        status.kind,
        status.models,
        record.models,
        record.selectedModel ?? status.selectedModel,
      );
  const selectedModel = firstAvailableModel(
    models,
    record.selectedModel,
    status.selectedModel,
    models[0]?.id,
  );
  return {
    ...status,
    connected: status.installed && status.auth.status === 'ready',
    command: record.command ?? status.command,
    ...((record.launch ?? status.launch) ? { launch: record.launch ?? status.launch! } : {}),
    version: status.version ?? record.lastDetectedVersion ?? null,
    ...(selectedModel !== undefined ? { selectedModel } : {}),
    auth: {
      ...status.auth,
      providers: record.authProviders?.length ? record.authProviders : status.auth.providers,
    },
    models,
    mcpServers: record.mcpServers ?? status.mcpServers,
    diagnostics: status.diagnostics,
  };
}

export function createStoredRuntimeStatus(
  def: AgentRuntimeDef,
  record: RuntimeConnectionRecord,
): AgentRuntimeStatus {
  const command = record.command ?? null;
  const installed = Boolean(command);
  const connected = Boolean(record.connected && command);
  const selectedModel =
    record.selectedModel ?? record.models?.[0]?.id ?? def.fallbackModels?.[0]?.id;
  const hasStoredGigaCodeCatalogue =
    def.kind === 'gigacode' && isAuthoritativeGigaCodeInventory(def.kind, record.models);
  const models = hasStoredGigaCodeCatalogue
    ? (record.models ?? [])
    : mergeModelInventory(def.kind, def.fallbackModels ?? [], record.models, selectedModel);
  const availableSelectedModel = firstAvailableModel(models, selectedModel, models[0]?.id);
  return {
    kind: def.kind,
    displayName: def.displayName,
    installed,
    connected,
    command,
    version: record.lastDetectedVersion ?? null,
    ...(record.launch ? { launch: record.launch } : {}),
    ...(availableSelectedModel ? { selectedModel: availableSelectedModel } : {}),
    auth: {
      status: connected ? 'ready' : 'unknown',
      providers: record.authProviders ?? [],
    },
    models,
    mcpServers: record.mcpServers ?? [],
    capabilities: {
      modelList: Boolean(def.listModels),
      mcpList: Boolean(def.listMcp),
      runJson: def.chatHandoff,
      modelFlag: true,
      promptViaStdin: def.promptViaStdin,
      jsonEventStream: def.streamFormat === 'json-event-stream',
      cancel: connected,
      usesOwnMcpConfig: true,
      supportsProjectMcpHandoff: true,
      chatHandoff: def.chatHandoff,
      includePartialMessages: false,
      sessionSpecify: def.session?.style === 'specify',
      sessionResume: Boolean(def.session),
      sessionCapture: def.session?.style === 'capture',
      ...def.attachmentCapabilities,
    },
    diagnostics: record.diagnostics ?? [],
  };
}

export function isAuthoritativeGigaCodeInventory(
  runtime: AgentRuntimeKind,
  models: AgentRuntimeModel[] | undefined,
): boolean {
  return (
    runtime === 'gigacode' &&
    Boolean(models?.length) &&
    !models?.some((model) => model.id === 'default')
  );
}

function firstAvailableModel(
  models: AgentRuntimeModel[],
  ...candidates: Array<string | undefined>
): string | undefined {
  const ids = new Set(models.map((model) => model.id));
  return candidates.find((candidate): candidate is string =>
    Boolean(candidate && ids.has(candidate)),
  );
}

function mergeModelInventory(
  runtime: AgentRuntimeKind,
  preferred: AgentRuntimeModel[] | undefined,
  fallback: AgentRuntimeModel[] | undefined,
  selectedModel: string | undefined,
): AgentRuntimeModel[] {
  const next: AgentRuntimeModel[] = [];
  const seen = new Set<string>();
  const add = (model: AgentRuntimeModel) => {
    if (!model.id || seen.has(model.id)) return;
    seen.add(model.id);
    next.push(model);
  };
  for (const model of preferred ?? []) add(model);
  for (const model of fallback ?? []) add(model);
  return ensureModelOption(runtime, next, selectedModel);
}

function ensureModelOption(
  runtime: AgentRuntimeKind,
  models: AgentRuntimeModel[] | undefined,
  selectedModel: string | undefined,
): AgentRuntimeModel[] {
  const next = [...(models ?? [])];
  if (!selectedModel || next.some((model) => model.id === selectedModel)) return next;
  next.unshift(createModelOption(runtime, selectedModel));
  return next;
}

function createModelOption(runtime: AgentRuntimeKind, id: string): AgentRuntimeModel {
  const slash = id.indexOf('/');
  const provider = slash > 0 ? id.slice(0, slash) : runtime;
  const model = slash > 0 ? id.slice(slash + 1) : id;
  const prefix =
    runtime === 'opencode'
      ? 'OpenCode'
      : runtime === 'claude-code'
        ? 'Claude Code'
        : runtime === 'kimi'
          ? 'Kimi Code CLI'
          : runtime === 'gigacode'
            ? 'GigaCode'
            : 'Codex CLI';
  return {
    runtime,
    id,
    provider,
    model,
    label: `${prefix} · ${id}`,
  };
}
