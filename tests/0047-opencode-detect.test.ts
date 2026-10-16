import { expect, test } from 'bun:test';

import {
  detectRuntime,
  parseMcpServers,
  parseOpenCodeProviders,
} from '../services/api/src/agent-runtimes/detection';
import { OPENCODE_RUNTIME_DEF } from '../services/api/src/agent-runtimes/registry';

test('detects OpenCode binary, capabilities, auth and models without shell execution', async () => {
  const seenCommands: { command: string; args: string[] }[] = [];
  const status = await detectRuntime(OPENCODE_RUNTIME_DEF, {
    resolveCommand: async (def) => ({
      command: '/usr/local/bin/opencode',
      selectedBin: def.primaryBin,
    }),
    runCommand: async (command, args) => {
      seenCommands.push({ command, args });
      if (args.join(' ') === '--version') return { stdout: 'opencode 1.2.3\n', stderr: '' };
      if (args.join(' ') === '--help') {
        return { stdout: 'Usage: opencode run --format json --model <model>\n', stderr: '' };
      }
      if (args.join(' ') === 'auth list')
        return { stdout: 'providerA api\nproviderB oauth\n', stderr: '' };
      if (args.join(' ') === 'models') {
        return { stdout: 'providerA/model-a\nproviderB/model-b\n', stderr: '' };
      }
      throw new Error(`unexpected command: ${args.join(' ')}`);
    },
  });

  expect(status.installed).toBe(true);
  expect(status.command).toBe('/usr/local/bin/opencode');
  expect(status.version).toBe('opencode 1.2.3');
  expect(status.auth.providers).toEqual(['providera', 'providerb']);
  expect(status.capabilities.runJson).toBe(true);
  expect(status.capabilities.modelFlag).toBe(true);
  expect(status.capabilities.imageInputMode).toBe('cli-files-warning');
  expect(status.capabilities.rasterImageInput).toBe(false);
  expect(status.capabilities.svgSourceInput).toBe(true);
  expect(status.capabilities.nativeFileInput).toBe(false);
  expect(status.models.map((model) => model.id)).toEqual([
    'providerA/model-a',
    'providerB/model-b',
  ]);
  expect(seenCommands.every((entry) => entry.command === '/usr/local/bin/opencode')).toBe(true);
});

test('OpenCode auth parser ignores incidental single-token status lines', () => {
  expect(
    parseOpenCodeProviders(
      [
        'Checking',
        'Ready',
        'providerA/model-a',
        'Provider authentication status',
        '●  providerA api',
      ].join('\n'),
    ),
  ).toEqual(['providera']);
});

test('parses formatted OpenCode auth and MCP inventory output', async () => {
  const status = await detectRuntime(OPENCODE_RUNTIME_DEF, {
    resolveCommand: async (def) => ({
      command: '/usr/local/bin/opencode',
      selectedBin: def.primaryBin,
    }),
    runCommand: async (_command, args) => {
      if (args.join(' ') === '--version') return { stdout: 'opencode 1.15.4\n', stderr: '' };
      if (args.join(' ') === '--help') {
        return { stdout: 'Usage: opencode run --format json --model <model>\n', stderr: '' };
      }
      if (args.join(' ') === 'auth list') {
        return {
          stdout: [
            '\u001b[0m',
            '┌  Credentials ~/.local/share/opencode/auth.json',
            '│',
            '●  providerA api',
            '│',
            '└  1 credentials',
          ].join('\n'),
          stderr: '',
        };
      }
      if (args.join(' ') === 'models') {
        return { stdout: 'providerA/model-a\n', stderr: '' };
      }
      if (args.join(' ') === 'mcp list') {
        return {
          stdout: [
            'Name             Command  Args              Status',
            'context7         npx      @upstash/context7 enabled',
            'talktopixso_mcp  bun      dist/server.js    disabled',
            'figma            https://mcp.figma.com/mcp enabled',
          ].join('\n'),
          stderr: '',
        };
      }
      throw new Error(`unexpected command: ${args.join(' ')}`);
    },
  });

  expect(status.auth.status).toBe('ready');
  expect(status.auth.providers).toEqual(['providera']);
  expect(status.mcpServers.map((server) => `${server.name}:${server.status}`)).toEqual([
    'context7:enabled',
    'talktopixso_mcp:disabled',
    'figma:enabled',
  ]);
});

test('parses current OpenCode tree MCP inventory output', () => {
  const servers = parseMcpServers(
    'opencode',
    [
      '\u001b[0m',
      '┌  MCP Servers',
      '│',
      '●  ✓ context7 \u001b[90mconnected',
      '│      \u001b[90mhttps://mcp.context7.com/mcp',
      '│',
      '●  ✓ sber-designer \u001b[90mconnected',
      '│      \u001b[90mbun /repo/packages/proj-mcp/src/bin.ts',
      '│',
      '└  2 server(s)',
    ].join('\n'),
  );

  expect(servers.map((server) => `${server.name}:${server.status}`)).toEqual([
    'context7:connected',
    'sber-designer:connected',
  ]);
});

test('reports missing OpenCode as unavailable instead of throwing', async () => {
  const status = await detectRuntime(OPENCODE_RUNTIME_DEF, {
    resolveCommand: async () => null,
    runCommand: async () => {
      throw new Error('should not run');
    },
  });

  expect(status.installed).toBe(false);
  expect(status.connected).toBe(false);
  expect(status.models).toEqual([]);
  expect(status.diagnostics[0]?.code).toBe('not_found');
});
