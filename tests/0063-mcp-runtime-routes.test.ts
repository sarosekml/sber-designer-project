import { expect, test } from 'bun:test';

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

class RouteFakeMcpClient implements ProductMcpRuntimeClient {
  async connect(): Promise<void> {}
  async close(): Promise<void> {}
  async listTools() {
    return {
      tools: [
        {
          name: 'read_frame',
          description: 'Read selected frame.',
          inputSchema: { type: 'object' as const, properties: {} },
        },
      ],
    };
  }
  async callTool(): Promise<unknown> {
    return { content: [{ type: 'text', text: 'ok' }], isError: false };
  }
}

test('runtime MCP routes connect, list tools, restart, and disconnect servers', async () => {
  const manager = new ProductMcpManager({
    loadConfig: async () =>
      configWith({
        pixso: {
          type: 'streamable-http',
          url: 'http://127.0.0.1:3667/mcp',
          headers: { Authorization: 'Bearer secret' },
        },
      }),
    loadProject: async () => ({
      version: 1,
      name: 'Route project',
      workspacePath: '/workspace',
      screens: [],
      flow: [],
    }),
    createClient: async () => new RouteFakeMcpClient(),
  });
  const router = createMcpRouter(manager);

  const connected = await router.request('http://localhost/pixso/connect', { method: 'POST' });
  const connectedBody = (await connected.json()) as {
    servers: Array<{ key: string; toolCount: number; config: Record<string, unknown> }>;
  };
  expect(connected.status).toBe(200);
  expect(connectedBody.servers[0]).toMatchObject({ key: 'pixso', toolCount: 1 });
  expect(JSON.stringify(connectedBody)).not.toContain('secret');

  const tools = await router.request('http://localhost/pixso/tools');
  expect(await tools.json()).toMatchObject({
    key: 'pixso',
    tools: [expect.objectContaining({ name: 'read_frame' })],
  });

  const restarted = await router.request('http://localhost/pixso/restart', { method: 'POST' });
  expect(restarted.status).toBe(200);

  const disconnected = await router.request('http://localhost/pixso/disconnect', {
    method: 'POST',
  });
  const disconnectedBody = (await disconnected.json()) as {
    servers: Array<{ status: { transport: string } }>;
  };
  expect(disconnectedBody.servers[0]?.status.transport).toBe('not_connected');
});

test('runtime MCP route rejects connecting a config-disabled server', async () => {
  const manager = new ProductMcpManager({
    loadConfig: async () =>
      configWith({
        pixso: {
          type: 'streamable-http',
          url: 'http://127.0.0.1:3667/mcp',
          enabled: false,
        },
      }),
    loadProject: async () => ({
      version: 1,
      name: 'Route project',
      workspacePath: '/workspace',
      screens: [],
      flow: [],
    }),
    createClient: async () => new RouteFakeMcpClient(),
  });
  const router = createMcpRouter(manager);

  const response = await router.request('http://localhost/pixso/connect', { method: 'POST' });
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ error: 'mcp_server_disabled_in_config' });
});
