import { expect, test } from 'bun:test';

import { detectRuntime } from '../services/api/src/agent-runtimes/detection';
import {
  AGENT_RUNTIME_DEFS,
  CLAUDE_CODE_RUNTIME_DEF,
  CODEX_RUNTIME_DEF,
  GIGACODE_RUNTIME_DEF,
  KIMI_RUNTIME_DEF,
} from '../services/api/src/agent-runtimes/registry';

test('runtime registry models local CLI agents as provider-like inventory sources', () => {
  expect(AGENT_RUNTIME_DEFS.map((def) => `${def.kind}:${def.primaryBin}`)).toEqual([
    'opencode:opencode-cli',
    'claude-code:claude',
    'codex:codex',
    'kimi:kimi',
    'gigacode:gigacode',
  ]);
  expect(CLAUDE_CODE_RUNTIME_DEF.chatHandoff).toBe(true);
  expect(CLAUDE_CODE_RUNTIME_DEF.streamFormat).toBe('stream-json');
  expect(CLAUDE_CODE_RUNTIME_DEF.fallbackModels?.map((model) => model.id)).toEqual([
    'default',
    'sonnet',
    'opus',
    'haiku',
    'claude-opus-4-5',
    'claude-sonnet-4-5',
    'claude-haiku-4-5',
  ]);
  expect(CODEX_RUNTIME_DEF.fallbackModels?.map((model) => model.id)).toEqual([
    'default',
    'gpt-5.5',
    'gpt-5.4',
    'gpt-5.4-mini',
    'gpt-5.3-codex',
    'gpt-5.1',
    'gpt-5.1-codex-mini',
    'gpt-5-codex',
    'gpt-5',
    'o3',
    'o4-mini',
  ]);
  expect(CODEX_RUNTIME_DEF.listModels).toEqual({
    args: ['debug', 'models'],
    timeoutMs: 8000,
    parser: 'codex-debug-models',
  });
  expect(KIMI_RUNTIME_DEF.fallbackModels?.map((model) => model.id)).toEqual(['kimi-k3', 'default']);
  expect(KIMI_RUNTIME_DEF.promptDelivery).toEqual({ mode: 'argv', maxBytes: 200_000 });
  expect(GIGACODE_RUNTIME_DEF.fallbackModels?.map((model) => model.id)).toEqual(['default']);
  expect(GIGACODE_RUNTIME_DEF.listModels).toBeUndefined();
  expect(GIGACODE_RUNTIME_DEF.promptDelivery).toEqual({ mode: 'stdin', maxBytes: 200_000 });
  expect(GIGACODE_RUNTIME_DEF.streamFormat).toBe('stream-json');
  expect(GIGACODE_RUNTIME_DEF.eventParser).toBe('gigacode');
  // 0131 Р-7: no project MCP injection in v1 — the CLI settings shape is
  // Qwen-style `mcpServers`, which no existing injection mode writes.
  expect(GIGACODE_RUNTIME_DEF.externalMcpInjection).toBeUndefined();
});

test('GigaCode runtime detects auth, capture-style sessions, and its plain-text MCP list', async () => {
  const gigacode = await detectRuntime(GIGACODE_RUNTIME_DEF, {
    resolveCommand: async (def) => ({
      command: '/usr/local/bin/gigacode',
      selectedBin: def.primaryBin,
    }),
    runCommand: async (_command, args) => {
      if (args.join(' ') === '--version') return { stdout: '26.6.31\n', stderr: '' };
      if (args.join(' ') === '--help') {
        return {
          stdout:
            'gigacode [options]\n  --output-format\n  --include-partial-messages\n  --session-id\n  -r, --resume\n',
          stderr: '',
        };
      }
      if (args.join(' ') === 'auth status') {
        return {
          stdout:
            '=== Authentication Status ===\n✓ Authentication Method: gigacode\n  Status: Configured\n',
          stderr: '',
        };
      }
      if (args.join(' ') === 'mcp list') {
        return {
          stdout:
            '[ERROR] [MCP_KEYCHAIN] Failed to list secrets from keychain: session unavailable\nConfigured MCP servers:\n✓ talk-to-pixso-mcp: /usr/local/bin/bun run server.ts (stdio) - Connected\n● remote-docs: https://docs.example.test/mcp (http) - Pending approval\n',
          stderr: '',
        };
      }
      throw new Error(`unexpected command: ${args.join(' ')}`);
    },
    readGigaCodeState: async () => ({ auth: 'missing', models: [], diagnostics: [] }),
  });

  expect(gigacode.auth.status).toBe('ready');
  expect(gigacode.auth.providers).toEqual(['gigacode']);
  expect(gigacode.models.map((model) => model.id)).toEqual(['default']);
  expect(gigacode.capabilities.promptViaStdin).toBe(true);
  expect(gigacode.capabilities.modelList).toBe(false);
  expect(gigacode.capabilities.sessionSpecify).toBe(false);
  expect(gigacode.capabilities.sessionResume).toBe(true);
  expect(gigacode.capabilities.sessionCapture).toBe(true);
  expect(gigacode.mcpServers).toEqual([
    {
      runtime: 'gigacode',
      name: 'talk-to-pixso-mcp',
      status: 'connected',
      transport: 'stdio',
      detail: '/usr/local/bin/bun run server.ts (stdio)',
    },
    {
      runtime: 'gigacode',
      name: 'remote-docs',
      status: 'disabled',
      transport: 'http',
      detail: 'https://docs.example.test/mcp (http)',
    },
  ]);
});

