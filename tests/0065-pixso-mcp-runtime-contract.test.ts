import { expect, test } from 'bun:test';

import { parseConfig, type SberDesignerConfig } from '../packages/llm-gateway/src/config';
import { normalizeMcpServers } from '../services/api/src/mcp/config';
import { ProductMcpManager, type ProductMcpRuntimeClient } from '../services/api/src/mcp/manager';
import { adaptMcpTools, mcpToolName } from '../services/api/src/mcp/tool-adapter';

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

function manyTools(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: `tool_${index}`,
    description: `Tool ${index}`,
    inputSchema: { type: 'object' as const, properties: {} },
  }));
}

test('talk-to-pixso large inventory exposes first 64 tools with truncation warning', () => {
  const [server] = normalizeMcpServers(
    configWith({
      'talk-to-pixso-mcp': {
        type: 'remote',
        url: 'https://pixso-mcp.online/mcp',
      },
    }),
  );

  const result = adaptMcpTools({
    servers: [server!],
    inventories: { 'talk-to-pixso-mcp': { tools: manyTools(129) } },
    callTool: async () => ({ ok: true }),
  });

  expect(result.tools).toHaveLength(64);
  expect(result.tools[0]?.name).toBe(mcpToolName('talk_to_pixso_mcp', 'tool_0'));
  expect(result.tools[63]?.name).toBe(mcpToolName('talk_to_pixso_mcp', 'tool_63'));
  expect(result.tools.some((tool) => tool.name.endsWith('__tool_64'))).toBe(false);
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'mcp_tools_truncated',
      message: 'Only the first 64 MCP tools are available for this server. 65 tools are hidden.',
    }),
  );
});

test('allowedTools order and disabledTools are applied before the first-64 limit', () => {
  const [server] = normalizeMcpServers(
    configWith({
      pixso: {
        type: 'streamable-http',
        url: 'http://127.0.0.1:3667/mcp',
        allowedTools: ['tool_80', 'tool_2', 'missing', 'tool_1'],
        disabledTools: ['tool_2'],
      },
    }),
  );

  const result = adaptMcpTools({
    servers: [server!],
    inventories: { pixso: { tools: manyTools(100) } },
    callTool: async () => ({ ok: true }),
  });

  expect(result.diagnostics).toEqual([]);
  expect(result.tools.map((tool) => tool.name)).toEqual([
    mcpToolName('pixso', 'tool_80'),
    mcpToolName('pixso', 'tool_1'),
  ]);
});

class ManyToolsClient implements ProductMcpRuntimeClient {
  async connect(): Promise<void> {}
  async close(): Promise<void> {}
  async listTools() {
    return { tools: manyTools(129) };
  }
  async callTool(): Promise<unknown> {
    return { ok: true };
  }
}

test('prompt block reports exposed and hidden MCP tool counts with canonical names', async () => {
  const manager = new ProductMcpManager({
    loadConfig: async () =>
      configWith({
        'talk-to-pixso-mcp': {
          type: 'remote',
          url: 'https://pixso-mcp.online/mcp',
        },
      }),
    loadProject: async () => ({
      version: 1,
      name: 'Prompt MCP project',
      workspacePath: '/workspace',
      screens: [],
      flow: [],
    }),
    createClient: async () => new ManyToolsClient(),
  });

  await manager.connectServer('talk-to-pixso-mcp');
  const connected = await manager.getConnectedInventories();

  expect(connected.promptBlock).toContain('129 upstream tools');
  expect(connected.promptBlock).toContain('64 exposed');
  expect(connected.promptBlock).toContain('65 hidden');
  expect(connected.promptBlock).toContain(
    'Only the first 64 MCP tools are available for this server. 65 tools are hidden.',
  );
  expect(connected.promptBlock).toContain('mcp__talk_to_pixso_mcp__tool_0');
});
