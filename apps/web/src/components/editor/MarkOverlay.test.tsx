import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SberDesignerConfig } from '@sber-designer/llm-gateway';

import { useAgentRuntimeInventory } from '@/stores/agent-runtime-store';
import { useChatStore } from '@/stores/chat-store';
import { useEditorStore } from '@/stores/editor-store';
import { MarkOverlay } from './MarkOverlay';

/**
 * renderToStaticMarkup reads zustand's getServerSnapshot (the initial-state
 * object) — mutate it together with the live state so SSR sees the scenario.
 */
function setSsrEditorState(partial: Partial<Parameters<typeof useEditorStore.getState>[0]>) {
  Object.assign(useEditorStore.getInitialState(), partial);
  useEditorStore.setState(partial);
}

const CONFIG = {
  agent: { default: { provider: 'acme', model: 'acme-vision' } },
  provider: {
    acme: {
      type: 'openai-compatible',
      name: 'Acme',
      models: {
        'acme-text': {},
        'acme-vision': { vision: true },
      },
    },
  },
  mcpServers: {},
} as unknown as SberDesignerConfig;

function renderOverlay() {
  return renderToStaticMarkup(<MarkOverlay iframeRef={{ current: null }} />);
}

function resetRuntimeInventory() {
  Object.assign(useAgentRuntimeInventory.getInitialState(), {
    statuses: [],
    enabledKinds: [],
    loading: false,
    loaded: false,
    error: null,
    refreshing: false,
  });
  useAgentRuntimeInventory.setState({
    statuses: [],
    enabledKinds: [],
    loading: false,
    loaded: false,
    error: null,
    refreshing: false,
  });
}

test('annotate opens with the Pen tool active', () => {
  setSsrEditorState({ config: CONFIG, active: { provider: 'acme', model: 'acme-vision' } });
  resetRuntimeInventory();
  const html = renderOverlay();
  // The dock tool button reflects the current tool: Pen, not Box.
  expect(html).toContain('lucide-pen-line');
  expect(html).not.toContain('lucide-square');
});

test('no active model shows the blocking preflight before any drawing or send', () => {
  setSsrEditorState({ config: CONFIG, active: null });
  resetRuntimeInventory();
  const html = renderOverlay();
  expect(html).toContain('role="alert"');
  expect(html).toContain('Choose an active model before sending a canvas annotation.');
  // Send carries the same reason in its tooltip.
  expect(html).toContain('title="Choose an active model before sending a canvas annotation."');
});

test('text-only model blocks Send with a vision hint while Add to input stays usable', () => {
  setSsrEditorState({ config: CONFIG, active: { provider: 'acme', model: 'acme-text' } });
  resetRuntimeInventory();
  const html = renderOverlay();
  expect(html).toContain('role="alert"');
  expect(html).toContain('cannot read canvas screenshots');
  expect(html).toContain('You can still use “Add to input”.');
});

test('switching to a vision-capable model lifts the block without losing the composer', () => {
  setSsrEditorState({ config: CONFIG, active: { provider: 'acme', model: 'acme-text' } });
  resetRuntimeInventory();
  expect(renderOverlay()).toContain('role="alert"');
  setSsrEditorState({ config: CONFIG, active: { provider: 'acme', model: 'acme-vision' } });
  const html = renderOverlay();
  expect(html).not.toContain('role="alert"');
  expect(html).toContain('title="Send the mark to the assistant"');
});

test('clear-message control exists and starts disabled on an empty note', () => {
  setSsrEditorState({ config: CONFIG, active: { provider: 'acme', model: 'acme-vision' } });
  resetRuntimeInventory();
  const html = renderOverlay();
  expect(html).toContain('aria-label="Clear message"');
  expect(html).toContain('title="Clear message"');
  expect(html).not.toContain('Close Annotate layer');
});
