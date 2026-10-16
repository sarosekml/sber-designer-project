import { expect, test } from 'bun:test';

import { parseConfig } from '../packages/llm-gateway/src/config';

function configWith(mcpServers: Record<string, unknown>) {
  return {
    agent: { default: { provider: 'mock', model: 'echo' } },
    provider: {
      mock: {
        type: 'mock',
        name: 'Mock',
        models: { echo: { name: 'echo' } },
      },
    },
    mcpServers,
  };
}

test('parses standard Pixso Desktop Streamable HTTP MCP config', () => {
  const cfg = parseConfig(
    configWith({
      'pixso-desktop': {
        type: 'streamable-http',
        url: 'http://127.0.0.1:3667/mcp',
        enabled: true,
        description: 'Pixso Desktop local MCP.',
        timeoutMs: 10000,
      },
    }),
  );

  expect(cfg.mcpServers['pixso-desktop']).toMatchObject({
    type: 'streamable-http',
    url: 'http://127.0.0.1:3667/mcp',
    enabled: true,
    timeoutMs: 10000,
  });
});

test('parses first-party talk-to-pixso stdio config with safety fields', () => {
  const cfg = parseConfig(
    configWith({
      'talk-to-pixso': {
        type: 'stdio',
        command: 'bun',
        args: ['run', 'mcp:serve'],
        cwd: '/Users/dev/Work Dev/simple-pixso-mcp',
        env: { WS_HUB_PORT: '3055' },
        enabled: true,
        timeoutMs: 100000,
        requiresApproval: true,
        allowedTools: ['connect_to_pixso', 'get_node_info'],
        connectTool: {
          tool: 'connect_to_pixso',
          requiresChannel: false,
        },
        toolSafety: {
          get_node_info: 'read',
          batch_create: 'write',
          export_node_as_image: 'disk-write',
        },
        diskWriteRoot: '.sber-designer/runs',
        healthTools: ['get_runtime_diagnostics'],
      },
    }),
  );

  expect(cfg.mcpServers['talk-to-pixso']).toMatchObject({
    type: 'stdio',
    command: 'bun',
    cwd: '/Users/dev/Work Dev/simple-pixso-mcp',
    requiresApproval: true,
    allowedTools: ['connect_to_pixso', 'get_node_info'],
    connectTool: { tool: 'connect_to_pixso', requiresChannel: false },
    toolSafety: {
      get_node_info: 'read',
      batch_create: 'write',
      export_node_as_image: 'disk-write',
    },
  });
});

test('accepts Streamable HTTP aliases and resolves header env refs', () => {
  const cfg = parseConfig(
    configWith({
      legacy: {
        type: 'http',
        url: 'http://127.0.0.1:8080/mcp',
        headers: { authorization: '{env:MCP_TOKEN}' },
      },
      remote: {
        type: 'remote',
        url: 'https://mcp.example.test/mcp',
      },
      camel: {
        type: 'streamableHttp',
        url: 'http://127.0.0.1:8081/mcp',
      },
    }),
    { env: { MCP_TOKEN: 'secret-token' } },
  );

  expect(cfg.mcpServers.legacy).toMatchObject({
    type: 'http',
    headers: { authorization: 'secret-token' },
  });
  expect(cfg.mcpServers.remote?.type).toBe('remote');
  expect(cfg.mcpServers.camel?.type).toBe('streamableHttp');
});

test('rejects OpenCode local MCP shape in sber-designer config', () => {
  expect(() =>
    parseConfig(
      configWith({
        pixso: {
          type: 'local',
          command: ['bun', 'run', 'mcp:serve'],
        },
      }),
    ),
  ).toThrow();
});
