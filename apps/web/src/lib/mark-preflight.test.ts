import { describe, expect, test } from 'bun:test';

import { resolveAgentModelTarget, type AgentModelTarget } from '@/lib/agent-model-target';
import type { AgentRuntimeKind, AgentRuntimeStatus } from '@/lib/api/agent-runs';
import type { SberDesignerConfig } from '@sber-designer/llm-gateway';
import { gateMarkSendForTarget, markCapabilityNotice } from './mark-preflight';

function runtime(
  kind: AgentRuntimeKind,
  capabilities: Partial<AgentRuntimeStatus['capabilities']>,
): AgentRuntimeStatus {
  return {
    kind,
    displayName: kind,
    installed: true,
    connected: true,
    command: kind,
    version: '1.0.0',
    auth: { status: 'ready', providers: [] },
    models: [],
    mcpServers: [],
    capabilities: {
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
      imageDeliveryMode: 'none',
      rasterImageInput: false,
      svgSourceInput: false,
      nativeFileInput: false,
      ...capabilities,
    },
    diagnostics: [],
  };
}

const config = {
  agent: { default: { provider: 'acme', model: 'acme-text' } },
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

function target(
  model: string,
  runtimeStatuses: AgentRuntimeStatus[] = [],
): AgentModelTarget | null {
  return resolveAgentModelTarget({
    config,
    active: { provider: 'acme', model },
    runtimeStatuses,
  });
}

describe('markCapabilityNotice', () => {
  test('no active model blocks with a choose-model message', () => {
    const notice = markCapabilityNotice(null);
    expect(notice).toEqual({
      level: 'blocked',
      message: 'Choose an active model before sending a canvas annotation.',
    });
  });

  test('vision-capable API model and cli-native runtime show no blocking message', () => {
    expect(markCapabilityNotice(target('acme-vision'))).toBeNull();
    const codex = resolveAgentModelTarget({
      config,
      active: { provider: 'codex-runtime', model: 'gpt-x' },
      runtimeStatuses: [runtime('codex', { imageInputMode: 'cli-native', rasterImageInput: true })],
    });
    expect(markCapabilityNotice(codex)).toBeNull();
  });

  test('text-only API model blocks and names the target label', () => {
    const notice = markCapabilityNotice(target('acme-text'));
    expect(notice?.level).toBe('blocked');
    expect(notice?.message).toContain('cannot read canvas screenshots');
    expect(notice?.message).toContain('Add to input');
  });

  test('cli-files-warning runtime warns without blocking', () => {
    const claude = resolveAgentModelTarget({
      config,
      active: { provider: 'claude-code-runtime', model: 'sonnet' },
      runtimeStatuses: [
        runtime('claude-code', {
          imageInputMode: 'cli-files-warning',
          imageDeliveryMode: 'prompt_path',
        }),
      ],
    });
    const notice = markCapabilityNotice(claude);
    expect(notice?.level).toBe('warning');
    expect(notice?.message).toContain('workspace file paths');
  });
});

describe('gateMarkSendForTarget', () => {
  const rasterAttachment = [{ kind: 'image' as const, name: 'canvas.png', mimeType: 'image/png' }];

  test('incompatible target blocks send with the validator detail', () => {
    const gate = gateMarkSendForTarget(target('acme-text'), rasterAttachment);
    expect(gate.blocked).toBe(true);
    if (gate.blocked) expect(gate.message).toContain('cannot read raster image attachments');
  });

  test('warning and compatible targets do not block', () => {
    const claude = resolveAgentModelTarget({
      config,
      active: { provider: 'claude-code-runtime', model: 'sonnet' },
      runtimeStatuses: [
        runtime('claude-code', {
          imageInputMode: 'cli-files-warning',
          imageDeliveryMode: 'prompt_path',
        }),
      ],
    });
    expect(gateMarkSendForTarget(claude, rasterAttachment).blocked).toBe(false);
    expect(gateMarkSendForTarget(target('acme-vision'), rasterAttachment).blocked).toBe(false);
  });

  test('note-only submissions without images are never blocked', () => {
    expect(gateMarkSendForTarget(target('acme-text'), []).blocked).toBe(false);
  });
});
