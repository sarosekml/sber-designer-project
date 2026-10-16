import type { SberDesignerConfig } from '@sber-designer/llm-gateway';
import type { SberDesignerProject } from '@sber-designer/shared-types';

import { loadConfig, reloadConfig } from '../config-store';
import { getProject } from '../project-store';
import { normalizeMcpServers } from './config';
import { createMcpRuntimeClient } from './client';
import {
  applyMcpServerOverrides,
  resetMcpToolOverrides,
  saveMcpServerOverride,
  saveMcpToolSelection,
} from './overrides';
import { redactMcpInstructions, redactMcpServerConfig } from './redaction';
import { isRemoteMcpServer, validateMcpServerPolicy } from './security';
import { mcpToolName } from './tool-adapter';
import {
  DEFAULT_MAX_MCP_TOOLS_PER_SERVER,
  mcpToolsTruncatedDiagnostic,
  mcpToolsTruncatedMessage,
  selectMcpTools,
} from './tool-selection';
import type {
  McpDiagnostic,
  McpFrontendSummary,
  McpToolSummary,
  McpTransportStatus,
  NormalizedMcpServer,
  ProductMcpRuntimeServerInfo,
  ProductMcpRuntimeTool,
} from './types';

export interface ProductMcpRuntimeConnectionInfo {
  serverInfo?: {
    name?: string;
    version?: string;
  };
  instructions?: string;
}

export interface ProductMcpRuntimeClient {
  connect(): Promise<ProductMcpRuntimeConnectionInfo | void>;
  listTools(): Promise<{
    tools: Array<{
      name: string;
      title?: string;
      description?: string;
      inputSchema?: Record<string, unknown>;
    }>;
  }>;
  callTool(input: { name: string; arguments: unknown }): Promise<unknown>;
  close(): Promise<void>;
}

export interface ProductMcpManagerOptions {
  loadConfig?: () => Promise<SberDesignerConfig>;
  reloadConfig?: () => Promise<SberDesignerConfig>;
  loadProject?: () => Promise<SberDesignerProject | null> | SberDesignerProject | null;
  createClient?: (
    server: NormalizedMcpServer,
  ) => Promise<ProductMcpRuntimeClient> | ProductMcpRuntimeClient;
  saveOverride?: (server: NormalizedMcpServer, enabled: boolean) => Promise<SberDesignerProject>;
  saveToolSelection?: (
    server: NormalizedMcpServer,
    selectedTools: string[],
  ) => Promise<SberDesignerProject>;
  resetToolOverrides?: (server: NormalizedMcpServer) => Promise<SberDesignerProject>;
}

interface RuntimeServerState {
  server: NormalizedMcpServer;
  status: McpTransportStatus;
  diagnostics: McpDiagnostic[];
  client?: ProductMcpRuntimeClient;
  inventory?: { tools: ProductMcpRuntimeTool[] };
  serverInfo?: ProductMcpRuntimeServerInfo;
  lastConnectedAt?: string;
  lastError?: string;
  connectingPromise?: Promise<McpFrontendSummary>;
}

export interface ProductMcpConnectedInventories {
  servers: NormalizedMcpServer[];
  inventories: Record<string, { tools: ProductMcpRuntimeTool[] } | undefined>;
  diagnostics: McpDiagnostic[];
  promptBlock: string;
}

export class ProductMcpManagerError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class ProductMcpManager {
  private states = new Map<string, RuntimeServerState>();
  private readonly loadConfigFn: () => Promise<SberDesignerConfig>;
  private readonly reloadConfigFn: () => Promise<SberDesignerConfig>;
  private readonly loadProjectFn: () =>
    | Promise<SberDesignerProject | null>
    | SberDesignerProject
    | null;
  private readonly createClientFn: (
    server: NormalizedMcpServer,
  ) => Promise<ProductMcpRuntimeClient> | ProductMcpRuntimeClient;
  private readonly saveOverrideFn: (
    server: NormalizedMcpServer,
    enabled: boolean,
  ) => Promise<SberDesignerProject>;
  private readonly saveToolSelectionFn: (
    server: NormalizedMcpServer,
    selectedTools: string[],
  ) => Promise<SberDesignerProject>;
  private readonly resetToolOverridesFn: (
    server: NormalizedMcpServer,
  ) => Promise<SberDesignerProject>;

