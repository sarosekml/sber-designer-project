import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SberDesignerConfig } from '@sber-designer/llm-gateway';
import type { AgentRuntimeKind, AgentRuntimeStatus } from '@/lib/api/agent-runs';
import { useAgentRuntimeInventory } from '@/stores/agent-runtime-store';
import { useEditorStore } from '@/stores/editor-store';
import {
  CLI_RUNTIME_ROW_DEFS,
  ConnectionTestBlock,
  LlmProvidersSettingsPanel,
  ActiveModelInfoBlock,
  cliRuntimeRowDefs,
  connectionRecordIsCurrent,
  connectionTestTargetForActive,
  initialProvidersTabForActive,
} from './providers';
import { CLAUDE_CODE_RUNTIME_PROVIDER_ID, CODEX_RUNTIME_PROVIDER_ID } from '@/lib/api/agent-runs';

/**
 * renderToStaticMarkup reads zustand's getServerSnapshot, which is the store's
 * initial-state object — mutate it (and the live state) so SSR sees the
 * scenario's store values.
 */
function setSsrEditorState(partial: Partial<Parameters<typeof useEditorStore.getState>[0]>) {
  Object.assign(useEditorStore.getInitialState(), partial);
  useEditorStore.setState(partial);
}

function setSsrRuntimeState(partial: {
  statuses?: AgentRuntimeStatus[];
  enabledKinds?: AgentRuntimeKind[];
  loaded?: boolean;
  loading?: boolean;
  error?: string | null;
}) {
  Object.assign(useAgentRuntimeInventory.getInitialState(), partial);
  useAgentRuntimeInventory.setState(partial);
}

function configWithProviders(): SberDesignerConfig {
  return {
    agent: { default: { provider: 'acme', model: 'acme-vision' } },
    provider: {
      acme: {
        type: 'openai-compatible',
        name: 'Acme Cloud',
        models: { 'acme-vision': { vision: true } },
      },
    },
    mcpServers: {},
  } as unknown as SberDesignerConfig;
}

function renderPanel(): string {
  return renderToStaticMarkup(
    <LlmProvidersSettingsPanel
      configError={null}
      active={useEditorStore.getState().active}
      setActive={() => undefined}
      models={[]}
      enabledProviderIds={['acme']}
      onProviderEnabledChange={() => undefined}
    />,
  );
}

describe('initialProvidersTabForActive', () => {
  test('CLI runtime active model opens the CLI tab, API/null opens the API tab', () => {
    expect(initialProvidersTabForActive({ provider: CLAUDE_CODE_RUNTIME_PROVIDER_ID })).toBe('cli');
    expect(initialProvidersTabForActive({ provider: CODEX_RUNTIME_PROVIDER_ID })).toBe('cli');
    expect(initialProvidersTabForActive({ provider: 'acme' })).toBe('api');
    expect(initialProvidersTabForActive(null)).toBe('api');
  });
});

describe('cliRuntimeRowDefs', () => {
  test('returns exactly the enabled kinds, each in one group only', () => {
    const enabled: AgentRuntimeKind[] = ['claude-code', 'gigacode'];
    const defs = cliRuntimeRowDefs(enabled);
    expect(defs.map((def) => def.kind)).toEqual(['claude-code', 'gigacode']);
    const allKinds = new Set(CLI_RUNTIME_ROW_DEFS.map((def) => def.kind));
    for (const def of defs) expect(allKinds.has(def.kind)).toBe(true);
    expect(cliRuntimeRowDefs([])).toEqual([]);
  });
});

describe('ActiveModelInfoBlock copy', () => {
  test('shows the SVG limit and relative settings paths, never an absolute path', () => {
    const html = renderToStaticMarkup(<ActiveModelInfoBlock svgMaxBytes={5 * 1024 * 1024} />);
    expect(html).toContain('5 MB');
    expect(html).toContain('./sber-designer.json');
    expect(html).toContain('./sber-designer.local.json');
    expect(html).toContain('relative to the sber-designer root');
    expect(html).not.toContain('/Users/');
    expect(html).not.toContain('/home/');
  });
});

describe('LlmProvidersSettingsPanel tabs', () => {
  test('API active model shows API rows without CLI rows on first open', () => {
    setSsrEditorState({ config: configWithProviders(), active: null });
    setSsrRuntimeState({
      statuses: [],
      enabledKinds: ['claude-code'],
      loaded: true,
      loading: false,
      error: null,
    });
    const html = renderPanel();
    expect(html).toContain('Acme Cloud');
    expect(html).toContain('API providers');
    expect(html).toContain('Local CLI agents');
    // Only the API tab panel content is mounted; CLI rows stay out.
    expect(html).not.toContain('local-cli');
    expect(html).not.toContain('Uses the installed Claude Code login');
    expect(html).toContain('Settings file');
    expect(html).not.toContain('/Users/');
  });

  test('CLI active model opens the CLI tab with runtime rows and refresh control', () => {
    setSsrEditorState({
      config: configWithProviders(),
      active: { provider: CLAUDE_CODE_RUNTIME_PROVIDER_ID, model: 'default' },
    });
    setSsrRuntimeState({
      statuses: [],
      enabledKinds: ['claude-code', 'codex'],
      loaded: true,
      loading: false,
      error: null,
    });
    const html = renderPanel();
    expect(html).toContain('Refresh connected runtimes');
    expect(html).toContain('Uses the installed Claude Code login');
    expect(html).toContain('Uses the installed Codex login');
    expect(html).toContain('local-cli');
    // API tab content is not mounted while the CLI tab is active.
    expect(html).not.toContain('Acme Cloud');
  });

  test('empty CLI tab explains that agents are not enabled or detected', () => {
    setSsrEditorState({
      config: configWithProviders(),
      active: { provider: CLAUDE_CODE_RUNTIME_PROVIDER_ID, model: 'default' },
    });
    setSsrRuntimeState({
      statuses: [],
      enabledKinds: [],
      loaded: true,
      loading: false,
      error: null,
    });
    const html = renderPanel();
    expect(html).toContain(
      'Local CLI agents are not enabled on this server or none were detected.',
    );
  });
});

