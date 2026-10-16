import { expect, test } from 'bun:test';

import { resolveAgentModelTarget } from '../services/api/src/agent-model-target';
import {
  validatePromptAttachmentEvidenceForTarget,
  validatePromptAttachmentsForTarget,
} from '../services/api/src/prompt-attachments';

const pngAttachment = {
  id: 'img-1',
  kind: 'image' as const,
  name: 'reference.png',
  mimeType: 'image/png',
  size: 128,
  dataUrl:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
};

const pngEvidence = {
  id: 'img-1',
  kind: 'image' as const,
  name: 'reference.png',
  mimeType: 'image/png',
  size: 128,
  sha256: 'a'.repeat(64),
  runPath: '.sber-designer/runs/run-1/attachments/01-reference.png',
  width: 1,
  height: 1,
  sourceKind: 'upload' as const,
};

test('rejects raster image attachments unless the selected model is explicitly vision-capable', () => {
  const config = {
    agent: { default: { provider: 'providerB', model: 'providerA/text-model' } },
    provider: {
      providerB: {
        type: 'openai-compatible' as const,
        name: 'Provider B',
        models: {
          'providerA/text-model': { vision: false },
          'unannotated-model': { name: 'Unannotated model' },
          'vision-model': { vision: true },
        },
      },
    },
    mcpServers: {},
  };

  const textTarget = resolveAgentModelTarget({
    config,
    active: { provider: 'providerB', model: 'providerA/text-model' },
  });
  expect(
    validatePromptAttachmentsForTarget({ attachments: [pngAttachment], target: textTarget }),
  ).toMatchObject({
    ok: false,
    code: 'model_cannot_read_images',
  });

  const unannotatedTarget = resolveAgentModelTarget({
    config,
    active: { provider: 'providerB', model: 'unannotated-model' },
  });
  expect(
    validatePromptAttachmentsForTarget({ attachments: [pngAttachment], target: unannotatedTarget })
      .detail,
  ).toContain('not marked');

  const visionTarget = resolveAgentModelTarget({
    config,
    active: { provider: 'providerB', model: 'vision-model' },
  });
  expect(
    validatePromptAttachmentsForTarget({ attachments: [pngAttachment], target: visionTarget }),
  ).toEqual({
    ok: true,
    warnings: [],
  });
});