  constructor(options: ProductMcpManagerOptions = {}) {
    this.loadConfigFn = options.loadConfig ?? loadConfig;
    this.reloadConfigFn = options.reloadConfig ?? options.loadConfig ?? reloadConfig;
    this.loadProjectFn = options.loadProject ?? (() => getProject());
    this.createClientFn = options.createClient ?? createMcpRuntimeClient;
    this.saveOverrideFn = options.saveOverride ?? saveMcpServerOverride;
    this.saveToolSelectionFn = options.saveToolSelection ?? saveMcpToolSelection;
    this.resetToolOverridesFn = options.resetToolOverrides ?? resetMcpToolOverrides;
  }

  async getSummary(): Promise<McpFrontendSummary> {
    await this.syncServers();
    return this.summary();
  }

  async reload(): Promise<McpFrontendSummary> {
    await this.syncServers(await this.reloadConfigFn());
    return this.summary();
  }

  async startEnabledServers(_options: {
    reason: 'startup' | 'reload' | 'agent';
  }): Promise<McpFrontendSummary> {
    await this.syncServers();
    for (const state of [...this.states.values()]) {
      if (!state.server.enabled) continue;
      if (state.status === 'connected' || state.status === 'connecting') continue;
      await this.connectServer(state.server.key).catch(() => undefined);
    }
    return this.summary();
  }

  async connectServer(key: string): Promise<McpFrontendSummary> {
    await this.syncServers();
    const state = this.requireState(key);
    if (!state.server.configEnabled) {
      throw new ProductMcpManagerError(
        'mcp_server_disabled_in_config',
        `MCP server "${key}" is disabled in sber-designer.json.`,
      );
    }
    if (!state.server.enabled) {
      throw new ProductMcpManagerError(
        'mcp_connect_failed',
        `MCP server "${key}" is disabled by runtime settings.`,
      );
    }
    // 0136 R06 — the policy verdict is checked before the connection is made,
    // not reported after it. Autoconnect, explicit connect and reload all
    // land here, so a project override cannot widen deployment policy.
    const verdict = validateMcpServerPolicy(state.server);
    if (!verdict.allowed) {
      state.status = 'failed';
      state.diagnostics = verdict.diagnostics;
      state.lastError = verdict.diagnostics
        .filter((diagnostic) => diagnostic.level === 'error')
        .map((diagnostic) => diagnostic.message)
        .join(' ');
      throw new ProductMcpManagerError(
        'mcp_policy_denied',
        state.lastError || `MCP server "${key}" is not allowed by policy.`,
      );
    }

    if (state.status === 'connected' && state.client) return this.summary();
    if (state.status === 'connecting' && state.connectingPromise) {
      return state.connectingPromise;
    }
    state.connectingPromise = this.connectState(state).finally(() => {
      delete state.connectingPromise;
    });
    return state.connectingPromise;
  }

  private async connectState(state: RuntimeServerState): Promise<McpFrontendSummary> {
    state.status = 'connecting';
    delete state.lastError;
    try {
      const client = await this.createClientFn(state.server);
      const connectionInfo = await client.connect();
      const inventory = await client.listTools();
      const serverInfo = normalizeRuntimeServerInfo(connectionInfo);
      state.client = client;
      state.inventory = {
        tools: inventory.tools.map((tool) => ({
          name: tool.name,
          ...(tool.title ? { title: tool.title } : {}),
          ...(tool.description ? { description: tool.description } : {}),
          ...(tool.inputSchema ? { inputSchema: tool.inputSchema } : {}),
        })),
      };
      if (serverInfo) state.serverInfo = serverInfo;
      else delete state.serverInfo;
      state.status = 'connected';
      state.lastConnectedAt = new Date().toISOString();
      return this.summary();
    } catch (err) {
      state.status = 'failed';
      state.lastError = err instanceof Error ? err.message : String(err);
      await state.client?.close().catch(() => undefined);
      delete state.client;
      delete state.inventory;
      delete state.serverInfo;
      throw new ProductMcpManagerError(
        'mcp_connect_failed',
        `Failed to connect MCP server "${state.server.key}": ${state.lastError}`,
      );
    }
  }

