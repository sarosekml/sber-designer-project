import { mkdir, readFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { recordPromptAttachments } from '../services/api/src/prompt-attachments';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l5qfWQAAAABJRU5ErkJggg==',
  'base64',
);

test('records HTTPS image URL attachments as run evidence', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0106-url-image-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    runtimeKind: 'api',
    workspacePath: workspace,
    userGoal: 'Use the linked screen as requirements.',
  });

  const fetchImpl = async () => new Response(PNG_1X1, { headers: { 'content-type': 'image/png' } });

  const evidence = await recordPromptAttachments({
    workspacePath: workspace,
    runId: run.runId,
    attachments: [
      {
        id: 'att-url',
        kind: 'image',
        name: 'reference-url.png',
        mimeType: 'image/png',
        size: 0,
        source: { type: 'remote-url', url: 'https://cdn.example.test/reference.png' },
      },
    ],
    fetchImpl: fetchImpl as typeof fetch,
  });

  expect(evidence[0]).toMatchObject({
    id: 'att-url',
    kind: 'image',
    mimeType: 'image/png',
    sourceKind: 'remote-url',
    originalUrl: 'https://cdn.example.test/reference.png',
    providerImageUrl: 'https://cdn.example.test/reference.png',
    width: 1,
    height: 1,
  });

  const saved = await readFile(join(workspace, evidence[0]!.runPath));
  expect(saved.equals(PNG_1X1)).toBe(true);
});

test('rejects private-network remote image URLs by default', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0106-url-reject-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const run = await createAgentRun({ route: 'chat', user: 'test-user', workspacePath: workspace });

  await expect(
    recordPromptAttachments({
      workspacePath: workspace,
      runId: run.runId,
      attachments: [
        {
          id: 'att-private',
          kind: 'image',
          name: 'private.png',
          mimeType: 'image/png',
          size: 0,
          source: { type: 'remote-url', url: 'http://127.0.0.1:3000/private.png' },
        },
      ],
    }),
  ).rejects.toThrow('Remote image URL is not allowed');
});
