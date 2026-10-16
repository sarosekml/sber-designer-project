import { expect, test } from 'bun:test';

import { parseConfig, type SberDesignerConfig } from '../packages/llm-gateway/src/config';
import { loadAgentToolsForContext } from '../services/api/src/agent/toolset';
import {
  ProductMcpManager,
  resetProductMcpManagerForTests,
  setProductMcpManagerForTests,
  type ProductMcpRuntimeClient,
} from '../services/api/src/mcp/manager';

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

class BrokerClient implements ProductMcpRuntimeClient {
  calls: unknown[] = [];
  async connect(): Promise<void> {}
  async close(): Promise<void> {}
  async listTools() {
    return {
      tools: [
        { name: 'read_frame', description: 'Read selected frame.' },
        { name: 'write_frame', description: 'Write selected frame.' },
      ],
    };
  }
  async callTool(input: { name: string; arguments: unknown }): Promise<unknown> {
    this.calls.push(input);
    return { ok: true, name: input.name, arguments: input.arguments };
  }
}

test('product MCP broker tools list and call connected MCP tools', async () => {
  const client = new BrokerClient();
  const manager = new ProductMcpManager({
    loadConfig: async () =>
      configWith({
        pixso: {
          type: 'streamable-http',
          url: 'http://127.0.0.1:3667/mcp',
        },
      }),
    loadProject: async () => ({
      version: 1,
      name: 'Broker project',
      workspacePath: '/workspace',
      screens: [],
      flow: [],
    }),
    createClient: async () => client,
  });

  setProductMcpManagerForTests(manager);
  try {
    const tools = await loadAgentToolsForContext({
      user: 'test-user',
      projectName: 'Broker project',
      activeScreen: null,
      workspacePath: '/workspace',
      canvasUrl: null,
    });
    const list = tools.find((tool) => tool.name === 'list_product_mcp_tools');
    const call = tools.find((tool) => tool.name === 'call_product_mcp_tool');

    expect(list).toBeDefined();
    expect(call).toBeDefined();

    const listed = (await list?.handler({ serverKey: 'pixso' }, {} as never)) as {
      servers: Array<{ tools: Array<{ name: string; canonicalName: string }> }>;
    };
    expect(listed.servers[0]?.tools).toContainEqual(
      expect.objectContaining({
        name: 'read_frame',
        canonicalName: 'mcp__pixso__read_frame',
      }),
    );

    await expect(
      call?.handler(
        {
          serverKey: 'pixso',
          toolName: 'mcp__pixso__read_frame',
          arguments: { nodeId: '1:2' },
        },
        {} as never,
      ),
    ).resolves.toMatchObject({ ok: true, name: 'read_frame' });
    expect(client.calls).toEqual([{ name: 'read_frame', arguments: { nodeId: '1:2' } }]);
  } finally {
    resetProductMcpManagerForTests();
  }
});