  async disconnectServer(key: string): Promise<McpFrontendSummary> {
    await this.syncServers();
    const state = this.requireState(key);
    try {
      await state.client?.close();
      delete state.client;
      delete state.inventory;
      delete state.serverInfo;
      state.status = state.server.enabled ? 'not_connected' : 'disabled';
      return this.summary();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      state.status = 'failed';
      state.lastError = detail;
      throw new ProductMcpManagerError(
        'mcp_disconnect_failed',
        `Failed to disconnect MCP server "${key}": ${detail}`,
      );
    }
  }

  async restartServer(key: string): Promise<McpFrontendSummary> {
    await this.disconnectServer(key);
    return this.connectServer(key);
  }

  async setServerRuntimeEnabled(key: string, enabled: boolean): Promise<McpFrontendSummary> {
    await this.syncServers();
    const state = this.requireState(key);
    if (!state.server.configEnabled) {
      throw new ProductMcpManagerError(
        'mcp_server_disabled_in_config',
        `Enable MCP server "${key}" in sber-designer.json first.`,
      );
    }
    await this.saveOverrideFn(state.server, enabled).catch((err) => {
      const detail = err instanceof Error ? err.message : String(err);
      throw new ProductMcpManagerError(
        'mcp_override_save_failed',
        `Failed to save MCP runtime override for "${key}": ${detail}`,
      );
    });
    await this.syncServers();
    if (!enabled) return this.disconnectServer(key);
    return this.connectServer(key);
  }

  async setToolRuntimeEnabled(
    key: string,
    toolName: string,
    enabled: boolean,
  ): Promise<McpFrontendSummary> {
    await this.syncServers();
    let state = this.requireState(key);
    if (!state.inventory) {
      await this.connectServer(key);
      state = this.requireState(key);
    }
    const selectedTools = nextSelectedMcpTools(state, toolName, enabled);
    await this.saveToolSelectionFn(state.server, selectedTools).catch((err) => {
      const detail = err instanceof Error ? err.message : String(err);
      throw new ProductMcpManagerError(
        'mcp_override_save_failed',
        `Failed to save MCP tool selection for "${key}.${toolName}": ${detail}`,
      );
    });
    await this.syncServers();
    return this.summary();
  }

  async resetToolRuntimeOverrides(key: string): Promise<McpFrontendSummary> {
    await this.syncServers();
    const state = this.requireState(key);
    await this.resetToolOverridesFn(state.server).catch((err) => {
      const detail = err instanceof Error ? err.message : String(err);
      throw new ProductMcpManagerError(
        'mcp_override_save_failed',
        `Failed to reset MCP tool overrides for "${key}": ${detail}`,
      );
    });
    await this.syncServers();
    return this.summary();
  }

  async listTools(key: string): Promise<{ key: string; tools: McpToolSummary[] }> {
    await this.syncServers();
    const state = this.requireState(key);
    return {
      key: state.server.key,
      tools: toolsForSummary(state.server, state.inventory?.tools ?? []),
    };
  }