test('rejects direct DeepSeek V4 Pro raster image attachments until transport smoke passes', () => {
  const target = resolveAgentModelTarget({
    config: {
      agent: { default: { provider: 'deepseek', model: 'deepseek-v4-pro' } },
      provider: {
        deepseek: {
          type: 'openai-compatible' as const,
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
      mcpServers: {},
    },
    active: { provider: 'deepseek', model: 'deepseek-v4-pro' },
  });

  const result = validatePromptAttachmentsForTarget({ attachments: [pngAttachment], target });

  expect(target.imageInputMode).toBe('none');
  expect(result.ok).toBe(false);
  expect(result.code).toBe('model_cannot_read_images');
  expect(result.detail).toContain('DeepSeek V4 Pro');
  expect(result.detail).toContain('PNG/JPG/WebP');
  expect(result.detail).toContain('SVG');
});

test('allows raster image attachments for Codex CLI native image input', () => {
  const target = resolveAgentModelTarget({
    config: {
      agent: { default: { provider: 'codex-runtime', model: 'default' } },
      provider: {},
      mcpServers: {},
    },
    active: { provider: 'codex-runtime', model: 'default' },
  });

  expect(target.kind).toBe('cli');
  expect(target.runtimeKind).toBe('codex');
  expect(target.imageInputMode).toBe('cli-native');
  expect(target.capabilities.rasterImageInput).toBe(true);
  expect(validatePromptAttachmentsForTarget({ attachments: [pngAttachment], target })).toEqual({
    ok: true,
    warnings: [],
  });
});

test('Codex CLI target capabilities carry project and managed MCP targets', () => {
  const target = resolveAgentModelTarget({
    config: {
      agent: { default: { provider: 'codex-runtime', model: 'default' } },
      provider: {},
      mcpServers: {
        'pixso-desktop': {
          type: 'streamable-http',
          url: 'http://127.0.0.1:3667/mcp',
          enabled: true,
          allowedTools: ['get_image', 'get_node_info'],
        },
        disabled: {
          type: 'stdio',
          command: 'node',
          enabled: false,
        },
      },
    },
    active: { provider: 'codex-runtime', model: 'default' },
  });

  expect(target.capabilities.mcpExpectedTargets).toEqual([
    {
      server: 'pixso-desktop',
      transport: 'streamable-http',
      tools: ['get_image', 'get_node_info'],
      configPath: 'sber-designer.json#mcpServers.pixso-desktop',
    },
    {
      server: 'sber-designer',
      transport: 'stdio',
      configPath: 'codex --config#mcp_servers.sber-designer',
    },
  ]);
  expect(target.capabilities.projectMcpTools).toBe(true);
});

test('CLI target capabilities include managed project MCP injection targets', () => {
  const target = resolveAgentModelTarget({
    config: {
      agent: { default: { provider: 'claude-code-runtime', model: 'default' } },
      provider: {},
      mcpServers: {},
    },
    active: { provider: 'claude-code-runtime', model: 'default' },
  });

  expect(target.capabilities.projectMcpTools).toBe(true);
  expect(target.capabilities.ownMcpConfig).toBe(true);
  expect(target.capabilities.mcpExpectedTargets).toEqual([
    {
      server: 'sber-designer',
      transport: 'stdio',
      configPath: '.mcp.json#mcpServers.sber-designer',
    },
  ]);
});

test('passes OpenCode raster image attachments with a runtime warning instead of API vision rejection', () => {
  const target = resolveAgentModelTarget({
    config: {
      agent: { default: { provider: 'opencode-runtime', model: 'default' } },
      provider: {},
      mcpServers: {},
    },
    active: { provider: 'opencode-runtime', model: 'default' },
  });

  const result = validatePromptAttachmentsForTarget({ attachments: [pngAttachment], target });

  expect(target.kind).toBe('cli');
  expect(target.runtimeKind).toBe('opencode');
  expect(target.imageInputMode).toBe('cli-files-warning');
  expect(result.ok).toBe(true);
  expect(result.warnings[0]?.code).toBe('cli_image_input_unverified');
});

test('passes Claude Code raster image attachments as prompt-path files with explicit warning', () => {
  const target = resolveAgentModelTarget({
    config: {
      agent: { default: { provider: 'claude-code-runtime', model: 'opus' } },
      provider: {},
      mcpServers: {},
    },
    active: { provider: 'claude-code-runtime', model: 'opus' },
  });

  const result = validatePromptAttachmentsForTarget({ attachments: [pngAttachment], target });

  expect(target.kind).toBe('cli');
  expect(target.runtimeKind).toBe('claude-code');
  expect(target.imageInputMode).toBe('cli-files-warning');
  expect(target.capabilities.rasterImageInput).toBe(false);
  expect(target.capabilities.nativeFileInput).toBe(false);
  expect(result.ok).toBe(true);
  expect(result.warnings[0]?.code).toBe('cli_image_input_prompt_path_only');
  expect(result.warnings[0]?.detail).toContain('saved workspace file paths');
  expect(result.warnings[0]?.detail).toContain('not passed through a --image style native flag');
});

test('OpenCode target does not emit image warning until a raster image is attached', () => {
  const target = resolveAgentModelTarget({
    config: {
      agent: { default: { provider: 'opencode-runtime', model: 'default' } },
      provider: {},
      mcpServers: {},
    },
    active: { provider: 'opencode-runtime', model: 'default' },
  });

  expect(target.diagnostics).toEqual([]);
  expect(validatePromptAttachmentsForTarget({ attachments: [], target })).toEqual({
    ok: true,
    warnings: [],
  });
});

test('API target reports unresolved env placeholders as blocking diagnostics', () => {
  const target = resolveAgentModelTarget({
    config: {
      agent: { default: { provider: 'providerB', model: 'cheap-text' } },
      provider: {
        providerB: {
          type: 'openai-compatible',
          name: 'Provider B',
          options: { apiKey: '{env:PROVIDER_B_API_KEY}' },
          models: {
            'cheap-text': { name: 'Cheap text', vision: false },
          },
        },
      },
      mcpServers: {},
    },
    active: { provider: 'providerB', model: 'cheap-text' },
  });

  expect(target.diagnostics).toContainEqual(
    expect.objectContaining({
      severity: 'error',
      code: 'provider_env_unresolved',
      detail: expect.stringContaining('{env:PROVIDER_B_API_KEY}'),
    }),
  );
});

test('rejects raster image attachments for API text-only targets with the selected model label', () => {
  const target = resolveAgentModelTarget({
    config: {
      agent: { default: { provider: 'providerB', model: 'cheap-text' } },
      provider: {
        providerB: {
          type: 'openai-compatible',
          name: 'Provider B',
          models: {
            'cheap-text': { name: 'Cheap text', vision: false },
          },
        },
      },
      mcpServers: {},
    },
    active: { provider: 'providerB', model: 'cheap-text' },
  });

  const result = validatePromptAttachmentsForTarget({ attachments: [pngAttachment], target });

  expect(target.kind).toBe('api');
  expect(target.imageInputMode).toBe('none');
  expect(result.ok).toBe(false);
  expect(result.code).toBe('model_cannot_read_images');
  expect(result.detail).toContain('Cheap text (cheap-text)');
});

test('rejects carried raster attachment evidence for API text-only targets', () => {
  const target = resolveAgentModelTarget({
    config: {
      agent: { default: { provider: 'providerB', model: 'cheap-text' } },
      provider: {
        providerB: {
          type: 'openai-compatible',
          name: 'Provider B',
          models: {
            'cheap-text': { name: 'Cheap text', vision: false },
          },
        },
      },
      mcpServers: {},
    },
    active: { provider: 'providerB', model: 'cheap-text' },
  });

  const result = validatePromptAttachmentEvidenceForTarget({
    attachments: [pngEvidence],
    target,
  });

  expect(result.ok).toBe(false);
  expect(result.code).toBe('model_cannot_read_images');
  expect(result.detail).toContain('Cheap text (cheap-text)');
});