test('GigaCode 26.9 reads auth and the authoritative model catalogue from sanitized state', async () => {
  const gigacode = await detectRuntime(GIGACODE_RUNTIME_DEF, {
    resolveCommand: async (def) => ({
      command: '/usr/local/bin/gigacode',
      selectedBin: def.primaryBin,
    }),
    runCommand: async (_command, args) => {
      if (args.join(' ') === '--version') return { stdout: '26.9.64\n', stderr: '' };
      if (args.join(' ') === '--help') return { stdout: 'gigacode --model\n', stderr: '' };
      if (args.join(' ') === 'auth status') {
        return { stdout: 'Authentication is managed by the GigaCode backend\n', stderr: '' };
      }
      if (args.join(' ') === 'mcp list') return { stdout: '', stderr: '' };
      throw new Error(`unexpected command: ${args.join(' ')}`);
    },
    readGigaCodeState: async () => ({
      auth: 'ready',
      configuredModel: 'CodeChat',
      models: [
        {
          runtime: 'gigacode',
          id: 'Qwen3.6-35B',
          provider: 'gigacode',
          model: 'Qwen3.6-35B',
          label: 'GigaCode · Qwen3.6-35B',
          description: 'Qwen3.6-35B-262k',
          contextWindowSize: 262_144,
        },
      ],
      diagnostics: [],
    }),
  });

  expect(gigacode.auth).toEqual({ status: 'ready', providers: ['gigacode'] });
  expect(gigacode.models.map((model) => model.id)).toEqual(['Qwen3.6-35B']);
  expect(gigacode.selectedModel).toBeUndefined();
  expect(gigacode.diagnostics).toContainEqual(
    expect.objectContaining({ code: 'gigacode_model_unavailable', severity: 'warning' }),
  );
});

test('GigaCode auth parser rejects a signed-out CLI', async () => {
  const gigacode = await detectRuntime(GIGACODE_RUNTIME_DEF, {
    resolveCommand: async (def) => ({
      command: '/usr/local/bin/gigacode',
      selectedBin: def.primaryBin,
    }),
    runCommand: async (_command, args) => {
      if (args.join(' ') === '--version') return { stdout: '26.6.31\n', stderr: '' };
      if (args.join(' ') === '--help') return { stdout: 'gigacode [options]\n', stderr: '' };
      if (args.join(' ') === 'auth status') {
        return {
          stdout:
            '=== Authentication Status ===\n✗ Authentication Method: none\n  Status: not authenticated\n',
          stderr: '',
        };
      }
      if (args.join(' ') === 'mcp list') return { stdout: '', stderr: '' };
      throw new Error(`unexpected command: ${args.join(' ')}`);
    },
    readGigaCodeState: async () => ({ auth: 'missing', models: [], diagnostics: [] }),
  });

  expect(gigacode.auth.status).toBe('none');
  expect(gigacode.auth.providers).toEqual([]);
  expect(gigacode.connected).toBe(false);
  expect(gigacode.auth.action).toBe('sign-in');
});

