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

class AutoConnectClient implements ProductMcpRuntimeClient {
  constructor(private readonly fail = false) {}
  connectCalls = 0;
  async connect(): Promise<void> {
    this.connectCalls += 1;
    if (this.fail) throw new Error('not reachable');
  }
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
    return { ok: true };
  }
}

test('startEnabledServers connects configured MCP servers without a manual connect call', async () => {
  const client = new AutoConnectClient();
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
      name: 'Autoconnect project',
      workspacePath: '/workspace',
      screens: [],
      flow: [],
    }),
    createClient: async () => client,
  });

  const summary = await manager.startEnabledServers({ reason: 'startup' });

  expect(client.connectCalls).toBe(1);
  expect(summary.servers[0]).toMatchObject({
    key: 'pixso',
    status: { transport: 'connected', toolsReady: true },
    toolCount: 1,
  });

  await manager.startEnabledServers({ reason: 'agent' });
  expect(client.connectCalls).toBe(1);
});

test('startEnabledServers records per-server failures without throwing', async () => {
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
      name: 'Autoconnect project',
      workspacePath: '/workspace',
      screens: [],
      flow: [],
    }),
    createClient: async () => new AutoConnectClient(true),
  });

  const summary = await manager.startEnabledServers({ reason: 'startup' });

  expect(summary.servers[0]?.status.transport).toBe('failed');
  expect(summary.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'mcp_runtime_error',
      message: 'not reachable',
    }),
  );
});

test('reload route schedules enabled MCP connection after config reload', async () => {
  const client = new AutoConnectClient();
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
      name: 'Autoconnect project',
      workspacePath: '/workspace',
      screens: [],
      flow: [],
    }),
    createClient: async () => client,
  });
  const router = createMcpRouter(manager);

  const response = await router.request('http://localhost/reload', { method: 'POST' });
  const body = (await response.json()) as { servers: Array<{ status: { transport: string } }> };

  expect(response.status).toBe(200);
  expect(client.connectCalls).toBe(1);
  expect(body.servers[0]?.status.transport).toBe('connected');
});
