import { describe, expect, test } from 'bun:test';
import type { SberDesignerConfig } from '@sber-designer/llm-gateway';
import {
  DESIGN_SYSTEM_ASSISTANT_SCREEN_ID,
  STORYBOOK_ASSISTANT_SCREEN_ID,
  useChatStore,
} from './chat-store';
import { useEditorStore } from './editor-store';
import { useProjectStore } from './project-store';

const selectedNode = {
  loc: 'dom://button',
  tagName: 'BUTTON',
  rect: { x: 0, y: 0, width: 100, height: 32 },
};

describe('editor store view switching', () => {
  test('leaving edit for demo or flow returns the canvas to screen view', () => {
    useEditorStore.setState({
      view: 'edit',
      canvasView: 'storybook',
      activeComponentId: 'components-button',
      selected: selectedNode,
      selectedCommentId: 'comment-1',
      commentContextMode: 'custom',
      commentContextIds: ['comment-1'],
      assistantTaskIntent: {
        kind: 'edit-current-screen',
        targetScreenId: 'screen-1',
      },
    });

    useEditorStore.getState().setView('demo');

    expect(useEditorStore.getState()).toMatchObject({
      view: 'demo',
      canvasView: 'screen',
      activeComponentId: null,
      selected: null,
      selectedCommentId: null,
      commentContextMode: 'all',
      commentContextIds: [],
      assistantTaskIntent: null,
    });

    useEditorStore.setState({
      view: 'edit',
      canvasView: 'storybook',
      activeComponentId: 'components-card',
      selected: selectedNode,
    });

    useEditorStore.getState().setView('flow');

    expect(useEditorStore.getState()).toMatchObject({
      view: 'flow',
      canvasView: 'screen',
      activeComponentId: null,
      selected: null,
    });
  });

  test('selecting another screen does not clear assistant target preference', () => {
    useEditorStore.setState({
      activeScreenId: 'screen-1',
      assistantTargetPreference: 'current-screen',
      assistantTaskIntent: {
        kind: 'edit-current-screen',
        targetScreenId: 'screen-1',
      },
    });

    useEditorStore.getState().setActiveScreenId('screen-2');

    expect(useEditorStore.getState()).toMatchObject({
      activeScreenId: 'screen-2',
      assistantTargetPreference: 'current-screen',
      assistantTaskIntent: null,
    });
  });

  test('records the source of a screen selection for transition precedence', () => {
    useEditorStore.setState({
      activeScreenId: 'screen-1',
      activeScreenSelectionSource: 'programmatic',
      openScreenTabIds: [],
    });

    useEditorStore.getState().setActiveScreenId('screen-2', { source: 'user' });
    expect(useEditorStore.getState().activeScreenSelectionSource).toBe('user');
    expect(useEditorStore.getState().openScreenTabIds).toEqual(['screen-2']);

    useEditorStore.getState().setActiveScreenId('screen-3', { source: 'flow' });
    expect(useEditorStore.getState().activeScreenSelectionSource).toBe('flow');
    expect(useEditorStore.getState().openScreenTabIds).toEqual(['screen-2']);
  });

  test('closing the active screen tab selects its right neighbor without cancelling run state', () => {
    useEditorStore.setState({
      activeScreenId: 'screen-2',
      openScreenTabIds: ['screen-1', 'screen-2', 'screen-3'],
    });

    useEditorStore.getState().closeScreenTab('screen-2');

    expect(useEditorStore.getState()).toMatchObject({
      activeScreenId: 'screen-3',
      openScreenTabIds: ['screen-1', 'screen-3'],
    });
  });

  test('screen preview revisions are scoped and Storybook resets the passive pool epoch', () => {
    useEditorStore.setState({
      canvasView: 'screen',
      screenPreviewRevisions: {},
      screenPreviewEpoch: 0,
    });

    useEditorStore.getState().invalidateScreenPreview('screen-2');
    expect(useEditorStore.getState().screenPreviewRevisions).toEqual({ 'screen-2': 1 });

    useEditorStore.getState().setCanvasView('storybook');
    expect(useEditorStore.getState().screenPreviewEpoch).toBe(1);
  });

  test('screen canvas always returns assistant targeting to current screen', () => {
    useEditorStore.setState({
      canvasView: 'screen',
      assistantTargetPreference: 'current-screen',
    });

    useEditorStore.getState().setCanvasView('storybook');
    expect(useEditorStore.getState().assistantTargetPreference).toBe('auto');

    useEditorStore.getState().setCanvasView('screen');

    expect(useEditorStore.getState().assistantTargetPreference).toBe('current-screen');
  });

  test('Screen info is session-only and closes when the canvas enters a resource view', () => {
    useEditorStore.setState({ canvasView: 'screen', screenInfoOpen: false });
    useEditorStore.getState().setScreenInfoOpen(true);
    expect(useEditorStore.getState().screenInfoOpen).toBe(true);

    useEditorStore.getState().setCanvasView('storybook');

    expect(useEditorStore.getState().screenInfoOpen).toBe(false);
  });

  test('canvas reload key is monotonic for background iframe refreshes', () => {
    useEditorStore.setState({ canvasReloadKey: 0 });

    useEditorStore.getState().bumpCanvasReloadKey();
    useEditorStore.getState().bumpCanvasReloadKey();

    expect(useEditorStore.getState().canvasReloadKey).toBe(2);
  });

  test('selecting another screen switches the visible assistant thread', () => {
    useChatStore.getState().reset();
    useChatStore.getState().switchToScreen('screen-1');
    useChatStore.getState().appendUser('Screen one message');

    useEditorStore.getState().setActiveScreenId('screen-2');
    useChatStore.getState().appendUser('Screen two message');

    expect(useChatStore.getState().messages.map((message) => message.content)).toContain(
      'Screen two message',
    );
    expect(useChatStore.getState().messages.map((message) => message.content)).not.toContain(
      'Screen one message',
    );

    useEditorStore.getState().setActiveScreenId('screen-1');

    expect(useChatStore.getState().messages.map((message) => message.content)).toContain(
      'Screen one message',
    );
  });

  test('storybook canvas uses one shared assistant thread instead of the active screen thread', () => {
    useChatStore.getState().reset();
    useEditorStore.setState({
      activeScreenId: 'screen-1',
      canvasView: 'screen',
      activeComponentId: null,
    });
    useChatStore.getState().switchToScreen('screen-1');
    useChatStore.getState().appendUser('Screen-only history');

    useEditorStore.getState().setCanvasView('storybook');

    expect(useChatStore.getState().activeScreenId).toBe(STORYBOOK_ASSISTANT_SCREEN_ID);
    expect(useChatStore.getState().messages.map((message) => message.content)).not.toContain(
      'Screen-only history',
    );

    useChatStore.getState().appendUser('Shared Storybook history');
    useEditorStore.getState().setCanvasView('screen');

    expect(useChatStore.getState().activeScreenId).toBe('screen-1');
    expect(useChatStore.getState().messages.map((message) => message.content)).toContain(
      'Screen-only history',
    );
    expect(useChatStore.getState().messages.map((message) => message.content)).not.toContain(
      'Shared Storybook history',
    );

    useEditorStore.getState().setCanvasView('storybook');

    expect(useChatStore.getState().messages.map((message) => message.content)).toContain(
      'Shared Storybook history',
    );
  });

  test('design-system canvas has an isolated chat and mutually exclusive component/reference selection', () => {
    useChatStore.getState().reset();
    useEditorStore.setState({
      activeScreenId: 'screen-1',
      canvasView: 'screen',
      activeComponentId: null,
      activeDesignSystemReferencePath: null,
      mode: 'design',
      markActive: true,
    });
    useChatStore.getState().switchToScreen('screen-1');

    useEditorStore.getState().setCanvasView('design-system');

    expect(useChatStore.getState().activeScreenId).toBe(DESIGN_SYSTEM_ASSISTANT_SCREEN_ID);
    expect(useEditorStore.getState()).toMatchObject({
      canvasView: 'design-system',
      mode: 'interact',
      markActive: false,
      assistantTargetPreference: 'auto',
    });

    useEditorStore.getState().setActiveComponentId('css-catalog-button');
    useEditorStore.getState().setActiveDesignSystemReferencePath('design-system/refs/buttons.html');
    expect(useEditorStore.getState()).toMatchObject({
      activeComponentId: null,
      activeDesignSystemReferencePath: 'design-system/refs/buttons.html',
    });

    useEditorStore.getState().setActiveComponentId('css-catalog-card');
    expect(useEditorStore.getState()).toMatchObject({
      activeComponentId: 'css-catalog-card',
      activeDesignSystemReferencePath: null,
    });
  });

  test('craft post-check is enabled by default and can be toggled for agent runs', () => {
    useEditorStore.setState({
      agentCraftPostCheckEnabled: true,
    });

    expect(useEditorStore.getState().agentCraftPostCheckEnabled).toBe(true);

    useEditorStore.getState().setAgentCraftPostCheckEnabled(false);

    expect(useEditorStore.getState().agentCraftPostCheckEnabled).toBe(false);
  });

  test('screen readiness profile defaults to Standard and keeps legacy post-check boolean in sync', () => {
    useEditorStore.setState({
      agentCraftPostCheckEnabled: true,
    });

    expect(useEditorStore.getState().screenReadiness.profile).toBe('standard');
    expect(useEditorStore.getState().screenReadiness.categories.sourceIntegrity).toBe(true);

    useEditorStore.getState().setScreenReadiness({
      enabled: false,
      profile: 'custom',
      categories: {
        dataHonesty: false,
      },
    });

    expect(useEditorStore.getState().screenReadiness.enabled).toBe(false);
    expect(useEditorStore.getState().screenReadiness.profile).toBe('custom');
    expect(useEditorStore.getState().screenReadiness.categories.dataHonesty).toBe(false);
    expect(useEditorStore.getState().agentCraftPostCheckEnabled).toBe(false);

    useEditorStore.getState().setAgentCraftPostCheckEnabled(true);

    expect(useEditorStore.getState().screenReadiness.enabled).toBe(true);
    expect(useEditorStore.getState().agentCraftPostCheckEnabled).toBe(true);
  });

  test('config reload preserves persisted local CLI runtime selection', () => {
    const storage = new MemoryStorage();
    const previousWindow = installWindowStorage(storage);
    const config: SberDesignerConfig = {
      agent: { default: { provider: 'providerB', model: 'providerA/legacy-model' } },
      provider: {
        providerB: {
          type: 'openai-compatible',
          name: 'Provider B',
          models: { 'providerA/legacy-model': { name: 'Legacy model' } },
        },
      },
      mcpServers: {},
    };

    try {
      useEditorStore.setState({ active: null, config: null });
      useEditorStore.getState().setActive({
        provider: 'opencode-runtime',
        model: 'providerA/model-a',
      });
      useEditorStore.getState().setConfig(config);

      expect(useEditorStore.getState().active).toEqual({
        provider: 'opencode-runtime',
        model: 'providerA/model-a',
      });
      expect(storage.getItem('sber-designer.activeAgent')).toBe(
        JSON.stringify({
          provider: 'opencode-runtime',
          model: 'providerA/model-a',
        }),
      );
    } finally {
      restoreWindowStorage(previousWindow);
      useEditorStore.setState({ active: null, config: null, configError: null });
    }
  });

  test('config reload preserves persisted Codex CLI runtime selection', () => {
    const storage = new MemoryStorage();
    const previousWindow = installWindowStorage(storage);
    const config: SberDesignerConfig = {
      agent: { default: { provider: 'providerA', model: 'text-model' } },
      provider: {
        providerA: {
          type: 'openai-compatible',
          name: 'Provider A',
          models: { 'text-model': { name: 'Text model' } },
        },
      },
      mcpServers: {},
    };

    try {
      useEditorStore.setState({ active: null, config: null });
      useEditorStore.getState().setActive({
        provider: 'codex-runtime',
        model: 'vision-model',
      });
      useEditorStore.getState().setConfig(config);

      expect(useEditorStore.getState().active).toEqual({
        provider: 'codex-runtime',
        model: 'vision-model',
      });
      expect(storage.getItem('sber-designer.activeAgent')).toBe(
        JSON.stringify({
          provider: 'codex-runtime',
          model: 'vision-model',
        }),
      );
    } finally {
      restoreWindowStorage(previousWindow);
      useEditorStore.setState({ active: null, config: null, configError: null });
    }
  });

  test('config reload preserves persisted Claude Code CLI runtime selection', () => {
    const storage = new MemoryStorage();
    const previousWindow = installWindowStorage(storage);
    const config: SberDesignerConfig = {
      agent: { default: { provider: 'providerA', model: 'text-model' } },
      provider: {
        providerA: {
          type: 'openai-compatible',
          name: 'Provider A',
          models: { 'text-model': { name: 'Text model' } },
        },
      },
      mcpServers: {},
    };

    try {
      useEditorStore.setState({ active: null, config: null });
      useEditorStore.getState().setActive({
        provider: 'claude-code-runtime',
        model: 'selected-model',
      });
      useEditorStore.getState().setConfig(config);

      expect(useEditorStore.getState().active).toEqual({
        provider: 'claude-code-runtime',
        model: 'selected-model',
      });
      expect(storage.getItem('sber-designer.activeAgent')).toBe(
        JSON.stringify({
          provider: 'claude-code-runtime',
          model: 'selected-model',
        }),
      );
    } finally {
      restoreWindowStorage(previousWindow);
      useEditorStore.setState({ active: null, config: null, configError: null });
    }
  });

  test('disabled agent selection stays disabled across config reloads', () => {
    const storage = new MemoryStorage();
    const previousWindow = installWindowStorage(storage);
    const config: SberDesignerConfig = {
      agent: { default: { provider: 'providerA', model: 'text-model' } },
      provider: {
        providerA: {
          type: 'openai-compatible',
          name: 'Provider A',
          models: { 'text-model': { name: 'Text model' } },
        },
      },
      mcpServers: {},
    };

    try {
      useEditorStore.setState({ active: null, config: null });
      useEditorStore.getState().setActive(null);
      useEditorStore.getState().setConfig(config);

      expect(useEditorStore.getState().active).toBe(null);
      expect(storage.getItem('sber-designer.activeAgent')).toBe(JSON.stringify({ disabled: true }));
    } finally {
      restoreWindowStorage(previousWindow);
      useEditorStore.setState({ active: null, config: null, configError: null });
    }
  });

  test('setActive persists selected API provider and model', () => {
    const storage = new MemoryStorage();
    const previousWindow = installWindowStorage(storage);

    try {
      useEditorStore.setState({ active: null, config: null });
      useEditorStore.getState().setActive({
        provider: 'providerB',
        model: 'providerA/text-model',
      });

      expect(storage.getItem('sber-designer.activeAgent')).toBe(
        JSON.stringify({
          provider: 'providerB',
          model: 'providerA/text-model',
        }),
      );
    } finally {
      restoreWindowStorage(previousWindow);
      useEditorStore.setState({ active: null, config: null, configError: null });
    }
  });

  test('setActive does not mirror selected API provider to the loaded project', () => {
    const project = projectFixture();

    try {
      useProjectStore.getState().setBaseline(project);
      useEditorStore.setState({ active: null, config: null });
      useEditorStore.getState().setActive({
        provider: 'providerB',
        model: 'providerA/text-model',
      });

      expect(useProjectStore.getState().project?.agentDefault).toBeUndefined();
    } finally {
      resetProjectStore();
      useEditorStore.setState({ active: null, config: null, configError: null });
    }
  });

  test('setActive does not mutate a legacy project agent default when provider is disabled', () => {
    const project = {
      ...projectFixture(),
      agentDefault: { provider: 'providerB', model: 'providerA/text-model' },
    };

    try {
      useProjectStore.getState().setBaseline(project);
      useEditorStore.setState({ active: null, config: null });
      useEditorStore.getState().setActive(null);

      expect(useProjectStore.getState().project?.agentDefault).toEqual({
        provider: 'providerB',
        model: 'providerA/text-model',
      });
    } finally {
      resetProjectStore();
      useEditorStore.setState({ active: null, config: null, configError: null });
    }
  });

  test('config reload restores persisted API provider selections', () => {
    const storage = new MemoryStorage();
    const previousWindow = installWindowStorage(storage);
    const config: SberDesignerConfig = {
      agent: { default: { provider: 'providerA', model: 'text-model' } },
      provider: {
        providerA: {
          type: 'openai-compatible',
          name: 'Provider A',
          models: { 'text-model': { name: 'Text model' } },
        },
        providerB: {
          type: 'openai-compatible',
          name: 'Provider B',
          models: {
            'providerA/text-model': { name: 'Text model' },
          },
        },
      },
      mcpServers: {},
    };

    try {
      storage.setItem(
        'sber-designer.activeAgent',
        JSON.stringify({
          provider: 'providerB',
          model: 'providerA/text-model',
        }),
      );
      useEditorStore.setState({ active: null, config: null });
      useEditorStore.getState().setConfig(config);

      expect(useEditorStore.getState().active).toEqual({
        provider: 'providerB',
        model: 'providerA/text-model',
      });
      expect(storage.getItem('sber-designer.activeAgent')).toBe(
        JSON.stringify({
          provider: 'providerB',
          model: 'providerA/text-model',
        }),
      );
    } finally {
      restoreWindowStorage(previousWindow);
      useEditorStore.setState({ active: null, config: null, configError: null });
    }
  });

  test('config reload ignores legacy project default when local storage has no selection', () => {
    const storage = new MemoryStorage();
    const previousWindow = installWindowStorage(storage);
    const project = {
      ...projectFixture(),
      agentDefault: { provider: 'providerB', model: 'providerA/text-model' },
    };
    const config: SberDesignerConfig = {
      agent: { default: { provider: 'providerA', model: 'text-model' } },
      provider: {
        providerA: {
          type: 'openai-compatible',
          name: 'Provider A',
          models: { 'text-model': { name: 'Text model' } },
        },
        providerB: {
          type: 'openai-compatible',
          name: 'Provider B',
          models: {
            'providerA/text-model': { name: 'Text model' },
          },
        },
      },
      mcpServers: {},
    };

    try {
      useProjectStore.getState().setBaseline(project);
      useEditorStore.setState({ active: null, config: null });
      useEditorStore.getState().setConfig(config);

      expect(useEditorStore.getState().active).toEqual({
        provider: 'providerA',
        model: 'text-model',
      });
    } finally {
      restoreWindowStorage(previousWindow);
      resetProjectStore();
      useEditorStore.setState({ active: null, config: null, configError: null });
    }
  });

  test('config reload keeps disabled local storage instead of restoring legacy project default', () => {
    const storage = new MemoryStorage();
    const previousWindow = installWindowStorage(storage);
    const project = {
      ...projectFixture(),
      agentDefault: { provider: 'providerB', model: 'providerA/text-model' },
    };
    const config: SberDesignerConfig = {
      agent: { default: { provider: 'providerA', model: 'text-model' } },
      provider: {
        providerA: {
          type: 'openai-compatible',
          name: 'Provider A',
          models: { 'text-model': { name: 'Text model' } },
        },
        providerB: {
          type: 'openai-compatible',
          name: 'Provider B',
          models: {
            'providerA/text-model': { name: 'Text model' },
          },
        },
      },
      mcpServers: {},
    };

    try {
      storage.setItem('sber-designer.activeAgent', JSON.stringify({ disabled: true }));
      useProjectStore.getState().setBaseline(project);
      useEditorStore.setState({ active: null, config: null });
      useEditorStore.getState().setConfig(config);

      expect(useEditorStore.getState().active).toBe(null);
    } finally {
      restoreWindowStorage(previousWindow);
      resetProjectStore();
      useEditorStore.setState({ active: null, config: null, configError: null });
    }
  });

  test('config reload keeps current API provider selection when still available', () => {
    const storage = new MemoryStorage();
    const previousWindow = installWindowStorage(storage);
    const config: SberDesignerConfig = {
      agent: { default: { provider: 'providerA', model: 'text-model' } },
      provider: {
        providerA: {
          type: 'openai-compatible',
          name: 'Provider A',
          models: { 'text-model': { name: 'Text model' } },
        },
        providerB: {
          type: 'openai-compatible',
          name: 'Provider B',
          models: {
            'providerA/text-model': { name: 'Text model' },
          },
        },
      },
      mcpServers: {},
    };

    try {
      useEditorStore.setState({
        active: { provider: 'providerB', model: 'providerA/text-model' },
        config: null,
      });
      useEditorStore.getState().setConfig(config);

      expect(useEditorStore.getState().active).toEqual({
        provider: 'providerB',
        model: 'providerA/text-model',
      });
    } finally {
      restoreWindowStorage(previousWindow);
      useEditorStore.setState({ active: null, config: null, configError: null });
    }
  });

  test('config reload drops persisted API provider selection when it is no longer available', () => {
    const storage = new MemoryStorage();
    const previousWindow = installWindowStorage(storage);
    const config: SberDesignerConfig = {
      agent: { default: { provider: 'providerA', model: 'text-model' } },
      provider: {
        providerA: {
          type: 'openai-compatible',
          name: 'Provider A',
          models: { 'text-model': { name: 'Text model' } },
        },
      },
      mcpServers: {},
    };

    try {
      storage.setItem(
        'sber-designer.activeAgent',
        JSON.stringify({
          provider: 'providerB',
          model: 'providerA/text-model',
        }),
      );
      useEditorStore.setState({ active: null, config: null });
      useEditorStore.getState().setConfig(config);

      expect(useEditorStore.getState().active).toEqual({
        provider: 'providerA',
        model: 'text-model',
      });
      expect(storage.getItem('sber-designer.activeAgent')).toBe(null);
    } finally {
      restoreWindowStorage(previousWindow);
      useEditorStore.setState({ active: null, config: null, configError: null });
    }
  });
});

function projectFixture() {
  return {
    version: 1 as const,
    name: 'Project',
    workspacePath: '/workspace',
    screens: [],
    flow: [],
  };
}

function resetProjectStore(): void {
  useProjectStore.setState({
    project: null,
    baseline: null,
    saving: false,
    loadError: null,
    saveError: null,
  });
}

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function installWindowStorage(storage: MemoryStorage): unknown {
  const previousWindow = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: storage },
    configurable: true,
  });
  return previousWindow;
}

function restoreWindowStorage(previousWindow: unknown): void {
  if (previousWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
    return;
  }
  Object.defineProperty(globalThis, 'window', {
    value: previousWindow,
    configurable: true,
  });
}