test('GigaCode managed-auth stdout alone is not treated as authenticated', async () => {
  const gigacode = await detectRuntime(GIGACODE_RUNTIME_DEF, {
    resolveCommand: async (def) => ({
      command: '/usr/local/bin/gigacode',
      selectedBin: def.primaryBin,
    }),
    runCommand: async (_command, args) => {
      if (args.join(' ') === '--version') return { stdout: '26.9.64\n', stderr: '' };
      if (args.join(' ') === '--help') return { stdout: 'gigacode\n', stderr: '' };
      if (args.join(' ') === 'auth status') {
        return { stdout: 'Authentication is managed by the GigaCode backend\n', stderr: '' };
      }
      if (args.join(' ') === 'mcp list') return { stdout: '', stderr: '' };
      throw new Error(`unexpected command: ${args.join(' ')}`);
    },
    readGigaCodeState: async () => ({ auth: 'missing', models: [], diagnostics: [] }),
  });

  expect(gigacode.auth.status).toBe('none');
  expect(gigacode.auth.action).toBe('sign-in');
  expect(gigacode.models).toEqual([]);
});

test('Kimi runtime detects a valid CLI configuration and capture-style sessions', async () => {
  const kimi = await detectRuntime(KIMI_RUNTIME_DEF, {
    resolveCommand: async (def) => ({
      command: '/usr/local/bin/kimi',
      selectedBin: def.primaryBin,
    }),
    runCommand: async (_command, args) => {
      if (args.join(' ') === '--version') return { stdout: '0.27.0\n', stderr: '' };
      if (args.join(' ') === '--help') {
        return {
          stdout: 'kimi --prompt TEXT --output-format stream-json --session ID\n',
          stderr: '',
        };
      }
      if (args.join(' ') === 'doctor config') {
        return {
          stdout:
            'Kimi doctor\nOK config.toml /Users/test/.kimi-code/config.toml\nAll checked config files are valid.\n',
          stderr: '',
        };
      }
      throw new Error(`unexpected command: ${args.join(' ')}`);
    },
  });

  expect(kimi.auth.status).toBe('ready');
  expect(kimi.auth.providers).toEqual(['kimi']);
  expect(kimi.models.map((model) => model.id)).toEqual(['kimi-k3', 'default']);
  expect(kimi.capabilities.promptViaStdin).toBe(false);
  expect(kimi.capabilities.sessionResume).toBe(true);
  expect(kimi.capabilities.sessionCapture).toBe(true);
});

test('runtime auth parsers handle Codex and Claude CLI status output', async () => {
  const codex = await detectRuntime(CODEX_RUNTIME_DEF, {
    resolveCommand: async (def) => ({
      command: '/usr/local/bin/codex',
      selectedBin: def.primaryBin,
    }),
    runCommand: async (_command, args) => {
      if (args.join(' ') === '--version') return { stdout: 'codex-cli 0.130.0\n', stderr: '' };
      if (args.join(' ') === 'exec --help')
        return { stdout: 'codex exec --json --model\n', stderr: '' };
      if (args.join(' ') === 'login status') {
        return {
          stdout: 'Logged in using ChatGPT\n',
          stderr: 'WARNING: proceeding, even though PATH could not be updated\n',
        };
      }
      if (args.join(' ') === 'debug models') {
        return {
          stdout: JSON.stringify({
            models: [
              { slug: 'gpt-5.5', display_name: 'GPT-5.5', visibility: 'list' },
              { slug: 'hidden-model', display_name: 'Hidden', visibility: 'hidden' },
              { id: 'gpt-5', display_name: 'GPT-5', visibility: 'list' },
            ],
          }),
          stderr: '',
        };
      }
      if (args.join(' ') === 'mcp list') return { stdout: '', stderr: '' };
      throw new Error(`unexpected command: ${args.join(' ')}`);
    },
  });

  const claude = await detectRuntime(CLAUDE_CODE_RUNTIME_DEF, {
    resolveCommand: async (def) => ({
      command: '/usr/local/bin/claude',
      selectedBin: def.primaryBin,
    }),
    runCommand: async (_command, args) => {
      if (args.join(' ') === '--version') return { stdout: '2.1.143 (Claude Code)\n', stderr: '' };
      if (args.join(' ') === '--help')
        return { stdout: 'claude --output-format stream-json --model\n', stderr: '' };
      if (args.join(' ') === 'auth status') {
        throw Object.assign(new Error('not logged in'), {
          stdout: '{"loggedIn":false,"authMethod":"none"}',
          stderr: '',
        });
      }
      if (args.join(' ') === 'mcp list') return { stdout: '', stderr: '' };
      throw new Error(`unexpected command: ${args.join(' ')}`);
    },
  });

  expect(codex.auth).toEqual({ status: 'ready', providers: ['openai'] });
  expect(codex.models.map((model) => model.id)).toEqual(['default', 'gpt-5.5', 'gpt-5']);
  expect(codex.capabilities.imageInputMode).toBe('cli-native');
  expect(codex.capabilities.rasterImageInput).toBe(true);
  expect(codex.capabilities.nativeFileInput).toBe(true);
  expect(claude.auth.status).toBe('none');
  expect(claude.auth.providers).toEqual([]);
  expect(claude.capabilities.imageInputMode).toBe('cli-files-warning');
  expect(claude.capabilities.imageDeliveryMode).toBe('prompt_path');
  expect(claude.capabilities.rasterImageInput).toBe(false);
  expect(claude.capabilities.nativeFileInput).toBe(false);
});

