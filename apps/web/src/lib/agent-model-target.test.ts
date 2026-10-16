import { expect, test } from 'bun:test';
import type { SberDesignerConfig } from '@sber-designer/llm-gateway';

import {
  capabilityBadgesForAgentTarget,
  resolveAgentModelTarget,
  validateAttachmentsForAgentTarget,
} from './agent-model-target';
import type { AgentRuntimeStatus } from './api/agent-runs';

const config: SberDesignerConfig = {
  agent: { default: { provider: 'openrouter', model: 'cheap-text' } },
  provider: {
    openrouter: {
      type: 'openai-compatible',
      name: 'OpenRouter',
      models: {
        'cheap-text': { name: 'Cheap text', vision: false },
        'vision-model': { name: 'Vision model', vision: true },
      },
    },
  },
  mcpServers: {},
};

const pngAttachment = {
  id: 'att-png',
  kind: 'image' as const,
  name: 'reference.png',
  mimeType: 'image/png',
  size: 128,
};

type RuntimeStatusOverrides = Omit<Partial<AgentRuntimeStatus>, 'capabilities'> &
  Pick<AgentRuntimeStatus, 'kind'> & {
    capabilities?: Partial<AgentRuntimeStatus['capabilities']>;
  };

function runtimeStatus(overrides: RuntimeStatusOverrides): AgentRuntimeStatus {
  return {
    kind: overrides.kind,
    displayName: overrides.displayName ?? overrides.kind,
    installed: overrides.installed ?? true,
    connected: overrides.connected ?? true,
    command: overrides.command ?? '/usr/local/bin/runtime',
    version: overrides.version ?? 'runtime 1.0.0',
    selectedModel: overrides.selectedModel,
    auth: overrides.auth ?? { status: 'ready', providers: [] },
    models: overrides.models ?? [],
    mcpServers: overrides.mcpServers ?? [],
    capabilities: {
      modelList: false,
      mcpList: false,
      runJson: true,
      modelFlag: true,
      promptViaStdin: true,
      jsonEventStream: true,
      cancel: true,
      usesOwnMcpConfig: true,
      supportsProjectMcpHandoff: false,
      chatHandoff: true,
      imageInputMode: 'cli-files-warning',
      rasterImageInput: false,
      svgSourceInput: true,
      nativeFileInput: false,
      ...overrides.capabilities,
    },
    diagnostics: overrides.diagnostics ?? [],
  };
}

test('frontend target resolver marks API text models as unable to read raster images', () => {
  const target = resolveAgentModelTarget({
    config,
    active: { provider: 'openrouter', model: 'cheap-text' },
  });
  const validation = validateAttachmentsForAgentTarget({
    target,
    attachments: [pngAttachment],
  });

  expect(target?.imageInputMode).toBe('none');
  expect(validation?.severity).toBe('error');
  expect(validation?.detail).toContain('Cheap text');
});

test('frontend target resolver blocks direct DeepSeek V4 Pro raster image input until verified', () => {
  const target = resolveAgentModelTarget({
    config: {
      ...config,
      agent: { default: { provider: 'deepseek', model: 'deepseek-v4-pro' } },
      provider: {
        deepseek: {
          type: 'openai-compatible',
          name: 'DeepSeek',
          models: {
            'deepseek-v4-pro': {
              name: 'DeepSeek V4 Pro',
              vision: false,
              imageInput: {
                transport: 'text-only-with-ocr',
                verification: 'failed-openai-image-url',
                lastFailureCode: 'unknown_variant_image_url_expected_text',
              },
            },
          },
        },
      },
    },
    active: { provider: 'deepseek', model: 'deepseek-v4-pro' },
  });

  const validation = validateAttachmentsForAgentTarget({ target, attachments: [pngAttachment] });

  expect(target?.imageInputMode).toBe('none');
  expect(validation?.severity).toBe('error');
  expect(validation?.detail).toContain('DeepSeek V4 Pro');
  expect(validation?.detail).toContain('PNG/JPG/WebP');
  expect(validation?.detail).toContain('SVG');
});