  async callTool(input: { serverKey: string; toolName: string; input: unknown }): Promise<unknown> {
    await this.syncServers();
    let state = this.requireState(input.serverKey);
    // 0136 R06 — re-check at call time as well: a client connected before a
    // config reload tightened the policy must not keep serving tool calls.
    const verdict = validateMcpServerPolicy(state.server);
    if (!verdict.allowed) {
      await state.client?.close().catch(() => undefined);
      delete state.client;
      state.status = 'failed';
      state.diagnostics = verdict.diagnostics;
      throw new ProductMcpManagerError(
        'mcp_policy_denied',
        verdict.diagnostics
          .filter((diagnostic) => diagnostic.level === 'error')
          .map((diagnostic) => diagnostic.message)
          .join(' ') || `MCP server "${input.serverKey}" is not allowed by policy.`,
      );
    }
    if (state.status !== 'connected' || !state.client) {
      await this.connectServer(input.serverKey);
      state = this.requireState(input.serverKey);
    }
    if (!state.client) {
      throw new ProductMcpManagerError(
        'mcp_connect_failed',
        `MCP server "${input.serverKey}" is not connected.`,
      );
    }
    try {
      return await state.client.callTool({ name: input.toolName, arguments: input.input });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`MCP tool "${input.serverKey}.${input.toolName}" failed: ${detail}`);
    }
  }

  async getConnectedInventories(
    options: { connectEnabled?: boolean } = {},
  ): Promise<ProductMcpConnectedInventories> {
    await this.syncServers();
    const diagnostics: McpDiagnostic[] = [];
    if (options.connectEnabled) {
      await this.startEnabledServers({ reason: 'agent' });
    }
    const servers = [...this.states.values()].map((state) => state.server);
    const inventories = Object.fromEntries(
      [...this.states.values()]
        .filter((state) => state.server.enabled && state.status === 'connected')
        .map((state) => [state.server.key, state.inventory]),
    );
    return {
      servers,
      inventories,
      diagnostics,
      promptBlock: formatMcpInventoryPromptBlock([...this.states.values()]),
    };
  }

  async close(): Promise<void> {
    await Promise.all([...this.states.values()].map((state) => state.client?.close()));
    this.states.clear();
  }

  private async syncServers(cfg?: SberDesignerConfig): Promise<void> {
    const config = cfg ?? (await this.loadConfigFn());
    const project = await this.loadProjectFn();
    const servers = applyMcpServerOverrides(normalizeMcpServers(config), project);
    const nextKeys = new Set(servers.map((server) => server.key));

    for (const [key, state] of this.states) {
      const next = servers.find((server) => server.key === key);
      if (!next || next.configHash !== state.server.configHash || !next.enabled) {
        await state.client?.close().catch(() => undefined);
        if (!next) this.states.delete(key);
      }
    }

    for (const server of servers) {
      const previous = this.states.get(server.key);
      const diagnostics = validateMcpServerPolicy(server).diagnostics;
      if (!previous || previous.server.configHash !== server.configHash) {
        this.states.set(server.key, {
          server,
          status: server.enabled ? 'not_connected' : 'disabled',
          diagnostics,
        });
        continue;
      }
      previous.server = server;
      previous.diagnostics = diagnostics;
      if (!server.enabled) {
        previous.status = 'disabled';
        delete previous.inventory;
        delete previous.client;
        delete previous.serverInfo;
      } else if (previous.status === 'disabled') {
        previous.status = 'not_connected';
      }
    }

    for (const key of [...this.states.keys()]) {
      if (!nextKeys.has(key)) this.states.delete(key);
    }
  }

  private summary(): McpFrontendSummary {
    const states = [...this.states.values()];
    const servers = states.map((state) => {
      const inventoryTools = state.inventory?.tools ?? [];
      const exposure = selectMcpTools({
        server: state.server,
        tools: inventoryTools,
        maxToolsPerServer: DEFAULT_MAX_MCP_TOOLS_PER_SERVER,
      });
      const tools = toolsForSummary(state.server, inventoryTools, exposure);
      const truncation = mcpToolsTruncatedDiagnostic(exposure);
      const diagnostics = [
        ...state.diagnostics,
        ...runtimeDiagnostics(state),
        ...(truncation ? [truncation] : []),
      ];
      return {
        key: state.server.key,
        namespace: state.server.namespace,
        transport: state.server.transport,
        enabled: state.server.enabled,
        configEnabled: state.server.configEnabled,
        runtimeEnabled: state.server.runtimeEnabled,
        remote: isRemoteMcpServer(state.server),
        ...(state.server.description ? { description: state.server.description } : {}),
        ...(state.serverInfo ? { serverInfo: state.serverInfo } : {}),
        configHash: state.server.configHash,
        status: {
          transport: state.status,
          upstream: 'n/a' as const,
          toolsReady: state.status === 'connected' && exposure.exposedTools.length > 0,
          ...(state.lastConnectedAt ? { lastConnectedAt: state.lastConnectedAt } : {}),
          ...(state.lastError ? { lastError: state.lastError } : {}),
        },
        toolCount: exposure.exposedTools.length,
        selectionMode: exposure.selectionMode,
        selectionLimit: exposure.limit,
        selectedToolCount: exposure.selectedToolCount,
        discoveredToolCount: exposure.discoveredToolCount,
        tools,
        config: redactMcpServerConfig(state.server.entry),
        diagnostics,
      };
    });
    return {
      servers,
      diagnostics: servers.flatMap((server) => server.diagnostics),
    };
  }

  private requireState(key: string): RuntimeServerState {
    const state = this.states.get(key);
    if (!state)
      throw new ProductMcpManagerError('mcp_server_not_found', `Unknown MCP server "${key}".`);
    return state;
  }
}

