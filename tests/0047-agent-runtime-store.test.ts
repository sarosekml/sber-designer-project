import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  createStoredRuntimeStatus,
  createAgentRuntimeStore,
  mergeConnectionState,
} from '../services/api/src/agent-runtimes/store';
import {
  CLAUDE_CODE_RUNTIME_DEF,
  CODEX_RUNTIME_DEF,
  OPENCODE_RUNTIME_DEF,
} from '../services/api/src/agent-runtimes/registry';

test('stores OpenCode connection state outside project config', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sd-runtime-store-'));
  const store = createAgentRuntimeStore(join(dir, 'runtimes.json'));

  try {
    await store.connect('opencode', {
      command: '/usr/local/bin/opencode',
      selectedModel: 'providerA/model-a',
    });
    const state = await store.read();

    expect(state.agentRuntimes.opencode?.connected).toBe(true);
    expect(state.agentRuntimes.opencode?.selectedModel).toBe('providerA/model-a');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('disconnect keeps runtime metadata so reconnect can restore the selected model', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sd-runtime-store-'));
  const store = createAgentRuntimeStore(join(dir, 'runtimes.json'));

  try {
    await store.connect('opencode', {
      command: '/usr/local/bin/opencode',
      selectedModel: 'opencode/big-pickle',
      models: [
        {
          runtime: 'opencode',
          id: 'opencode/big-pickle',
          provider: 'opencode',
          model: 'big-pickle',
          label: 'opencode/big-pickle',
        },
      ],
      authProviders: ['openrouter'],
      lastDetectedVersion: '1.15.4',
    });
    await store.disconnect('opencode');
    const state = await store.read();

    expect(state.agentRuntimes.opencode).toMatchObject({
      connected: false,
      command: '/usr/local/bin/opencode',
      selectedModel: 'opencode/big-pickle',
      authProviders: ['openrouter'],
      lastDetectedVersion: '1.15.4',
    });
    expect(state.agentRuntimes.opencode?.models?.map((model) => model.id)).toEqual([
      'opencode/big-pickle',
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('mergeConnectionState requires both detected auth and local connection', () => {
  const status = mergeConnectionState(
    {
      kind: 'opencode',
      displayName: 'OpenCode',
      installed: true,
      connected: true,
      command: '/usr/local/bin/opencode',
      version: 'opencode 1.2.3',
      auth: { status: 'ready', providers: ['providerA'] },
      models: [],
      mcpServers: [],
      selectedModel: undefined,
      capabilities: {
        modelList: true,
        mcpList: true,
        runJson: true,
        modelFlag: true,
        promptViaStdin: true,
        jsonEventStream: true,
        cancel: true,
        usesOwnMcpConfig: true,
        supportsProjectMcpHandoff: false,
      },
      diagnostics: [],
    },
    { connected: false },
  );

  expect(status.connected).toBe(false);
});

test('mergeConnectionState preserves selected model and runtime inventory snapshot', () => {
  const status = mergeConnectionState(
    {
      kind: 'opencode',
      displayName: 'OpenCode',
      installed: true,
      connected: true,
      command: '/usr/local/bin/opencode',
      version: 'opencode 1.2.3',
      auth: { status: 'ready', providers: ['openrouter'] },
      models: [],
      mcpServers: [],
      selectedModel: undefined,
      capabilities: {
        modelList: true,
        mcpList: true,
        runJson: true,
        modelFlag: true,
        promptViaStdin: true,
        jsonEventStream: true,
        cancel: true,
        usesOwnMcpConfig: true,
        supportsProjectMcpHandoff: true,
        chatHandoff: true,
      },
      diagnostics: [],
    },
    {
      connected: true,
      command: '/Users/me/.opencode/bin/opencode',
      selectedModel: 'providerA/model-a',
      models: [
        {
          runtime: 'opencode',
          id: 'providerA/model-a',
          provider: 'providerA',
          model: 'model-a',
          label: 'providerA/model-a',
        },
      ],
      mcpServers: [
        {
          runtime: 'opencode',
          name: 'pencil',
          status: 'enabled',
          transport: 'stdio',
        },
      ],
      authProviders: ['providerA'],
      lastDetectedVersion: '1.15.4',
    },
  );

  expect(status.connected).toBe(true);
  expect(status.command).toBe('/Users/me/.opencode/bin/opencode');
  expect(status.selectedModel).toBe('providerA/model-a');
  expect(status.models.map((model) => model.id)).toEqual(['providerA/model-a']);
  expect(status.mcpServers.map((server) => server.name)).toEqual(['pencil']);
  expect(status.auth.providers).toEqual(['providerA']);
});

test('mergeConnectionState refreshes stale stored model snapshots with detected inventory', () => {
  const status = mergeConnectionState(
    {
      kind: 'claude-code',
      displayName: 'Claude Code',
      installed: true,
      connected: true,
      command: '/Users/me/.local/bin/claude',
      version: '2.1.177 (Claude Code)',
      auth: { status: 'ready', providers: ['anthropic'] },
      selectedModel: undefined,
      models: [
        {
          runtime: 'claude-code',
          id: 'default',
          provider: 'claude-code',
          model: 'default',
          label: 'Claude Code · default',
        },
        {
          runtime: 'claude-code',
          id: 'sonnet',
          provider: 'claude-code',
          model: 'sonnet',
          label: 'Claude Code · Sonnet (alias)',
        },
      ],
      mcpServers: [],
      capabilities: {
        modelList: false,
        mcpList: true,
        runJson: true,
        modelFlag: true,
        promptViaStdin: true,
        jsonEventStream: false,
        cancel: true,
        usesOwnMcpConfig: true,
        supportsProjectMcpHandoff: true,
        chatHandoff: true,
      },
      diagnostics: [],
    },
    {
      connected: true,
      command: '/Users/me/.local/bin/claude',
      selectedModel: 'default',
      models: [
        {
          runtime: 'claude-code',
          id: 'default',
          provider: 'claude-code',
          model: 'default',
          label: 'Claude Code · default',
        },
      ],
      authProviders: ['anthropic'],
    },
  );

  expect(status.models.map((model) => model.id)).toEqual(['default', 'sonnet']);
});

test('mergeConnectionState replaces stale GigaCode models with the authoritative catalogue', () => {
  const status = mergeConnectionState(
    {
      kind: 'gigacode',
      displayName: 'GigaCode',
      installed: true,
      connected: true,
      command: '/usr/local/bin/gigacode',
      version: '26.9.64',
      auth: { status: 'ready', providers: ['gigacode'] },
      models: [
        {
          runtime: 'gigacode',
          id: 'Qwen3.6-35B',
          provider: 'gigacode',
          model: 'Qwen3.6-35B',
          label: 'GigaCode · Qwen3.6-35B',
        },
      ],
      mcpServers: [],
      capabilities: {
        modelList: false,
        mcpList: true,
        runJson: true,
        modelFlag: true,
        promptViaStdin: true,
        jsonEventStream: false,
        cancel: true,
        usesOwnMcpConfig: true,
        supportsProjectMcpHandoff: true,
        chatHandoff: true,
      },
      diagnostics: [],
    },
    {
      connected: true,
      selectedModel: 'CodeChat',
      models: [
        {
          runtime: 'gigacode',
          id: 'CodeChat',
          provider: 'gigacode',
          model: 'CodeChat',
          label: 'GigaCode · CodeChat',
        },
      ],
    },
  );

  expect(status.models.map((model) => model.id)).toEqual(['Qwen3.6-35B']);
  expect(status.selectedModel).toBe('Qwen3.6-35B');
});

test('mergeConnectionState clears stale stored diagnostics when fresh detection succeeds', () => {
  const status = mergeConnectionState(
    {
      kind: 'claude-code',
      displayName: 'Claude Code',
      installed: true,
      connected: true,
      command: '/Users/me/.local/bin/claude',
      version: '2.1.158 (Claude Code)',
      auth: { status: 'ready', providers: ['anthropic'] },
      models: [],
      mcpServers: [],
      selectedModel: undefined,
      capabilities: {
        modelList: false,
        mcpList: true,
        runJson: true,
        modelFlag: true,
        promptViaStdin: true,
        jsonEventStream: false,
        cancel: true,
        usesOwnMcpConfig: true,
        supportsProjectMcpHandoff: true,
        chatHandoff: true,
      },
      diagnostics: [],
    },
    {
      connected: true,
      command: '/Users/me/.local/bin/claude',
      diagnostics: [
        {
          code: 'version_failed',
          message: 'Command failed: /Users/me/.local/bin/claude --version',
          severity: 'warning',
        },
      ],
      lastDetectedVersion: null,
    },
  );

  expect(status.version).toBe('2.1.158 (Claude Code)');
  expect(status.diagnostics).toEqual([]);
});

test('creates a stored OpenCode status without probing all local CLIs', () => {
  const status = createStoredRuntimeStatus(OPENCODE_RUNTIME_DEF, {
    connected: true,
    command: '/Users/me/.opencode/bin/opencode',
    selectedModel: 'opencode/big-pickle',
    lastDetectedVersion: '1.15.4',
    authProviders: ['providerA'],
  });

  expect(status).toMatchObject({
    kind: 'opencode',
    displayName: 'OpenCode',
    installed: true,
    connected: true,
    command: '/Users/me/.opencode/bin/opencode',
    version: '1.15.4',
    selectedModel: 'opencode/big-pickle',
    auth: { status: 'ready', providers: ['providerA'] },
  });
  expect(status.models.map((model) => model.id)).toContain('opencode/big-pickle');
});

test('preserves registry session capabilities in stored Codex status', () => {
  const status = createStoredRuntimeStatus(CODEX_RUNTIME_DEF, {
    connected: true,
    command: '/Users/me/.local/bin/codex',
    selectedModel: 'gpt-5.5',
    lastDetectedVersion: 'codex-cli 0.139.0',
    authProviders: ['openai'],
  });

  expect(status.capabilities).toMatchObject({
    sessionSpecify: false,
    sessionResume: true,
    sessionCapture: true,
  });
});

test('creates stored Claude status with current fallback models when stored snapshot is stale', () => {
  const status = createStoredRuntimeStatus(CLAUDE_CODE_RUNTIME_DEF, {
    connected: true,
    command: '/Users/me/.local/bin/claude',
    selectedModel: 'default',
    models: [
      {
        runtime: 'claude-code',
        id: 'default',
        provider: 'claude-code',
        model: 'default',
        label: 'Claude Code · default',
      },
    ],
    lastDetectedVersion: '2.1.177 (Claude Code)',
    authProviders: ['anthropic'],
  });

  expect(status.models.map((model) => model.id)).toContain('sonnet');
  expect(status.models.map((model) => model.id)).toContain('claude-sonnet-4-5');
});
