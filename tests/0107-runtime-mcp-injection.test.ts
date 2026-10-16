import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'bun:test';

import {
  DEFAULT_PROJ_MCP_PACKAGE_ROOT,
  prepareExternalMcpInjection,
  verifyExternalMcpInjection,
  type AppliedExternalMcpInjection,
} from '../services/api/src/agent-runtimes/mcp-injection';
import { externalMcpVerificationEnv } from '../services/api/src/agent-runtimes/adapter';
import {
  CLAUDE_CODE_RUNTIME_DEF,
  CODEX_RUNTIME_DEF,
  OPENCODE_RUNTIME_DEF,
} from '../services/api/src/agent-runtimes/registry';

test('project MCP default package root is module-relative, not process-cwd-relative', () => {
  expect(DEFAULT_PROJ_MCP_PACKAGE_ROOT).toBe(
    fileURLToPath(new URL('../packages/proj-mcp/', import.meta.url)),
  );
});

test('Claude MCP injection merges managed server and restores user config', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-mcp-'));
  const original = JSON.stringify(
    { mcpServers: { user: { command: 'user-mcp', args: [] } }, other: true },
    null,
    2,
  );
  await writeFile(join(workspace, '.mcp.json'), original, 'utf8');

  const injection = await prepareExternalMcpInjection({
    def: CLAUDE_CODE_RUNTIME_DEF,
    cwd: workspace,
    packageRoot: '/repo/packages/proj-mcp',
    apiUrl: 'http://127.0.0.1:3000',
    projectId: 'demo',
  });

  expect(injection.status).toBe('applied');
  expect(injection.mode).toBe('claude-mcp-json');
  const applied = injection as AppliedExternalMcpInjection;
  const merged = JSON.parse(await readFile(join(workspace, '.mcp.json'), 'utf8'));
  expect(merged.other).toBe(true);
  expect(merged.mcpServers.user.command).toBe('user-mcp');
  expect(merged.mcpServers['sber-designer']).toMatchObject({
    command: 'bun',
    args: [
      '/repo/packages/proj-mcp/src/bin.ts',
      '--workspace',
      workspace,
      '--project-id',
      'demo',
      '--api-url',
      'http://127.0.0.1:3000',
    ],
  });
  expect(applied.args[0]).toBe('--mcp-config');
  expect(applied.args[1]).toBe(join(workspace, '.mcp.json'));
  expect(applied.args[2]).toBe('--allowedTools');
  expect(applied.args[3]).toContain('mcp__sber-designer__get_project_index_status');
  expect(applied.args[3]).not.toContain('mcp__sber-designer__ast_write_file');
  expect(applied.args[3]).not.toContain('mcp__sber-designer__git_create_pr');

  await applied.cleanup();
  expect(await readFile(join(workspace, '.mcp.json'), 'utf8')).toBe(original);
});

test('Claude MCP injection removes managed file when no user config existed', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-mcp-'));

  const injection = await prepareExternalMcpInjection({
    def: CLAUDE_CODE_RUNTIME_DEF,
    cwd: workspace,
    packageRoot: '/repo/packages/proj-mcp',
  });

  expect(injection.status).toBe('applied');
  await (injection as AppliedExternalMcpInjection).cleanup();
  await expect(access(join(workspace, '.mcp.json'))).rejects.toThrow();
});

test('OpenCode MCP injection merges managed server into mcp env content', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-mcp-'));
  const injection = await prepareExternalMcpInjection({
    def: OPENCODE_RUNTIME_DEF,
    cwd: workspace,
    packageRoot: '/repo/packages/proj-mcp',
    env: {
      OPENCODE_CONFIG_CONTENT: JSON.stringify({
        mcp: { existing: { type: 'local', command: ['existing-mcp'], enabled: true } },
      }),
    },
  });

  expect(injection.status).toBe('applied');
  expect(injection.mode).toBe('opencode-env-content');
  const content = JSON.parse(
    (injection as AppliedExternalMcpInjection).env.OPENCODE_CONFIG_CONTENT ?? '{}',
  );
  expect(content.mcp.existing.command).toEqual(['existing-mcp']);
  expect(content.mcp['sber-designer']).toMatchObject({
    type: 'local',
    command: ['bun', '/repo/packages/proj-mcp/src/bin.ts', '--workspace', workspace],
    enabled: true,
  });
});

test('Codex MCP injection uses per-run config args and verifies the managed server', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-mcp-codex-'));
  const injection = await prepareExternalMcpInjection({
    def: CODEX_RUNTIME_DEF,
    cwd: workspace,
    packageRoot: '/repo/packages/proj-mcp',
    projectId: 'demo',
  });

  expect(injection).toMatchObject({
    status: 'applied',
    mode: 'codex-config-args',
    serverName: 'sber-designer',
    env: {},
  });
  expect(injection.args).toEqual([
    '-c',
    'mcp_servers.sber-designer.command="bun"',
    '-c',
    `mcp_servers.sber-designer.args=["/repo/packages/proj-mcp/src/bin.ts","--workspace",${JSON.stringify(
      workspace,
    )},"--project-id","demo"]`,
  ]);

  const verification = await verifyExternalMcpInjection({
    def: CODEX_RUNTIME_DEF,
    command: 'codex',
    cwd: workspace,
    injection,
    runCommand: async (_command, args) => {
      expect(args).toEqual([...injection.args, 'mcp', 'list']);
      return {
        stdout: 'sber-designer  bun  /repo/packages/proj-mcp/src/bin.ts  enabled  Unsupported\n',
        stderr: '',
      };
    },
  });

  expect(verification).toMatchObject({
    status: 'forwarded_verified',
    serverName: 'sber-designer',
  });
});