function toolsForSummary(
  server: NormalizedMcpServer,
  tools: ProductMcpRuntimeTool[],
  exposure = selectMcpTools({
    server,
    tools,
    maxToolsPerServer: DEFAULT_MAX_MCP_TOOLS_PER_SERVER,
  }),
): McpToolSummary[] {
  return tools.map((tool) => {
    const state = exposure.stateForTool(tool.name);
    return {
      name: tool.name,
      ...(tool.title ? { displayName: tool.title } : {}),
      ...(tool.description ? { description: tool.description } : {}),
      enabled: state.enabled,
      configuredDisabled: state.configuredDisabled,
      runtimeDisabled: state.runtimeDisabled,
      hiddenByLimit: state.hiddenByLimit,
      blockedBySelectionLimit: state.blockedBySelectionLimit,
      blockedBySelectionMinimum: state.blockedBySelectionMinimum,
      canToggle: state.canToggle,
      canonicalName: mcpToolName(server.namespace, tool.name),
      ...(tool.inputSchema ? { inputSchema: tool.inputSchema } : {}),
    };
  });
}

function nextSelectedMcpTools(
  state: RuntimeServerState,
  toolName: string,
  enabled: boolean,
): string[] {
  const inventoryTools = state.inventory?.tools ?? [];
  if (!inventoryTools.some((tool) => tool.name === toolName)) {
    throw new ProductMcpManagerError(
      'mcp_tool_not_found',
      `Unknown MCP tool "${toolName}" on server "${state.server.key}".`,
    );
  }

  const exposure = selectMcpTools({
    server: state.server,
    tools: inventoryTools,
    maxToolsPerServer: DEFAULT_MAX_MCP_TOOLS_PER_SERVER,
  });
  const toolState = exposure.stateForTool(toolName);
  if (toolState.configuredDisabled && enabled) {
    throw new ProductMcpManagerError(
      'mcp_tool_disabled_in_config',
      `MCP tool "${toolName}" is disabled in sber-designer.json.`,
    );
  }

  const selectedTools = exposure.exposedTools.map((tool) => tool.name);
  const isSelected = selectedTools.includes(toolName);
  if (enabled) {
    if (isSelected) return selectedTools;
    if (selectedTools.length >= exposure.limit) {
      throw new ProductMcpManagerError(
        'mcp_tool_selection_limit_reached',
        'Disable another tool before enabling this one.',
      );
    }
    return [...selectedTools, toolName];
  }

  if (!isSelected) return selectedTools;
  if (selectedTools.length <= 1) {
    throw new ProductMcpManagerError(
      'mcp_tool_selection_minimum_reached',
      'At least one MCP tool must stay enabled.',
    );
  }
  return selectedTools.filter((selectedTool) => selectedTool !== toolName);
}