test('Claude runtime falls back to short version flag before warning', async () => {
  const calls: string[] = [];
  const claude = await detectRuntime(CLAUDE_CODE_RUNTIME_DEF, {
    resolveCommand: async (def) => ({
      command: '/usr/local/bin/claude',
      selectedBin: def.primaryBin,
    }),
    runCommand: async (_command, args) => {
      calls.push(args.join(' '));
      if (args.join(' ') === '--version') throw new Error('transient version failure');
      if (args.join(' ') === '-v') return { stdout: '2.1.158 (Claude Code)\n', stderr: '' };
      if (args.join(' ') === '--help')
        return { stdout: 'claude --output-format stream-json --model\n', stderr: '' };
      if (args.join(' ') === 'auth status') {
        return { stdout: '{"loggedIn":true,"authMethod":"anthropic"}', stderr: '' };
      }
      if (args.join(' ') === 'mcp list') return { stdout: '', stderr: '' };
      throw new Error(`unexpected command: ${args.join(' ')}`);
    },
  });

  expect(calls.slice(0, 2)).toEqual(['--version', '-v']);
  expect(claude.version).toBe('2.1.158 (Claude Code)');
  expect(claude.diagnostics.some((diagnostic) => diagnostic.code === 'version_failed')).toBe(false);
});

test('runtime detection exposes help-probed session capabilities and version probe timeout', async () => {
  const calls: Array<{ args: string; timeoutMs?: number }> = [];
  const claude = await detectRuntime(
    {
      ...CLAUDE_CODE_RUNTIME_DEF,
      versionProbeTimeoutMs: 12_345,
    },
    {
      resolveCommand: async (def) => ({
        command: '/usr/local/bin/claude',
        selectedBin: def.primaryBin,
      }),
      runCommand: async (_command, args, options) => {
        calls.push({ args: args.join(' '), timeoutMs: options?.timeoutMs });
        if (args.join(' ') === '--version')
          return { stdout: '2.1.158 (Claude Code)\n', stderr: '' };
        if (args.join(' ') === '--help') {
          return {
            stdout:
              'claude -p --output-format stream-json --include-partial-messages --session-id --resume --model\n',
            stderr: '',
          };
        }
        if (args.join(' ') === 'auth status') {
          return { stdout: '{"loggedIn":true,"authMethod":"anthropic"}', stderr: '' };
        }
        if (args.join(' ') === 'mcp list') return { stdout: '', stderr: '' };
        throw new Error(`unexpected command: ${args.join(' ')}`);
      },
    },
  );

  expect(calls.find((call) => call.args === '--version')?.timeoutMs).toBe(12_345);
  expect(claude.capabilities.includePartialMessages).toBe(true);
  expect(claude.capabilities.sessionSpecify).toBe(true);
  expect(claude.capabilities.sessionResume).toBe(true);
  expect(claude.capabilities.sessionCapture).toBe(false);
});

