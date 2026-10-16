import { expect, test } from 'bun:test';
import type { SberDesignerProject } from '@sber-designer/shared-types';

import { parseConfig, type SberDesignerConfig } from '../packages/llm-gateway/src/config';
import { ProductMcpManager, type ProductMcpRuntimeClient } from '../services/api/src/mcp/manager';

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

const PROJECT: SberDesignerProject = {
  version: 1,
  name: 'MCP runtime project',
  workspacePath: '/workspace',
  screens: [],
  flow: [],
};

class FakeMcpClient implements ProductMcpRuntimeClient {
  connected = false;
  closed = false;
  calls: unknown[] = [];

  async connect(): Promise<void> {
    this.connected = true;
  }

  async listTools() {
    return {
      tools: [
        {
          name: 'read_frame',
          title: 'Read frame',
          description: 'Read selected Pixso frame.',
          inputSchema: { type: 'object' as const, properties: { nodeId: { type: 'string' } } },
        },
      ],
    };
  }

  async callTool(input: { name: string; arguments: unknown }): Promise<unknown> {
    this.calls.push(input);
    return { content: [{ type: 'text', text: 'ok' }], isError: false };
  }

  async close(): Promise<void> {
    this.closed = true;
    this.connected = false;
  }
}

class InstructionMcpClient extends FakeMcpClient {
  override async connect() {
    this.connected = true;
    return {
      serverInfo: { name: 'simple-pixso-mcp', version: '1.2.3' },
      instructions:
        'Use connect_to_pixso with a channel before reading selection.\nAuthorization=Bearer secret-token-123456',
    };
  }
}

test('connects, lists tools, calls tools, and disconnects a configured MCP server', async () => {
  const fake = new FakeMcpClient();
  const manager = new ProductMcpManager({
    loadConfig: async () =>
      configWith({
        'pixso-desktop': {
          type: 'streamable-http',
          url: 'http://127.0.0.1:3667/mcp',
        },
      }),
    loadProject: async () => PROJECT,
    createClient: async () => fake,
  });

  let summary = await manager.getSummary();
  expect(summary.servers[0]).toMatchObject({
    key: 'pixso-desktop',
    status: { transport: 'not_connected', toolsReady: false },
    toolCount: 0,
  });

  summary = await manager.connectServer('pixso-desktop');
  expect(fake.connected).toBe(true);
  expect(summary.servers[0]).toMatchObject({
    status: { transport: 'connected', toolsReady: true },
    toolCount: 1,
  });
  expect(summary.servers[0]?.tools[0]).toMatchObject({
    name: 'read_frame',
    displayName: 'Read frame',
    enabled: true,
  });

  await expect(
    manager.callTool({
      serverKey: 'pixso-desktop',
      toolName: 'read_frame',
      input: { nodeId: '1:2' },
    }),
  ).resolves.toMatchObject({ isError: false });
  expect(fake.calls).toEqual([{ name: 'read_frame', arguments: { nodeId: '1:2' } }]);

  summary = await manager.disconnectServer('pixso-desktop');
  expect(fake.closed).toBe(true);
  expect(summary.servers[0]?.status.transport).toBe('not_connected');
});

test('stores redacted MCP server instructions for status and prompt inventory', async () => {
  const manager = new ProductMcpManager({
    loadConfig: async () =>
      configWith({
        'talk-to-pixso-mcp': {
          type: 'remote',
          url: 'https://pixso-mcp.online/mcp',
        },
      }),
    loadProject: async () => PROJECT,
    createClient: async () => new InstructionMcpClient(),
  });

  const summary = await manager.connectServer('talk-to-pixso-mcp');
  expect(summary.servers[0]?.serverInfo).toMatchObject({
    name: 'simple-pixso-mcp',
    version: '1.2.3',
  });
  expect(summary.servers[0]?.serverInfo?.instructions).toContain('connect_to_pixso');
  expect(summary.servers[0]?.serverInfo?.instructions).toContain('Authorization=[redacted-secret]');
  expect(summary.servers[0]?.serverInfo?.instructions).not.toContain('secret-token-123456');

  const inventory = await manager.getConnectedInventories();
  expect(inventory.promptBlock).toContain('Server instructions:');
  expect(inventory.promptBlock).toContain('Use connect_to_pixso');
  expect(inventory.promptBlock).not.toContain('secret-token-123456');
});

test('reload closes stale clients when config hash changes', async () => {
  let cfg = configWith({
    pixso: {
      type: 'streamable-http',
      url: 'http://127.0.0.1:3667/mcp',
    },
  });
  const clients: FakeMcpClient[] = [];
  const manager = new ProductMcpManager({
    loadConfig: async () => cfg,
    loadProject: async () => PROJECT,
    createClient: async () => {
      const client = new FakeMcpClient();
      clients.push(client);
      return client;
    },
  });

  await manager.connectServer('pixso');
  cfg = configWith({
    pixso: {
      type: 'streamable-http',
      url: 'http://127.0.0.1:3668/mcp',
    },
  });

  const summary = await manager.reload();
  expect(clients[0]?.closed).toBe(true);
  expect(summary.servers[0]).toMatchObject({
    status: { transport: 'not_connected', toolsReady: false },
    toolCount: 0,
  });
});
