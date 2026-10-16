import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

import { buildAssistantModelSwitcherState, runtimeProviderLabel } from './AssistantModelSwitcher';
import { runtimeOptions } from '../settings/cli-runtimes';
import {
  CLAUDE_CODE_RUNTIME_PROVIDER_ID,
  CODEX_RUNTIME_PROVIDER_ID,
  GIGACODE_RUNTIME_PROVIDER_ID,
  KIMI_RUNTIME_PROVIDER_ID,
  OPENCODE_RUNTIME_PROVIDER_ID,
  type AgentRuntimeStatus,
} from '@/lib/api/agent-runs';

function runtime(
  overrides: Partial<AgentRuntimeStatus> & Pick<AgentRuntimeStatus, 'kind'>,
): AgentRuntimeStatus {
  return {
    kind: overrides.kind,
    displayName: overrides.displayName ?? overrides.kind,
    installed: overrides.installed ?? true,
    connected: overrides.connected ?? true,
    command: overrides.command ?? overrides.kind,
    version: overrides.version ?? '1.0.0',
    selectedModel: overrides.selectedModel,
    auth: overrides.auth ?? { status: 'ready', providers: [] },
    models: overrides.models ?? [],
    mcpServers: overrides.mcpServers ?? [],
    capabilities: overrides.capabilities ?? {
      modelList: true,
      mcpList: false,
      runJson: true,
      modelFlag: true,
      promptViaStdin: true,
      jsonEventStream: true,
      cancel: true,
      usesOwnMcpConfig: true,
      supportsProjectMcpHandoff: true,
      chatHandoff: true,
      imageInputMode: 'none',
      rasterImageInput: false,
      svgSourceInput: false,
      nativeFileInput: false,
    },
    diagnostics: overrides.diagnostics ?? [],
  };
}

describe('runtimeProviderLabel', () => {
  test('uses concise product labels for CLI runtimes', () => {
    expect(runtimeProviderLabel(OPENCODE_RUNTIME_PROVIDER_ID)).toBe('OpenCode');
    expect(runtimeProviderLabel(CLAUDE_CODE_RUNTIME_PROVIDER_ID)).toBe('Claude Code');
    expect(runtimeProviderLabel(CODEX_RUNTIME_PROVIDER_ID)).toBe('Codex CLI');
    expect(runtimeProviderLabel(KIMI_RUNTIME_PROVIDER_ID)).toBe('Kimi Code CLI');
    expect(runtimeProviderLabel(GIGACODE_RUNTIME_PROVIDER_ID)).toBe('GigaCode');
  });
});

