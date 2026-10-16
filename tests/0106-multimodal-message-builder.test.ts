import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { buildProviderMultimodalMessages } from '../services/api/src/agent/multimodal-messages';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l5qfWQAAAABJRU5ErkJggg==',
  'base64',
);

test('adds validated upload image evidence to the latest user message only', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0106-messages-'));
  await mkdir(join(workspace, '.sber-designer/runs/run/attachments'), { recursive: true });
  await writeFile(join(workspace, '.sber-designer/runs/run/attachments/01-reference.png'), PNG_1X1);
  const messages = [
    { role: 'user' as const, content: 'Earlier turn' },
    { role: 'assistant' as const, content: 'Ack' },
    { role: 'user' as const, content: 'Build this screen' },
  ];

  const next = await buildProviderMultimodalMessages({
    workspacePath: workspace,
    messages,
    attachments: [
      {
        id: 'att-png',
        name: 'reference.png',
        mimeType: 'image/png',
        size: 68,
        sha256: 'a'.repeat(64),
        runPath: '.sber-designer/runs/run/attachments/01-reference.png',
        width: 1,
        height: 1,
        sourceKind: 'upload',
      },
    ],
    acceptsDataUrl: true,
    acceptsRemoteUrl: true,
  });

  expect(next[0]!.content).toBe('Earlier turn');
  expect(next[2]!.content).toEqual([
    { type: 'text', text: 'Build this screen' },
    {
      type: 'image_url',
      image_url: { url: expect.stringMatching(/^data:image\/png;base64,/), detail: 'auto' },
    },
  ]);
});

test('drops client-supplied image_url parts and rebuilds from evidence', async () => {
  const next = await buildProviderMultimodalMessages({
    workspacePath: '/tmp/nonexistent-workspace',
    messages: [
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: 'Use real evidence only' },
          { type: 'image_url' as const, image_url: { url: 'https://attacker.invalid/x.png' } },
        ],
      },
    ],
    attachments: [],
    acceptsDataUrl: true,
    acceptsRemoteUrl: true,
  });

  expect(next[0]!.content).toBe('Use real evidence only');
});

test('rejects raster evidence when provider image transport is unsupported', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0106-unsupported-transport-'));
  await mkdir(join(workspace, '.sber-designer/runs/run/attachments'), { recursive: true });
  await writeFile(join(workspace, '.sber-designer/runs/run/attachments/01-reference.png'), PNG_1X1);

  await expect(
    buildProviderMultimodalMessages({
      workspacePath: workspace,
      messages: [{ role: 'user' as const, content: 'Build this screen' }],
      attachments: [
        {
          id: 'att-png',
          name: 'reference.png',
          mimeType: 'image/png',
          size: 68,
          sha256: 'a'.repeat(64),
          runPath: '.sber-designer/runs/run/attachments/01-reference.png',
          width: 1,
          height: 1,
          sourceKind: 'upload',
        },
      ],
      imageTransport: {
        kind: 'unsupported',
        code: 'provider_image_transport_unsupported',
        detail:
          'Direct DeepSeek API rejected OpenAI image_url content parts; use a vision preprocessor.',
      },
    } as Parameters<typeof buildProviderMultimodalMessages>[0]),
  ).rejects.toMatchObject({
    code: 'provider_image_transport_unsupported',
    message: expect.stringContaining('DeepSeek'),
  });
});