test('Codex runtime help flags expose capture-style resume support', async () => {
  const codex = await detectRuntime(CODEX_RUNTIME_DEF, {
    resolveCommand: async (def) => ({
      command: '/usr/local/bin/codex',
      selectedBin: def.primaryBin,
    }),
    runCommand: async (_command, args) => {
      if (args.join(' ') === '--version') return { stdout: 'codex-cli 0.130.0\n', stderr: '' };
      if (args.join(' ') === 'exec --help') {
        return {
          stdout:
            'codex exec --json --model\nresume  Resume a previous session by id or pick the most recent with --last\n',
          stderr: '',
        };
      }
      if (args.join(' ') === 'login status')
        return { stdout: 'Logged in using ChatGPT\n', stderr: '' };
      if (args.join(' ') === 'debug models') {
        return {
          stdout: JSON.stringify({ models: [{ slug: 'gpt-5.5', visibility: 'list' }] }),
          stderr: '',
        };
      }
      if (args.join(' ') === 'mcp list') return { stdout: '', stderr: '' };
      throw new Error(`unexpected command: ${args.join(' ')}`);
    },
  });

  expect(codex.capabilities.sessionSpecify).toBe(false);
  expect(codex.capabilities.sessionResume).toBe(true);
  expect(codex.capabilities.sessionCapture).toBe(true);
});

test('runtime detection classifies auth and service failures separately', async () => {
  const status = await detectRuntime(CODEX_RUNTIME_DEF, {
    resolveCommand: async (def) => ({
      command: '/usr/local/bin/codex',
      selectedBin: def.primaryBin,
    }),
    runCommand: async (_command, args) => {
      if (args.join(' ') === '--version') return { stdout: 'codex-cli 0.130.0\n', stderr: '' };
      if (args.join(' ') === 'exec --help')
        return { stdout: 'codex exec --json --model\n', stderr: '' };
      if (args.join(' ') === 'login status') throw new Error('401 Unauthorized: token expired');
      if (args.join(' ') === 'debug models') throw new Error('503 Service Unavailable');
      if (args.join(' ') === 'mcp list') return { stdout: '', stderr: '' };
      throw new Error(`unexpected command: ${args.join(' ')}`);
    },
  });

  expect(status.auth.status).toBe('failed');
  expect(status.diagnostics).toContainEqual(
    expect.objectContaining({ code: 'auth_expired', severity: 'warning' }),
  );
  expect(status.diagnostics).toContainEqual(
    expect.objectContaining({ code: 'service_unavailable', severity: 'warning' }),
  );
});

test('runtime detection runs CLI probes from an isolated probe cwd and records launch metadata', async () => {
  const calls: Array<{ args: string; cwd?: string }> = [];
  const status = await detectRuntime(
    CODEX_RUNTIME_DEF,
    {
      resolveCommand: async (def) => ({
        command: '/opt/sber-designer/bin/codex',
        selectedBin: def.primaryBin,
        launchPath: '/opt/sber-designer/bin/codex',
        source: 'env',
      }),
      runCommand: async (_command, args, options) => {
        calls.push({ args: args.join(' '), cwd: options?.cwd });
        if (args.join(' ') === '--version') return { stdout: 'codex-cli 0.130.0\n', stderr: '' };
        if (args.join(' ') === 'exec --help')
          return { stdout: 'codex exec --json --model\n', stderr: '' };
        if (args.join(' ') === 'login status') {
          return { stdout: 'Logged in using ChatGPT\n', stderr: '' };
        }
        if (args.join(' ') === 'debug models') {
          return {
            stdout: JSON.stringify({
              models: [{ slug: 'gpt-5.5', display_name: 'GPT-5.5', visibility: 'list' }],
            }),
            stderr: '',
          };
        }
        if (args.join(' ') === 'mcp list') return { stdout: '', stderr: '' };
        throw new Error(`unexpected command: ${args.join(' ')}`);
      },
    },
    {
      cwd: '/work/project',
      probeCwd: '/tmp/sber-designer-runtime-probe',
    },
  );

  expect(calls.map((call) => call.args)).toEqual([
    '--version',
    'exec --help',
    'login status',
    'debug models',
    'mcp list',
  ]);
  expect(calls.every((call) => call.cwd === '/tmp/sber-designer-runtime-probe')).toBe(true);
  expect(status.launch).toEqual(
    expect.objectContaining({
      command: '/opt/sber-designer/bin/codex',
      selectedBin: 'codex',
      launchPath: '/opt/sber-designer/bin/codex',
      source: 'env',
      probeCwd: '/tmp/sber-designer-runtime-probe',
    }),
  );
});