test('OpenCode MCP injection rejects legacy mcpServers env content before launch', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-mcp-'));
  const injection = await prepareExternalMcpInjection({
    def: OPENCODE_RUNTIME_DEF,
    cwd: workspace,
    packageRoot: '/repo/packages/proj-mcp',
    env: {
      OPENCODE_CONFIG_CONTENT: JSON.stringify({
        mcpServers: { existing: { command: 'existing-mcp', args: [] } },
      }),
    },
  });

  expect(injection).toMatchObject({
    status: 'failed',
    mode: 'opencode-env-content',
    env: {},
  });
  expect(injection.detail).toContain('runtime_config_invalid');
  expect(injection.detail).toContain('mcpServers');
  expect(injection.detail).toContain('OPENCODE_CONFIG_CONTENT#mcp.<name>');
});

test('MCP injection verifies forwarded server through runtime listMcp probe', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-mcp-'));
  const injection = await prepareExternalMcpInjection({
    def: CLAUDE_CODE_RUNTIME_DEF,
    cwd: workspace,
    packageRoot: '/repo/packages/proj-mcp',
  });

  const verification = await verifyExternalMcpInjection({
    def: CLAUDE_CODE_RUNTIME_DEF,
    command: 'claude',
    cwd: workspace,
    injection,
    runCommand: async (command, args, options) => {
      expect(command).toBe('claude');
      expect(args).toEqual([
        '--mcp-config',
        join(workspace, '.mcp.json'),
        '--strict-mcp-config',
        ...(CLAUDE_CODE_RUNTIME_DEF.listMcp?.args ?? []),
      ]);
      expect(options?.cwd).toBe(workspace);
      return {
        stdout: 'sber-designer: bun /repo/packages/proj-mcp/src/bin.ts - ✓ Connected\n',
        stderr: '',
      };
    },
  });

  expect(verification).toMatchObject({
    status: 'forwarded_verified',
    serverName: 'sber-designer',
  });
  expect(verification?.detail).toContain('MCP list (connected)');
});

test('OpenCode MCP verification uses injected OPENCODE_CONFIG_CONTENT env', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-mcp-opencode-verify-'));
  const injection = await prepareExternalMcpInjection({
    def: OPENCODE_RUNTIME_DEF,
    cwd: workspace,
    packageRoot: '/repo/packages/proj-mcp',
    env: {},
  });

  const verification = await verifyExternalMcpInjection({
    def: OPENCODE_RUNTIME_DEF,
    command: 'opencode',
    cwd: workspace,
    injection,
    env: externalMcpVerificationEnv({}, (injection as AppliedExternalMcpInjection).env),
    runCommand: async (command, args, options) => {
      expect(command).toBe('opencode');
      expect(args).toEqual(OPENCODE_RUNTIME_DEF.listMcp?.args);
      expect(options?.cwd).toBe(workspace);
      const content = JSON.parse(options?.env?.OPENCODE_CONFIG_CONTENT ?? '{}');
      expect(options?.env?.PATH).toBe(process.env.PATH);
      expect(options?.env?.HOME).toBe(process.env.HOME);
      expect(content.mcp['sber-designer']).toMatchObject({
        type: 'local',
        command: ['bun', '/repo/packages/proj-mcp/src/bin.ts', '--workspace', workspace],
        enabled: true,
      });
      return {
        stdout: [
          '\u001b[0m',
          '┌  MCP Servers',
          '│',
          '●  ✓ sber-designer \u001b[90mconnected',
          '│      \u001b[90mbun /repo/packages/proj-mcp/src/bin.ts',
          '│',
          '└  1 server(s)',
        ].join('\n'),
        stderr: '',
      };
    },
  });

  expect(verification).toMatchObject({
    status: 'forwarded_verified',
    serverName: 'sber-designer',
  });
});

test('OpenCode adapter verify env preserves host PATH/HOME before injected config', () => {
  const env = externalMcpVerificationEnv(
    { OPENCODE_CONFIG_CONTENT: '{"mcp":{}}' },
    { OPENCODE_CONFIG_CONTENT: '{"mcp":{"sber-designer":{"enabled":true}}}' },
  );

  expect(env.PATH).toBe(process.env.PATH);
  expect(env.HOME).toBe(process.env.HOME);
  expect(env.OPENCODE_CONFIG_CONTENT).toBe('{"mcp":{"sber-designer":{"enabled":true}}}');
});

test('MCP injection reports unverified when runtime listMcp probe misses managed server', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-mcp-'));
  const injection = await prepareExternalMcpInjection({
    def: OPENCODE_RUNTIME_DEF,
    cwd: workspace,
    packageRoot: '/repo/packages/proj-mcp',
    env: {},
  });

  const verification = await verifyExternalMcpInjection({
    def: OPENCODE_RUNTIME_DEF,
    command: 'opencode',
    cwd: workspace,
    injection,
    runCommand: async () => ({ stdout: 'other-server  enabled  stdio\n', stderr: '' }),
  });

  expect(verification).toMatchObject({
    status: 'forwarded_unverified',
    serverName: 'sber-designer',
  });
  expect(verification?.detail).toContain('was not found');
});