test('frontend target resolver allows Codex native image input', () => {
  const target = resolveAgentModelTarget({
    config,
    active: { provider: 'codex-runtime', model: 'default' },
  });

  expect(target?.runtimeKind).toBe('codex');
  expect(target?.imageInputMode).toBe('cli-native');
  expect(validateAttachmentsForAgentTarget({ target, attachments: [pngAttachment] })).toBeNull();
});

test('frontend target resolver warns for unverified OpenCode image file handoff', () => {
  const target = resolveAgentModelTarget({
    config,
    active: { provider: 'opencode-runtime', model: 'default' },
  });
  const validation = validateAttachmentsForAgentTarget({
    target,
    attachments: [pngAttachment],
  });

  expect(target?.runtimeKind).toBe('opencode');
  expect(target?.imageInputMode).toBe('cli-files-warning');
  expect(validation?.severity).toBe('warning');
  expect(validation?.code).toBe('cli_image_input_unverified');
  expect(validation?.detail).not.toMatch(/\b(GPT|gpt|OpenRouter|Codex CLI)\b/u);
});

test('frontend target resolver warns when Claude uses prompt-path image delivery', () => {
  const target = resolveAgentModelTarget({
    config,
    active: { provider: 'claude-code-runtime', model: 'opus' },
    runtimeStatuses: [
      runtimeStatus({
        kind: 'claude-code',
        capabilities: {
          imageInputMode: 'cli-files-warning',
          imageDeliveryMode: 'prompt_path',
          rasterImageInput: false,
          nativeFileInput: false,
        },
      }),
    ],
  });
  const validation = validateAttachmentsForAgentTarget({
    target,
    attachments: [pngAttachment],
  });

  expect(target?.runtimeKind).toBe('claude-code');
  expect(target?.capabilities.rasterImageInput).toBe(false);
  expect(target?.capabilities.nativeFileInput).toBe(false);
  expect(validation?.severity).toBe('warning');
  expect(validation?.code).toBe('cli_image_input_prompt_path_only');
  expect(validation?.detail).toContain('saved workspace file paths');
});

test('frontend target resolver follows CLI runtime attachment capabilities from backend status', () => {
  const target = resolveAgentModelTarget({
    config,
    active: { provider: 'opencode-runtime', model: 'default' },
    runtimeStatuses: [
      runtimeStatus({
        kind: 'opencode',
        capabilities: {
          imageInputMode: 'cli-native',
          rasterImageInput: true,
          nativeFileInput: true,
        },
      }),
    ],
  });

  expect(target?.runtimeKind).toBe('opencode');
  expect(target?.imageInputMode).toBe('cli-native');
  expect(target?.capabilities.rasterImageInput).toBe(true);
  expect(target?.capabilities.nativeFileInput).toBe(true);
  expect(validateAttachmentsForAgentTarget({ target, attachments: [pngAttachment] })).toBeNull();
  expect(capabilityBadgesForAgentTarget(target).map((badge) => badge.label)).toContain('Vision');
});

test('frontend target resolver exposes compact capability badges', () => {
  const textOnly = resolveAgentModelTarget({
    config,
    active: { provider: 'openrouter', model: 'cheap-text' },
  });
  const vision = resolveAgentModelTarget({
    config,
    active: { provider: 'openrouter', model: 'vision-model' },
  });
  const codex = resolveAgentModelTarget({
    config,
    active: { provider: 'codex-runtime', model: 'default' },
  });
  const opencode = resolveAgentModelTarget({
    config,
    active: { provider: 'opencode-runtime', model: 'default' },
  });

  expect(capabilityBadgesForAgentTarget(textOnly).map((badge) => badge.label)).toEqual([
    'Text only',
    'Product MCP',
  ]);
  expect(capabilityBadgesForAgentTarget(vision).map((badge) => badge.label)).toEqual([
    'Vision',
    'Product MCP',
  ]);
  expect(capabilityBadgesForAgentTarget(codex).map((badge) => badge.label)).toEqual([
    'Vision',
    'CLI',
    'Own MCP',
  ]);
  expect(capabilityBadgesForAgentTarget(opencode).map((badge) => badge.label)).toEqual([
    'CLI',
    'Own MCP',
  ]);
});
