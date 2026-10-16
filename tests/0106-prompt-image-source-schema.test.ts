import { expect, test } from 'bun:test';
import { SberDesignerConfigSchema } from '@sber-designer/llm-gateway';
import type { PromptAttachmentUpload } from '@sber-designer/shared-types';

test('prompt image upload can reference a remote URL source', () => {
  const upload: PromptAttachmentUpload = {
    id: 'att-url',
    kind: 'image',
    name: 'reference-url.png',
    mimeType: 'image/png',
    size: 0,
    source: { type: 'remote-url', url: 'https://example.com/reference.png' },
  };

  expect(upload.source?.type).toBe('remote-url');
});

test('model entry accepts explicit image input metadata', () => {
  const parsed = SberDesignerConfigSchema.parse({
    agent: { default: { provider: 'deepseek', model: 'deepseek-v4-pro' } },
    provider: {
      deepseek: {
        type: 'openai-compatible',
        name: 'DeepSeek',
        models: {
          'deepseek-v4-pro': {
            name: 'DeepSeek V4 Pro',
            vision: true,
            imageInput: {
              acceptsDataUrl: true,
              acceptsRemoteUrl: true,
              verification: 'manual-smoke',
              verifiedAt: '2026-06-25',
            },
          },
        },
      },
    },
  });

  expect(parsed.provider.deepseek?.models?.['deepseek-v4-pro']?.imageInput).toMatchObject({
    acceptsDataUrl: true,
    acceptsRemoteUrl: true,
  });
});

test('model entry can record a failed provider image transport smoke', () => {
  const parsed = SberDesignerConfigSchema.parse({
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
              verifiedAt: '2026-06-25',
              lastFailureCode: 'unknown_variant_image_url_expected_text',
              lastFailureMessage:
                'Provider returned unknown variant image_url, expected text for messages[2].',
            },
          },
        },
      },
    },
  });

  expect(parsed.provider.deepseek?.models?.['deepseek-v4-pro']?.imageInput).toMatchObject({
    transport: 'text-only-with-ocr',
    verification: 'failed-openai-image-url',
    lastFailureCode: 'unknown_variant_image_url_expected_text',
  });
});
