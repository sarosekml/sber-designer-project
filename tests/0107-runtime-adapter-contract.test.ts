import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import type { AgentStreamEvent } from '../services/api/src/agent/stream';
import { getAgentAdapter, listAgentAdapters } from '../services/api/src/agent-runtimes/adapter';
import { parseKimiLine } from '../services/api/src/agent-runtimes/kimi-runner';

const MOCK_CLI = join(import.meta.dir, 'mocks', 'runtime-mock.ts');

async function collectEvents(stream: AsyncGenerator<AgentStreamEvent>) {
  const events: AgentStreamEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

test('runtime adapters expose one data-driven contract for all CLI runtimes', () => {
  expect(listAgentAdapters().map((adapter) => adapter.kind)).toEqual([
    'opencode',
    'claude-code',
    'codex',
    'kimi',
    'gigacode',
  ]);

  const codex = getAgentAdapter('codex');
  expect(codex).toMatchObject({
    kind: 'codex',
    displayName: 'Codex CLI',
    capabilities: {
      promptDelivery: 'stdin',
      streamFormat: 'jsonl',
      chatHandoff: false,
      rasterImageInput: true,
      nativeFileInput: true,
    },
  });
  expect(codex.buildArgs({ model: 'default', cwd: '/work/project' })).toEqual([
    '--ask-for-approval',
    'never',
    '--cd',
    '/work/project',
    '--sandbox',
    'workspace-write',
    'exec',
    '--json',
  ]);

  const kimi = getAgentAdapter('kimi');
  expect(kimi).toMatchObject({
    kind: 'kimi',
    displayName: 'Kimi Code CLI',
    capabilities: {
      promptDelivery: 'argv',
      streamFormat: 'stream-json',
      chatHandoff: true,
      imageDeliveryMode: 'prompt_path',
    },
  });
  expect(kimi.buildArgs({ model: 'kimi-k3', cwd: '/work/project' })).toEqual([
    '--output-format',
    'stream-json',
    '--model',
    'kimi-k3',
  ]);

  const gigacode = getAgentAdapter('gigacode');
  expect(gigacode).toMatchObject({
    kind: 'gigacode',
    displayName: 'GigaCode',
    capabilities: {
      promptDelivery: 'stdin',
      streamFormat: 'stream-json',
      chatHandoff: true,
      modelList: false,
      imageDeliveryMode: 'prompt_path',
    },
  });
  expect(gigacode.buildArgs({ model: 'default', cwd: '/work/project' })).toEqual([
    '--approval-mode',
    'auto-edit',
    '--output-format',
    'stream-json',
  ]);
});

test('Kimi stream-json messages normalize assistant and tool events', () => {
  expect(
    parseKimiLine(
      JSON.stringify({
        role: 'assistant',
        content: 'Done',
        tool_calls: [
          {
            id: 'call-1',
            function: { name: 'ReadFile', arguments: '{"path":"src/App.tsx"}' },
          },
        ],
      }),
    ),
  ).toEqual([
    { type: 'text_delta', delta: 'Done' },
    { type: 'tool_use', id: 'call-1', name: 'ReadFile', input: { path: 'src/App.tsx' } },
  ]);
  expect(
    parseKimiLine(JSON.stringify({ role: 'tool', tool_call_id: 'call-1', content: 'source' })),
  ).toEqual([{ type: 'tool_result', toolUseId: 'call-1', content: 'source', isError: false }]);
});

test('runtime adapter run delegates through the selected runtime runner', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'sd-runtime-adapter-'));
  const previousPassthrough = process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH;
  process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH = 'SD_MOCK_TRACE,SD_MOCK_SPEED';
  const previousTrace = process.env.SD_MOCK_TRACE;
  process.env.SD_MOCK_TRACE = 'codex/minimal-success';
  try {
    const events = await collectEvents(
      getAgentAdapter('codex').run({
        command: MOCK_CLI,
        model: 'default',
        cwd,
        prompt: 'Generate the active screen.',
      }),
    );
    expect(events.map((event) => event.type)).toEqual([
      'iteration-start',
      'text-delta',
      'usage',
      'iteration-end',
      'done',
    ]);
  } finally {
    if (previousPassthrough === undefined) delete process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH;
    else process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH = previousPassthrough;
    if (previousTrace === undefined) delete process.env.SD_MOCK_TRACE;
    else process.env.SD_MOCK_TRACE = previousTrace;
  }
});
