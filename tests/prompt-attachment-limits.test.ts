import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  DEFAULT_PROMPT_ATTACHMENT_LIMITS,
  promptAttachmentLimitsFromConfig,
} from '../packages/llm-gateway/src/config';
import { createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { recordPromptAttachments } from '../services/api/src/prompt-attachments';

test('prompt attachment limits default SVG references to 5 MiB', () => {
  expect(DEFAULT_PROMPT_ATTACHMENT_LIMITS.svgMaxBytes).toBe(5 * 1024 * 1024);
});

test('prompt attachment limits read project SVG override', () => {
  expect(
    promptAttachmentLimitsFromConfig({
      agent: {
        default: { provider: 'custom', model: 'vision-model' },
        attachments: { svgMaxBytes: 8 * 1024 * 1024 },
      },
      provider: {
        custom: {
          type: 'openai-compatible',
          name: 'Custom',
          models: { 'vision-model': { name: 'Vision model', vision: true } },
        },
      },
      mcpServers: {},
    }).svgMaxBytes,
  ).toBe(8 * 1024 * 1024);
});

test('API attachment recorder accepts SVG prompt references larger than the old 512KB limit', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-svg-attachment-'));
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'echo',
    workspacePath,
  });
  const largeSvg = `<svg width="10" height="10" xmlns="http://www.w3.org/2000/svg"><desc>${'x'.repeat(
    700 * 1024,
  )}</desc></svg>`;

  const attachments = await recordPromptAttachments({
    workspacePath,
    runId: run.runId,
    attachments: [
      {
        id: 'svg-1',
        kind: 'image',
        name: 'large-screen.svg',
        mimeType: 'image/svg+xml',
        size: Buffer.byteLength(largeSvg, 'utf8'),
        text: largeSvg,
      },
    ],
  });

  expect(attachments[0]?.mimeType).toBe('image/svg+xml');
  expect(attachments[0]?.size).toBeGreaterThan(512 * 1024);
});
