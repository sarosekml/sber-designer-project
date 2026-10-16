import { expect, test } from 'bun:test';
import type { SberDesignerProject } from '@sber-designer/shared-types';

import { parseConfig, type SberDesignerConfig } from '../packages/llm-gateway/src/config';
import { ProductMcpManager, type ProductMcpRuntimeClient } from '../services/api/src/mcp/manager';
import { createMcpRouter } from '../services/api/src/routes/mcp';

function configWith(mcpServers: Record<string, unknown>): SberDesignerConfig {
  return parseConfig({
    agent: { default: { provider: 'mock', model: 'echo' } },
    provider: {
      mock: {
        type: 'mock',
        name: 'Mock',
        models: { echo: { name: 'echo' } },
      },
    },
    mcpServers,
  });
}

function project(): SberDesignerProject {
  return {
    version: 1,
    name: 'MCP tool override project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
  };
}

class ToolOverrideClient implements ProductMcpRuntimeClient {
  async connect(): Promise<void> {}
  async close(): Promise<void> {}
  async listTools() {
    return {
      tools: [
        { name: 'tool_0', description: 'Tool 0', inputSchema: { type: 'object' as const } },
        { name: 'tool_1', description: 'Tool 1', inputSchema: { type: 'object' as const } },
        { name: 'tool_2', description: 'Tool 2', inputSchema: { type: 'object' as const } },
      ],
    };
  }
  async callTool(): Promise<unknown> {
    return { ok: true };
  }
}

class LargeToolOverrideClient implements ProductMcpRuntimeClient {
  async connect(): Promise<void> {}
  async close(): Promise<void> {}
  async listTools() {
    return {
      tools: Array.from({ length: 68 }, (_, index) => ({
        name: `tool_${index}`,
        description: `Tool ${index}`,
        inputSchema: { type: 'object' as const },
      })),
    };
  }
  async callTool(): Promise<unknown> {
    return { ok: true };
  }
}

function saveExplicitToolSelection(projectRef: { current: SberDesignerProject }) {
  return async (server: { key: string; configHash: string }, selectedTools: string[]) => {
    projectRef.current = {
      ...projectRef.current,
      mcpSettings: {
        serverOverrides: {
          [server.key]: {
            enabled: true,
            configHash: server.configHash,
            updatedAt: 2,
            toolSelection: {
              mode: 'explicit' as const,
              selectedTools,
              updatedAt: 2,
            },
          },
        },
      },
    };
    return projectRef.current;
  };
}

test('per-tool runtime overrides remove tools from exposed MCP summaries', async () => {
  const activeProject = { current: project() };
  const manager = new ProductMcpManager({
    loadConfig: async () =>
      configWith({
        pixso: {
          type: 'streamable-http',
          url: 'http://127.0.0.1:3667/mcp',
        },
      }),
    loadProject: async () => activeProject.current,
    saveOverride: async (server, enabled) => {
      activeProject.current = {
        ...activeProject.current,
        mcpSettings: {
          serverOverrides: {
            [server.key]: { enabled, configHash: server.configHash, updatedAt: 1 },
          },
        },
      };
      return activeProject.current;
    },
    saveToolSelection: saveExplicitToolSelection(activeProject),
    resetToolOverrides: async (server) => {
      activeProject.current = {
        ...activeProject.current,
        mcpSettings: {
          serverOverrides: {
            [server.key]: { enabled: true, configHash: server.configHash, updatedAt: 3 },
          },
        },
      };
      return activeProject.current;
    },
    createClient: async () => new ToolOverrideClient(),
  });

  await manager.connectServer('pixso');
  let summary = await manager.setToolRuntimeEnabled('pixso', 'tool_1', false);

  expect(summary.servers[0]?.toolCount).toBe(2);
  expect(summary.servers[0]).toMatchObject({
    selectionMode: 'explicit',
    selectedToolCount: 2,
    discoveredToolCount: 3,
  });
  expect(summary.servers[0]?.tools.find((tool) => tool.name === 'tool_1')).toMatchObject({
    enabled: false,
    runtimeDisabled: true,
    canToggle: true,
    canonicalName: 'mcp__pixso__tool_1',
  });

  summary = await manager.resetToolRuntimeOverrides('pixso');
  expect(summary.servers[0]?.toolCount).toBe(3);
  expect(summary.servers[0]).toMatchObject({ selectionMode: 'auto', selectedToolCount: 3 });
  expect(summary.servers[0]?.tools.find((tool) => tool.name === 'tool_1')).toMatchObject({
    enabled: true,
    runtimeDisabled: false,
  });
});

test('explicit selection never auto-fills disabled tools and can refill chosen slots', async () => {
  const activeProject = { current: project() };
  const manager = new ProductMcpManager({
    loadConfig: async () =>
      configWith({
        pixso: {
          type: 'streamable-http',
          url: 'http://127.0.0.1:3667/mcp',
        },
      }),
    loadProject: async () => activeProject.current,
    saveToolSelection: saveExplicitToolSelection(activeProject),
    createClient: async () => new LargeToolOverrideClient(),
  });

  await manager.connectServer('pixso');
  let summary = await manager.setToolRuntimeEnabled('pixso', 'tool_0', false);
  expect(summary.servers[0]).toMatchObject({
    selectionMode: 'explicit',
    toolCount: 63,
    selectedToolCount: 63,
    discoveredToolCount: 68,
  });
  expect(summary.servers[0]?.tools.find((tool) => tool.name === 'tool_64')).toMatchObject({
    enabled: false,
    hiddenByLimit: false,
    canToggle: true,
    blockedBySelectionLimit: false,
  });

  for (const toolName of ['tool_1', 'tool_2', 'tool_3']) {
    summary = await manager.setToolRuntimeEnabled('pixso', toolName, false);
  }
  expect(summary.servers[0]).toMatchObject({ toolCount: 60, selectedToolCount: 60 });

  for (const toolName of ['tool_64', 'tool_65', 'tool_66', 'tool_67']) {
    summary = await manager.setToolRuntimeEnabled('pixso', toolName, true);
  }
  const tools = summary.servers[0]?.tools ?? [];

  expect(summary.servers[0]).toMatchObject({ toolCount: 64, selectedToolCount: 64 });
  expect(tools.find((tool) => tool.name === 'tool_67')).toMatchObject({
    enabled: true,
    hiddenByLimit: false,
    canToggle: true,
  });
  expect(tools.find((tool) => tool.name === 'tool_0')).toMatchObject({
    enabled: false,
    hiddenByLimit: false,
    canToggle: false,
    blockedBySelectionLimit: true,
  });
});

