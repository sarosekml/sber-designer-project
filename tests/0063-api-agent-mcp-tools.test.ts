import { expect, test } from 'bun:test';

import { parseConfig, type SberDesignerConfig } from '../packages/llm-gateway/src/config';
import { loadMcpToolsForAgentContext } from '../services/api/src/mcp/agent-tools';
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

class AgentFakeMcpClient implements ProductMcpRuntimeClient {
  async connect(): Promise<void> {}
  async close(): Promise<void> {}
  async listTools() {
    return {
      tools: [
        {
          name: 'read_frame',
          description: 'Read selected Pixso frame.',
          inputSchema: { type: 'object' as const, properties: { nodeId: { type: 'string' } } },
        },
      ],
    };
  }
  async callTool(): Promise<unknown> {
    return { content: [{ type: 'text', text: 'ok' }], isError: false };
  }
}

test('loads product-owned MCP tools for API providers and skips CLI runtimes', async () => {
  const manager = new ProductMcpManager({
    loadConfig: async () =>
      configWith({
        'pixso-desktop': {
          type: 'streamable-http',
          url: 'http://127.0.0.1:3667/mcp',
        },
      }),
    loadProject: async () => ({
      version: 1,
      name: 'Agent MCP project',
      workspacePath: '/workspace',
      screens: [],
      flow: [],
    }),
    createClient: async () => new AgentFakeMcpClient(),
  });

  setProductMcpManagerForTests(manager);
  try {
    const apiMode = await loadMcpToolsForAgentContext({
      activeProviderType: 'mock',
      activeAgentName: 'ai-product-designer',
    });
    expect(apiMode.tools.map((tool) => tool.name)).toEqual(['mcp__pixso_desktop__read_frame']);
    expect(apiMode.promptBlock).toContain('## Connected MCP Tools');
    expect(apiMode.promptBlock).toContain(
      'pixso-desktop: connected, namespace pixso_desktop, 1 upstream tools, 1 exposed.',
    );
    expect(apiMode.promptBlock).toContain('mcp__pixso_desktop__read_frame');

    const cliMode = await loadMcpToolsForAgentContext({
      activeProviderType: 'codex-runtime',
      activeAgentName: 'ai-product-designer',
    });
    expect(cliMode.tools).toEqual([]);
    expect(cliMode.promptBlock).toBe('');
  } finally {
    resetProductMcpManagerForTests();
  }
});