describe('buildAssistantModelSwitcherState', () => {
  test('builds API and connected local CLI provider options with normalized model labels', () => {
    const state = buildAssistantModelSwitcherState({
      active: { provider: CLAUDE_CODE_RUNTIME_PROVIDER_ID, model: 'default' },
      apiModels: [
        {
          provider: 'openrouter',
          model: 'deepseek/deepseek-v4-flash',
          label: 'OpenRouter · DeepSeek V4 Flash',
        },
      ],
      runtimeStatuses: [
        runtime({
          kind: 'claude-code',
          displayName: 'Claude Code',
          selectedModel: 'default',
          models: [
            {
              runtime: 'claude-code',
              id: 'claude-sonnet-4-5',
              provider: 'claude-code',
              model: 'claude-sonnet-4-5',
              label: 'Sonnet (alias)',
            },
          ],
        }),
      ],
    });

    expect(state.mode).toBe('cli');
    expect(state.triggerIntentLabel).toBe('Next run model');
    expect(state.triggerLabel).toBe('Default (CLI config)');
    expect(state.triggerTitle).toBe('Next run model: Claude Code · Default (CLI config)');
    expect(state.cliProviders.map((provider) => provider.providerId)).toEqual([
      CLAUDE_CODE_RUNTIME_PROVIDER_ID,
    ]);
    expect(state.modelOptions.map((option) => option.value)).toEqual([
      'default',
      'claude-sonnet-4-5',
    ]);
    expect(state.apiProviders[0]?.models[0]?.label).toBe('OpenRouter · DeepSeek V4 Flash');
  });

  test('surfaces Codex invalid config diagnostics as a blocked provider state', () => {
    const state = buildAssistantModelSwitcherState({
      active: { provider: CODEX_RUNTIME_PROVIDER_ID, model: 'default' },
      apiModels: [],
      runtimeStatuses: [
        runtime({
          kind: 'codex',
          diagnostics: [
            {
              code: 'runtime_config_invalid',
              severity: 'error',
              message: 'Invalid service_tier: priority. Use fast or flex.',
            },
          ],
        }),
      ],
    });

    const codex = state.cliProviders.find(
      (provider) => provider.providerId === CODEX_RUNTIME_PROVIDER_ID,
    );
    expect(codex?.blocked).toBe(true);
    expect(codex?.diagnostic).toContain('Invalid service_tier');
  });

  test('shows GigaCode catalogue metadata without inserting a default model', () => {
    const state = buildAssistantModelSwitcherState({
      active: { provider: GIGACODE_RUNTIME_PROVIDER_ID, model: 'Qwen3.6-35B' },
      apiModels: [],
      runtimeStatuses: [
        runtime({
          kind: 'gigacode',
          selectedModel: 'Qwen3.6-35B',
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
        }),
      ],
    });

    expect(state.modelOptions).toEqual([
      {
        value: 'Qwen3.6-35B',
        label: 'Qwen3.6-35B',
        description: 'Qwen3.6-35B-262k · 262k context',
      },
    ]);
    expect(state.modelOptions.some((option) => option.value === 'default')).toBe(false);
  });

  test('hides disconnected CLI providers even when the runtime is system-enabled', () => {
    const state = buildAssistantModelSwitcherState({
      active: { provider: OPENCODE_RUNTIME_PROVIDER_ID, model: 'default' },
      apiModels: [],
      runtimeStatuses: [
        runtime({ kind: 'opencode' }),
        runtime({ kind: 'kimi', installed: false, connected: false, command: null, version: null }),
      ],
      enabledRuntimeKinds: ['opencode', 'kimi'],
    });

    expect(state.cliProviders.map((provider) => provider.providerId)).toEqual([
      OPENCODE_RUNTIME_PROVIDER_ID,
    ]);
    expect(
      state.cliProviders.some((provider) => provider.providerId === KIMI_RUNTIME_PROVIDER_ID),
    ).toBe(false);
  });

  test('uses only the selected API model in the compact trigger label', () => {
    const state = buildAssistantModelSwitcherState({
      active: { provider: 'openrouter', model: 'deepseek/deepseek-v4-pro' },
      apiModels: [
        {
          provider: 'openrouter',
          model: 'deepseek/deepseek-v4-pro',
          label: 'OpenRouter · DeepSeek V4 Pro',
        },
      ],
      apiProviders: [
        {
          providerId: 'openrouter',
          label: 'OpenRouter',
          statusLabel: 'ready',
          statusTone: 'ok',
        },
      ],
      runtimeStatuses: [],
    });

    expect(state.mode).toBe('api');
    expect(state.triggerProviderId).toBe('openrouter');
    expect(state.triggerIntentLabel).toBe('Next run model');
    expect(state.triggerLabel).toBe('DeepSeek V4 Pro');
    expect(state.triggerTitle).toBe('Next run model: OpenRouter · DeepSeek V4 Pro');
  });

  test('keeps API provider statuses and injects the active model when the live list is stale', () => {
    const state = buildAssistantModelSwitcherState({
      active: { provider: 'openrouter', model: 'deepseek/deepseek-v4-pro' },
      apiModels: [],
      apiProviders: [
        {
          providerId: 'gigachat',
          label: 'GigaChat',
          statusLabel: 'env missing',
          statusTone: 'warn',
        },
        {
          providerId: 'openrouter',
          label: 'OpenRouter',
          statusLabel: 'ready',
          statusTone: 'ok',
        },
      ],
      runtimeStatuses: [],
    });

    expect(
      state.apiProviders.map((provider) => [provider.providerId, provider.statusLabel]),
    ).toEqual([
      ['gigachat', 'env missing'],
      ['openrouter', 'ready'],
    ]);
    expect(state.modelOptions).toEqual([
      { value: 'deepseek/deepseek-v4-pro', label: 'deepseek/deepseek-v4-pro' },
    ]);
  });

  test('does not reinsert a disabled active API provider', () => {
    const state = buildAssistantModelSwitcherState({
      active: { provider: 'disabled-provider', model: 'model-a' },
      apiModels: [{ provider: 'enabled-provider', model: 'model-b', label: 'Enabled · Model B' }],
      apiProviders: [{ providerId: 'enabled-provider', label: 'Enabled' }],
      runtimeStatuses: [],
    });

    expect(state.apiProviders.map((provider) => provider.providerId)).toEqual(['enabled-provider']);
    expect(state.apiProviders.some((provider) => provider.providerId === 'disabled-provider')).toBe(
      false,
    );
  });
});

test('Settings model options carry GigaCode metadata without a synthetic default', () => {
  const options = runtimeOptions(
    runtime({
      kind: 'gigacode',
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
    }),
    GIGACODE_RUNTIME_PROVIDER_ID,
    'GigaCode',
  );

  expect(options).toEqual([
    {
      provider: GIGACODE_RUNTIME_PROVIDER_ID,
      model: 'Qwen3.6-35B',
      label: 'GigaCode · Qwen3.6-35B',
      description: 'Qwen3.6-35B-262k · 262k context',
    },
  ]);
});

test('runtime changes in Settings refresh the shared Assistant runtime inventory', async () => {
  // 0138 D4: Assistant, Settings and Annotate read one shared runtime
  // inventory; the change-event refetch lives in the store now, so the
  // invariant is "event → shared reload" plus "Assistant consumes the store".
  const [providerStateSource, runtimeStoreSource, runtimeSettingsSource] = await Promise.all([
    readFile('apps/web/src/components/editor/chat/useChatProviderState.ts', 'utf8'),
    readFile('apps/web/src/stores/agent-runtime-store.ts', 'utf8'),
    readFile('apps/web/src/components/editor/settings/cli-runtimes.tsx', 'utf8'),
  ]);

  expect(providerStateSource).toContain('useAgentRuntimeInventory');
  expect(runtimeStoreSource).toContain('AGENT_RUNTIMES_CHANGED_EVENT');
  expect(runtimeStoreSource).toContain('window.addEventListener(AGENT_RUNTIMES_CHANGED_EVENT');
  expect(runtimeSettingsSource).toContain('notifyAgentRuntimesChanged()');
  expect(runtimeSettingsSource).toContain('Sign in to GigaCode');
  expect(runtimeSettingsSource).toContain("writeText('gigacode auth')");
  expect(runtimeSettingsSource).toContain('Check again');
  expect(runtimeSettingsSource).toContain('refreshAgentRuntime(runtimeKind)');
});