test('tool override routes update server status and reject config-disabled tool enablement', async () => {
  const activeProject = { current: project() };
  const manager = new ProductMcpManager({
    loadConfig: async () =>
      configWith({
        pixso: {
          type: 'streamable-http',
          url: 'http://127.0.0.1:3667/mcp',
          disabledTools: ['tool_2'],
        },
      }),
    loadProject: async () => activeProject.current,
    saveToolSelection: saveExplicitToolSelection(activeProject),
    resetToolOverrides: async (server) => {
      activeProject.current = {
        ...activeProject.current,
        mcpSettings: {
          serverOverrides: {
            [server.key]: { enabled: true, configHash: server.configHash, updatedAt: 3 },
          },
        },
      };
      return activeProject.current;
    },
    createClient: async () => new ToolOverrideClient(),
  });
  const router = createMcpRouter(manager);

  await manager.connectServer('pixso');
  const disabled = await router.request('http://localhost/pixso/tools/tool_0/enabled', {
    method: 'PATCH',
    body: JSON.stringify({ enabled: false }),
    headers: { 'content-type': 'application/json' },
  });
  const disabledBody = (await disabled.json()) as { servers: Array<{ toolCount: number }> };
  expect(disabled.status).toBe(200);
  expect(disabledBody.servers[0]?.toolCount).toBe(1);

  const configDisabled = await router.request('http://localhost/pixso/tools/tool_2/enabled', {
    method: 'PATCH',
    body: JSON.stringify({ enabled: true }),
    headers: { 'content-type': 'application/json' },
  });
  expect(configDisabled.status).toBe(409);
  expect(await configDisabled.json()).toMatchObject({ error: 'mcp_tool_disabled_in_config' });

  const reset = await router.request('http://localhost/pixso/tools/overrides', {
    method: 'DELETE',
  });
  const resetBody = (await reset.json()) as { servers: Array<{ toolCount: number }> };
  expect(reset.status).toBe(200);
  expect(resetBody.servers[0]?.toolCount).toBe(2);
});

test('tool override route rejects enabling a 65th selected tool until another tool is disabled', async () => {
  const activeProject = { current: project() };
  const manager = new ProductMcpManager({
    loadConfig: async () =>
      configWith({
        pixso: {
          type: 'streamable-http',
          url: 'http://127.0.0.1:3667/mcp',
        },
      }),
    loadProject: async () => activeProject.current,
    saveToolSelection: saveExplicitToolSelection(activeProject),
    createClient: async () => new LargeToolOverrideClient(),
  });
  const router = createMcpRouter(manager);

  await manager.connectServer('pixso');
  const blocked = await router.request('http://localhost/pixso/tools/tool_64/enabled', {
    method: 'PATCH',
    body: JSON.stringify({ enabled: true }),
    headers: { 'content-type': 'application/json' },
  });

  expect(blocked.status).toBe(409);
  expect(await blocked.json()).toMatchObject({
    error: 'mcp_tool_selection_limit_reached',
    detail: 'Disable another tool before enabling this one.',
  });

  const disabled = await router.request('http://localhost/pixso/tools/tool_0/enabled', {
    method: 'PATCH',
    body: JSON.stringify({ enabled: false }),
    headers: { 'content-type': 'application/json' },
  });
  expect(disabled.status).toBe(200);

  const enabled = await router.request('http://localhost/pixso/tools/tool_64/enabled', {
    method: 'PATCH',
    body: JSON.stringify({ enabled: true }),
    headers: { 'content-type': 'application/json' },
  });
  const enabledBody = (await enabled.json()) as { servers: Array<{ toolCount: number }> };
  expect(enabled.status).toBe(200);
  expect(enabledBody.servers[0]?.toolCount).toBe(64);
});

test('tool override route keeps at least one MCP tool selected', async () => {
  const activeProject = { current: project() };
  const manager = new ProductMcpManager({
    loadConfig: async () =>
      configWith({
        pixso: {
          type: 'streamable-http',
          url: 'http://127.0.0.1:3667/mcp',
          allowedTools: ['tool_0'],
        },
      }),
    loadProject: async () => activeProject.current,
    saveToolSelection: saveExplicitToolSelection(activeProject),
    createClient: async () => new ToolOverrideClient(),
  });
  const router = createMcpRouter(manager);

  await manager.connectServer('pixso');
  const blocked = await router.request('http://localhost/pixso/tools/tool_0/enabled', {
    method: 'PATCH',
    body: JSON.stringify({ enabled: false }),
    headers: { 'content-type': 'application/json' },
  });

  expect(blocked.status).toBe(409);
  expect(await blocked.json()).toMatchObject({
    error: 'mcp_tool_selection_minimum_reached',
    detail: 'At least one MCP tool must stay enabled.',
  });
});