function normalizeRuntimeServerInfo(
  connectionInfo: ProductMcpRuntimeConnectionInfo | void,
): ProductMcpRuntimeServerInfo | undefined {
  const name = connectionInfo?.serverInfo?.name?.trim();
  const version = connectionInfo?.serverInfo?.version?.trim();
  const instructions = connectionInfo?.instructions
    ? redactMcpInstructions(connectionInfo.instructions)
    : undefined;
  if (!name && !version && !instructions) return undefined;
  return {
    ...(name ? { name } : {}),
    ...(version ? { version } : {}),
    ...(instructions ? { instructions } : {}),
  };
}

function runtimeDiagnostics(state: RuntimeServerState | undefined): McpDiagnostic[] {
  if (!state?.lastError) return [];
  return [
    {
      level: 'error',
      code: 'mcp_runtime_error',
      message: state.lastError,
    },
  ];
}

function formatServerInstructionsForPrompt(
  serverInfo: ProductMcpRuntimeServerInfo | undefined,
): string[] {
  if (!serverInfo?.instructions) return [];
  const instructionLines = serverInfo.instructions.split('\n');
  const lines = instructionLines.slice(0, 12).map((line) => `  ${line}`);
  if (instructionLines.length > 12) lines.push('  [instructions truncated]');
  return ['  Server instructions:', ...lines];
}

export function formatMcpInventoryPromptBlock(states: RuntimeServerState[]): string {
  const lines = states.flatMap((state) => {
    if (!state.server.enabled) return [];
    if (!['connected', 'failed', 'connecting'].includes(state.status)) return [];
    if (state.status !== 'connected') {
      const detail = state.lastError ? ` ${state.lastError}` : '';
      return [`- ${state.server.key}: ${state.status}.${detail}`];
    }
    const tools = state.inventory?.tools ?? [];
    const exposure = selectMcpTools({
      server: state.server,
      tools,
      maxToolsPerServer: DEFAULT_MAX_MCP_TOOLS_PER_SERVER,
    });
    const hidden = exposure.hiddenTools.length;
    const hiddenText = hidden > 0 ? `, ${hidden} hidden by the MCP tool limit` : '';
    const exactNames = exposure.exposedTools
      .slice(0, 12)
      .map((tool) => `  - ${mcpToolName(state.server.namespace, tool.name)}`);
    const block = [
      `- ${state.server.key}: connected, namespace ${state.server.namespace}, ${exposure.upstreamCount} upstream tools, ${exposure.exposedTools.length} exposed${hiddenText}.`,
      ...(hidden > 0 ? [`  ${mcpToolsTruncatedMessage(exposure.limit, hidden)}`] : []),
      ...(exactNames.length > 0 ? ['  Use exact names:', ...exactNames] : []),
      ...formatServerInstructionsForPrompt(state.serverInfo),
    ];
    return block;
  });
  if (lines.length === 0) return '';
  return [
    '## Connected MCP Tools',
    '',
    ...lines,
    '',
    'Use MCP tools when the user asks about Pixso/Figma files, selected frames or external design context. MCP namespaces normalize dashes to underscores. If a relevant MCP server is not connected or a tool is hidden by the first-64 limit, say that clearly instead of guessing.',
  ].join('\n');
}

let singleton: ProductMcpManager | null = null;

export function getProductMcpManager(): ProductMcpManager {
  singleton ??= new ProductMcpManager();
  return singleton;
}

export function setProductMcpManagerForTests(manager: ProductMcpManager): void {
  singleton = manager;
}

export function resetProductMcpManagerForTests(): void {
  singleton = null;
}