describe('connectionTestTargetForActive', () => {
  const config = configWithProviders();

  test('accepts configured chat-capable API providers', () => {
    expect(
      connectionTestTargetForActive({ provider: 'acme', model: 'acme-vision' }, config),
    ).toEqual({ provider: 'acme', model: 'acme-vision' });
  });

  test('rejects CLI runtimes, unknown providers, and non-chat provider types', () => {
    expect(
      connectionTestTargetForActive(
        { provider: CLAUDE_CODE_RUNTIME_PROVIDER_ID, model: 'x' },
        config,
      ),
    ).toBeNull();
    expect(connectionTestTargetForActive({ provider: 'ghost', model: 'x' }, config)).toBeNull();
    expect(connectionTestTargetForActive(null, config)).toBeNull();
    expect(connectionTestTargetForActive({ provider: 'acme', model: 'x' }, null)).toBeNull();
    const bridgeConfig = {
      ...config,
      provider: {
        'cli-bridge': {
          type: 'claude-code' as const,
          name: 'Bridge',
          models: { x: { name: 'x' } },
        },
      },
    } as unknown as SberDesignerConfig;
    expect(
      connectionTestTargetForActive({ provider: 'cli-bridge', model: 'x' }, bridgeConfig),
    ).toBeNull();
  });
});

describe('ConnectionTestBlock', () => {
  test('renders an idle test action that requires an explicit click', () => {
    const html = renderToStaticMarkup(
      <ConnectionTestBlock
        active={{ provider: 'acme', model: 'acme-vision' }}
        config={configWithProviders()}
      />,
    );
    expect(html).toContain('Test connection');
    expect(html).toContain('Connection test');
    // No result is shown before any test ran.
    expect(html).not.toContain('connection verified');
    expect(html).not.toContain('connection failed');
  });

  test('keeps the action disabled-looking copy for non-testable selections', () => {
    const html = renderToStaticMarkup(
      <ConnectionTestBlock
        active={{ provider: CLAUDE_CODE_RUNTIME_PROVIDER_ID, model: 'default' }}
        config={configWithProviders()}
      />,
    );
    expect(html).toContain('Select an API provider model above');
    expect(html).not.toContain('connection verified');
  });
});

describe('connectionRecordIsCurrent (review R4)', () => {
  const record = {
    provider: 'zai-coding-plan',
    model: 'glm-5.3',
    revision: 'rev-a',
    checkedAt: 1_700_000_000_000,
  };

  test('a result is current only for the same provider, model and revision', () => {
    expect(
      connectionRecordIsCurrent(record, {
        provider: 'zai-coding-plan',
        model: 'glm-5.3',
        revision: 'rev-a',
      }),
    ).toBe(true);

    // Model switch invalidates…
    expect(
      connectionRecordIsCurrent(record, {
        provider: 'zai-coding-plan',
        model: 'glm-5.3-flash',
        revision: 'rev-a',
      }),
    ).toBe(false);
    // …provider switch invalidates…
    expect(
      connectionRecordIsCurrent(record, {
        provider: 'deepseek',
        model: 'glm-5.3',
        revision: 'rev-a',
      }),
    ).toBe(false);
    // …and a server-side endpoint/auth change invalidates even the same target.
    expect(
      connectionRecordIsCurrent(record, {
        provider: 'zai-coding-plan',
        model: 'glm-5.3',
        revision: 'rev-b',
      }),
    ).toBe(false);
    // A→B→A does not resurrect the stored result: the scope identity is the
    // tuple, and returning to it after invalidation requires a fresh record
    // (the component drops stored state on every scope change).
    expect(connectionRecordIsCurrent(null, null)).toBe(false);
    expect(connectionRecordIsCurrent(record, null)).toBe(false);
    expect(connectionRecordIsCurrent(null, { provider: 'x', model: 'y' })).toBe(false);

    // The static offline fallback has no revision — undefined matches undefined.
    expect(
      connectionRecordIsCurrent(
        { provider: 'p', model: 'm', checkedAt: 1 },
        { provider: 'p', model: 'm' },
      ),
    ).toBe(true);
  });
});
