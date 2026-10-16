import { expect, test } from 'bun:test';

import { parseConfig } from '../packages/llm-gateway/src/config';
import {
  normalizeMcpServers,
  redactMcpServerConfig,
  summarizeMcpServersForFrontend,
} from '../services/api/src/mcp/config';
import { assertMcpServerAllowed, validateMcpServerPolicy } from '../services/api/src/mcp/security';

const SIMPLE_PIXSO_MCP_ROOT = '/Users/dev/Work Dev/simple-pixso-mcp';

function configWith(mcpServers: Record<string, unknown>) {
  return parseConfig(
    {
      agent: { default: { provider: 'mock', model: 'echo' } },
      provider: {
        mock: {
          type: 'mock',
          name: 'Mock',
          models: { echo: { name: 'echo' } },
        },
      },
      mcpServers,
    },
    {
      env: { PIXSO_TOKEN: 'secret-token' },
      strictEnv: false,
    },
  );
}

test('normalizes MCP servers and rejects duplicate tool namespaces', () => {
  const cfg = configWith({
    'talk-to-pixso': {
      type: 'stdio',
      command: 'bun',
      args: ['run', 'dist/server.js'],
      cwd: SIMPLE_PIXSO_MCP_ROOT,
    },
    'pixso-desktop': {
      type: 'streamable-http',
      url: 'http://127.0.0.1:18412/mcp',
    },
  });

  const servers = normalizeMcpServers(cfg, {
    allowedFilesystemRoots: [SIMPLE_PIXSO_MCP_ROOT],
  });

  expect(servers.map((server) => server.namespace)).toEqual(['talk_to_pixso', 'pixso_desktop']);
  expect(servers[0]?.transport).toBe('stdio');
  expect(servers[1]?.transport).toBe('streamable-http');

  expect(() =>
    normalizeMcpServers(
      configWith({
        'talk-to-pixso': { type: 'streamable-http', url: 'http://127.0.0.1:18412/mcp' },
        talk_to_pixso: { type: 'streamable-http', url: 'http://127.0.0.1:18413/mcp' },
      }),
    ),
  ).toThrow(/Duplicate MCP namespace/);
});

test('redacts secret MCP env and headers while keeping status metadata useful', () => {
  const cfg = configWith({
    'talk-to-pixso': {
      type: 'stdio',
      command: 'bun',
      args: ['run', 'dist/server.js'],
      cwd: SIMPLE_PIXSO_MCP_ROOT,
      env: { PIXSO_TOKEN: '{env:PIXSO_TOKEN}', EMPTY_VALUE: '' },
    },
    remote: {
      type: 'remote',
      url: 'http://localhost:3333/mcp',
      headers: { Authorization: 'Bearer very-secret' },
    },
  });

  expect(redactMcpServerConfig(cfg.mcpServers['talk-to-pixso']!)).toMatchObject({
    env: { PIXSO_TOKEN: '__configured__', EMPTY_VALUE: '__missing__' },
  });
  expect(redactMcpServerConfig(cfg.mcpServers.remote!)).toMatchObject({
    headers: { Authorization: '__configured__' },
  });

  const summary = summarizeMcpServersForFrontend(cfg, {
    allowedFilesystemRoots: [SIMPLE_PIXSO_MCP_ROOT],
  });

  expect(summary.servers).toHaveLength(2);
  expect(summary.servers[0]).toMatchObject({
    key: 'talk-to-pixso',
    namespace: 'talk_to_pixso',
    configEnabled: true,
    runtimeEnabled: true,
    enabled: true,
    status: { transport: 'not_connected' },
    toolCount: 0,
    tools: [],
    config: { env: { PIXSO_TOKEN: '__configured__' } },
  });
  expect('trusted' in summary.servers[0]!).toBe(false);
  expect(JSON.stringify(summary)).not.toContain('secret-token');
  expect(JSON.stringify(summary)).not.toContain('very-secret');
});

test('treats manual MCP config as consent without trusted hash state', () => {
  const cfg = configWith({
    'talk-to-pixso': {
      type: 'stdio',
      command: 'bun',
      args: ['run', 'dist/server.js'],
      cwd: SIMPLE_PIXSO_MCP_ROOT,
      env: { PIXSO_TOKEN: 'secret-token' },
    },
  });
  const summary = summarizeMcpServersForFrontend(cfg, {
    allowedFilesystemRoots: [SIMPLE_PIXSO_MCP_ROOT],
  });

  expect(summary.servers[0]).toMatchObject({
    key: 'talk-to-pixso',
    configEnabled: true,
    runtimeEnabled: true,
    enabled: true,
    status: {
      transport: 'not_connected',
      toolsReady: false,
    },
  });
  expect(summary.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain('mcp_not_trusted');
});

test('manual MCP config emits diagnostics instead of blocking paths or public URLs', () => {
  const cfg = configWith({
    'talk-to-pixso': {
      type: 'stdio',
      command: 'bun',
      args: ['run', 'dist/server.js'],
      cwd: SIMPLE_PIXSO_MCP_ROOT,
      envFile: '.env.local',
      diskWriteRoot: SIMPLE_PIXSO_MCP_ROOT,
    },
    outside: {
      type: 'stdio',
      command: 'bun',
      args: ['run', 'server.js'],
      cwd: '/tmp/not-the-product-mcp',
    },
    public: {
      type: 'streamable-http',
      url: 'https://example.com/mcp',
    },
  });
  const servers = normalizeMcpServers(cfg, {
    allowedFilesystemRoots: [SIMPLE_PIXSO_MCP_ROOT],
  });

  expect(() =>
    assertMcpServerAllowed(servers.find((server) => server.key === 'talk-to-pixso')!, {
      allowedFilesystemRoots: [SIMPLE_PIXSO_MCP_ROOT],
    }),
  ).not.toThrow();
  expect(() =>
    assertMcpServerAllowed(servers.find((server) => server.key === 'outside')!, {
      allowedFilesystemRoots: [SIMPLE_PIXSO_MCP_ROOT],
    }),
  ).not.toThrow();
  expect(() =>
    assertMcpServerAllowed(servers.find((server) => server.key === 'public')!, {
      allowedFilesystemRoots: [SIMPLE_PIXSO_MCP_ROOT],
    }),
  ).not.toThrow();

  const remotePolicy = validateMcpServerPolicy(servers.find((server) => server.key === 'public')!);
  expect(remotePolicy.allowed).toBe(true);
  expect(remotePolicy.diagnostics).toContainEqual(
    expect.objectContaining({
      level: 'warning',
      code: 'mcp_remote_server',
    }),
  );
});
