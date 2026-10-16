import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import type { AgentStreamEvent } from '../services/api/src/agent/stream';
import { snapshotRuntimeTargetFiles } from '../services/api/src/agent-runtimes/change-validation';
import { createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { recordExternalRuntimeAttachmentDelivery } from '../services/api/src/routes/chat-stream/evidence';
import { streamExternalRuntimeHandoff } from '../services/api/src/routes/chat-stream/external';

test('external runtime handoff writes a tailable per-run event log', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-event-log-'));
  const targetPath = 'src/screens/Admin.tsx';
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspace, targetPath),
    ['export function Admin() {', '  return <main>Empty</main>;', '}', ''].join('\n'),
    'utf8',
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'codex-runtime',
    model: 'default',
    workspacePath: workspace,
  });
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [targetPath]);

  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE() {
        return undefined;
      },
    },
    runtimeLabel: 'Codex',
    workspacePath: workspace,
    agentRun,
    snapshots,
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    events: (async function* events(): AsyncGenerator<AgentStreamEvent> {
      yield { type: 'text-delta', iteration: 1, delta: 'Working' };
      yield {
        type: 'done',
        transcript: [{ role: 'assistant', content: 'Working' }],
        iterations: 1,
        truncated: false,
        hadErrors: false,
        stoppedAfterPermissionDeny: false,
        finalResponse: {
          text: 'Working',
          provider: 'codex-runtime',
          model: 'default',
          finishReason: 'stop',
        },
      };
    })(),
  });

  const raw = await readFile(
    join(workspace, '.sber-designer/runs', agentRun.runId, 'external-runtime/events.jsonl'),
    'utf8',
  );
  const events = raw
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { runtime: string; event: AgentStreamEvent });

  expect(events.map((entry) => entry.event.type)).toContain('done');
  expect(
    events.some((entry) => entry.event.type === 'text-delta' && entry.event.delta === 'Working'),
  ).toBe(true);
  expect(events.every((entry) => entry.runtime === 'Codex')).toBe(true);
});

test('external runtime attachment delivery writes evidence manifest and event log entry', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-attachment-delivery-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'claude-code-runtime',
    model: 'opus',
    workspacePath: workspace,
  });

  await recordExternalRuntimeAttachmentDelivery({
    workspacePath: workspace,
    agentRun,
    runtime: 'Claude Code CLI',
    deliveryMode: 'prompt_path',
    imagePaths: ['.sber-designer/runs/run-1/attachments/01-reference.png'],
    attachments: [
      {
        id: 'att-reference',
        kind: 'image',
        name: 'reference.png',
        mimeType: 'image/png',
        size: 123,
        sha256: 'a'.repeat(64),
        width: 400,
        height: 300,
        runPath: '.sber-designer/runs/run-1/attachments/01-reference.png',
      },
    ],
  });

  const runRoot = join(workspace, '.sber-designer/runs', agentRun.runId, 'external-runtime');
  const manifest = JSON.parse(await readFile(join(runRoot, 'attachments.json'), 'utf8'));
  expect(manifest.attachments[0]).toMatchObject({
    id: 'att-reference',
    deliveryMode: 'prompt_path',
    deliveredAsNativeInput: false,
    width: 400,
    height: 300,
  });

  const rawEvents = await readFile(join(runRoot, 'events.jsonl'), 'utf8');
  const events = rawEvents
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { runtime: string; event: AgentStreamEvent });
  expect(events).toContainEqual(
    expect.objectContaining({
      runtime: 'Claude Code CLI',
      event: expect.objectContaining({
        type: 'external-runtime-diagnostic',
        name: 'image_input_delivered',
        data: expect.objectContaining({
          deliveryMode: 'prompt_path',
          imageCount: 1,
        }),
      }),
    }),
  );
});
