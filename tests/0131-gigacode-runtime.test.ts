import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import type { AgentStreamEvent } from '../services/api/src/agent/stream';
import { completeAgentRun, createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { getAgentAdapter } from '../services/api/src/agent-runtimes/adapter';
import {
  buildGigaCodeRunArgs,
  emitGigaCodeSessionMetadata,
  parseGigaCodeLine,
  runGigaCodeHandoff,
} from '../services/api/src/agent-runtimes/gigacode-runner';
import { runtimeModelDiagnosticsFromEvent } from '../services/api/src/agent-runtimes/model-identity';
import { classifyRuntimeStdoutFallback } from '../services/api/src/agent-runtimes/stdout-fallback';
import { readGigaCodeState } from '../services/api/src/agent-runtimes/gigacode-state';

const MOCK_CLI = join(import.meta.dir, 'mocks', 'runtime-mock.ts');

async function collectEvents(stream: AsyncGenerator<AgentStreamEvent>) {
  const events: AgentStreamEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

async function withTrace<T>(trace: string, run: () => Promise<T>): Promise<T> {
  const previousPassthrough = process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH;
  process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH = 'SD_MOCK_TRACE,SD_MOCK_SPEED';
  const previous = process.env.SD_MOCK_TRACE;
  process.env.SD_MOCK_TRACE = trace;
  try {
    return await run();
  } finally {
    if (previousPassthrough === undefined) delete process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH;
    else process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH = previousPassthrough;
    if (previous === undefined) delete process.env.SD_MOCK_TRACE;
    else process.env.SD_MOCK_TRACE = previous;
  }
}

test('GigaCode state reader returns only sanitized auth and chat-model metadata', async () => {
  const stateDir = await mkdtemp(join(tmpdir(), 'sd-gigacode-state-'));
  try {
    await writeFile(
      join(stateDir, 'gigacode_token.json'),
      JSON.stringify({
        token: 'super-secret-token',
        expiryDate: '2035-01-02T03:04:05.000Z',
        config: {
          chat: {
            models: [
              {
                model: 'Qwen3.6-35B',
                description: 'Qwen3.6-35B-262k',
                plugin_side: { context_window_size: 262_144 },
              },
              { model: 'invalid model id' },
            ],
          },
          agent: { models: [{ model: 'must-not-leak' }] },
          default_system_message: 'must-not-leak',
        },
      }),
    );
    await writeFile(
      join(stateDir, 'settings.json'),
      JSON.stringify({ model: { name: 'CodeChat' } }),
    );

    const snapshot = await readGigaCodeState({
      stateDir,
      now: () => Date.parse('2030-01-01T00:00:00.000Z'),
    });

    expect(snapshot).toMatchObject({
      auth: 'ready',
      configuredModel: 'CodeChat',
      models: [
        {
          id: 'Qwen3.6-35B',
          description: 'Qwen3.6-35B-262k',
          contextWindowSize: 262_144,
        },
      ],
    });
    expect(JSON.stringify(snapshot)).not.toContain('super-secret-token');
    expect(JSON.stringify(snapshot)).not.toContain('must-not-leak');
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test('GigaCode state reader accepts epoch seconds and marks expired auth', async () => {
  const stateDir = await mkdtemp(join(tmpdir(), 'sd-gigacode-state-'));
  try {
    await writeFile(
      join(stateDir, 'gigacode_token.json'),
      JSON.stringify({
        token: 'secret',
        expiryDate: 1_700_000_000,
        config: { chat: { models: [] } },
      }),
    );
    const snapshot = await readGigaCodeState({
      stateDir,
      now: () => 1_800_000_000_000,
    });
    expect(snapshot.auth).toBe('expired');
    expect(snapshot.expiresAt).toBe(1_700_000_000_000);
    expect(snapshot.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'gigacode_auth_expired',
    );
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test('GigaCode state reader fails closed for missing, malformed, and oversized auth state', async () => {
  const stateDir = await mkdtemp(join(tmpdir(), 'sd-gigacode-state-'));
  try {
    expect(await readGigaCodeState({ stateDir })).toEqual({
      auth: 'missing',
      models: [],
      diagnostics: [],
    });

    await writeFile(join(stateDir, 'gigacode_token.json'), '{"token":"secret-sentinel"');
    const malformed = await readGigaCodeState({ stateDir });
    expect(malformed.auth).toBe('invalid');
    expect(JSON.stringify(malformed)).not.toContain('secret-sentinel');

    await writeFile(join(stateDir, 'gigacode_token.json'), 'x'.repeat(2 * 1024 * 1024 + 1));
    const oversized = await readGigaCodeState({ stateDir });
    expect(oversized.auth).toBe('invalid');
    expect(oversized.diagnostics[0]?.code).toBe('gigacode_state_invalid');
  } finally {
    await rm(stateDir, { recursive: true, force: true });
  }
});

test('GigaCode run args always carry the non-interactive approval mode', () => {
  expect(buildGigaCodeRunArgs('default')).toEqual([
    '--approval-mode',
    'auto-edit',
    '--output-format',
    'stream-json',
  ]);
  expect(buildGigaCodeRunArgs('Qwen3.6-35B')).toEqual([
    '--approval-mode',
    'auto-edit',
    '--output-format',
    'stream-json',
    '--model',
    'Qwen3.6-35B',
  ]);
  expect(buildGigaCodeRunArgs('default', { mode: 'new', sessionId: 'run-7' })).toEqual([
    '--approval-mode',
    'auto-edit',
    '--output-format',
    'stream-json',
    '--session-id',
    'run-7',
  ]);
  expect(buildGigaCodeRunArgs('default', { mode: 'resume', sessionId: 'run-7' })).toEqual([
    '--approval-mode',
    'auto-edit',
    '--output-format',
    'stream-json',
    '--resume',
    'run-7',
  ]);
});

test('GigaCode stream-json normalizes assistant text, message tool traffic, and result usage', () => {
  expect(
    parseGigaCodeLine(
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Created ' },
            { type: 'text', text: 'the screen.' },
          ],
        },
      }),
    ),
  ).toEqual([{ type: 'text_delta', delta: 'Created the screen.' }]);

  expect(
    parseGigaCodeLine(
      JSON.stringify({
        type: 'message',
        action: 'tool_call',
        tool_call_id: 't-1',
        tool_name: 'write_file',
        tool_input: { path: 'src/App.tsx' },
      }),
    ),
  ).toEqual([{ type: 'tool_use', id: 't-1', name: 'write_file', input: { path: 'src/App.tsx' } }]);

  expect(
    parseGigaCodeLine(
      JSON.stringify({
        type: 'message',
        action: 'tool_result',
        tool_call_id: 't-1',
        content: 'ok',
        is_error: false,
      }),
    ),
  ).toEqual([{ type: 'tool_result', toolUseId: 't-1', content: 'ok', isError: false }]);

  expect(
    parseGigaCodeLine(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        result: 'Created the screen.',
        usage: {
          input_tokens: 420,
          output_tokens: 88,
          cache_read_input_tokens: 16,
          total_tokens: 508,
        },
      }),
    ),
  ).toEqual([{ type: 'usage', inputTokens: 420, outputTokens: 88, totalTokens: 508 }]);
});

test('GigaCode result text never doubles the streamed assistant answer', () => {
  const events = parseGigaCodeLine(
    JSON.stringify({ type: 'result', subtype: 'success', result: 'Created the screen.' }),
  );
  expect(events).toEqual([]);
});

test('GigaCode surfaces a failed result as an error event', () => {
  expect(
    parseGigaCodeLine(
      JSON.stringify({
        type: 'result',
        subtype: 'failure',
        is_error: true,
        result: 'Model request was rejected.',
      }),
    ),
  ).toEqual([{ type: 'error', message: 'Model request was rejected.' }]);
});

test('GigaCode keychain noise on stdout is not assistant text', () => {
  const line = '[ERROR] [MCP_KEYCHAIN] Failed to list secrets from keychain: session unavailable';
  expect(classifyRuntimeStdoutFallback(line)).toEqual({
    kind: 'runtime-noise',
    reason: 'log-prefix',
  });
  const reasons: string[] = [];
  expect(parseGigaCodeLine(line, { onRuntimeNoise: (reason) => reasons.push(reason) })).toEqual([]);
  expect(reasons).toEqual(['log-prefix']);
});

test('GigaCode captures the session and prefers assistant model identity over system.init', () => {
  const captured: Array<[string, Record<string, unknown> | undefined]> = [];
  emitGigaCodeSessionMetadata(
    JSON.stringify({
      type: 'system',
      subtype: 'init',
      session_id: 's-1',
      model: 'CodeChat',
    }),
    (event, data) => captured.push([event, data]),
  );
  emitGigaCodeSessionMetadata(
    JSON.stringify({
      type: 'assistant',
      message: { model: 'vllm/DeepSeek-V4-Flash-262k', content: [] },
    }),
    (event, data) => captured.push([event, data]),
  );
  expect(captured).toEqual([
    ['runtime.session', { runtime: 'gigacode', sessionId: 's-1', captureEvent: 'system.init' }],
    ['runtime.model', { runtime: 'gigacode', model: 'CodeChat', source: 'system.init' }],
    [
      'runtime.model',
      {
        runtime: 'gigacode',
        model: 'vllm/DeepSeek-V4-Flash-262k',
        source: 'assistant.message',
      },
    ],
  ]);
});

test('GigaCode runner replays a recorded success trace end to end', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'sd-gigacode-runner-'));
  const stdinPath = join(cwd, 'captured-stdin.txt');
  const events = await withTrace('gigacode/minimal-success', () =>
    collectEvents(
      runGigaCodeHandoff({
        command: MOCK_CLI,
        model: 'default',
        cwd,
        prompt: 'Say hello.',
        env: { SD_MOCK_STDIN_FILE: stdinPath },
      }),
    ),
  );

  expect(events.map((event) => event.type)).toEqual([
    'iteration-start',
    'text-delta',
    'usage',
    'iteration-end',
    'done',
  ]);
  const done = events.at(-1);
  expect(done).toMatchObject({
    type: 'done',
    hadErrors: false,
    finalResponse: {
      provider: 'gigacode-runtime',
      model: 'vllm/DeepSeek-V4-Flash-262k',
      text: 'Hello from GigaCode.',
    },
    usage: { inputTokens: 42, outputTokens: 7 },
  });
  expect(await readFile(stdinPath, 'utf8')).toBe('Say hello.');
});

test('runtime.model becomes persisted run diagnostics with normalized identity', () => {
  expect(
    runtimeModelDiagnosticsFromEvent('runtime.model', {
      runtime: ' gigacode ',
      model: ' vllm/DeepSeek-V4-Flash-262k ',
      source: 'assistant.message',
    }),
  ).toEqual({
    runtime: 'gigacode',
    model: 'vllm/DeepSeek-V4-Flash-262k',
    source: 'assistant.message',
  });
  expect(runtimeModelDiagnosticsFromEvent('gigacode.model', { model: 'ignored' })).toBeNull();
});

test('GigaCode runner keeps failure-result terminal when the process exits zero', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'sd-gigacode-failure-runner-'));
  const events = await withTrace('gigacode/failure-exit-zero', () =>
    collectEvents(
      runGigaCodeHandoff({
        command: MOCK_CLI,
        model: 'default',
        cwd,
        prompt: 'Run a failing request.',
      }),
    ),
  );

  expect(events.map((event) => event.type)).toEqual([
    'iteration-start',
    'text-delta',
    'usage',
    'error',
    'iteration-end',
    'done',
  ]);
  expect(events.find((event) => event.type === 'error')).toMatchObject({
    type: 'error',
    message: 'Model request was rejected.',
  });
  expect(events.find((event) => event.type === 'iteration-end')).toMatchObject({
    type: 'iteration-end',
    finishReason: 'other',
  });
  expect(events.at(-1)).toMatchObject({
    type: 'done',
    hadErrors: true,
    finalResponse: {
      model: 'vllm/DeepSeek-V4-Flash-262k',
      finishReason: 'other',
    },
  });
});

test('GigaCode adapter replays a tool round-trip and drops keychain noise', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'sd-gigacode-adapter-'));
  const runtimeEvents: string[] = [];
  const events = await withTrace('gigacode/tool-call-keychain-noise', () =>
    collectEvents(
      getAgentAdapter('gigacode').run({
        command: MOCK_CLI,
        model: 'default',
        cwd,
        prompt: 'Create the app shell.',
        onRuntimeEvent: (event) => {
          runtimeEvents.push(event);
        },
      }),
    ),
  );

  expect(events.map((event) => event.type)).toEqual([
    'iteration-start',
    'tool-call',
    'tool-result',
    'text-delta',
    'usage',
    'iteration-end',
    'done',
  ]);
  expect(runtimeEvents).toContain('runtime.session');
  expect(runtimeEvents).toContain('runtime.model');
  expect(
    events.some((event) => event.type === 'text-delta' && event.delta.includes('KEYCHAIN')),
  ).toBe(false);
  expect(events.at(-1)).toMatchObject({ type: 'done', hadErrors: false });
});

test('run completion persists the resolved GigaCode model in the manifest identity', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-gigacode-model-manifest-'));
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test',
    provider: 'gigacode-runtime',
    model: 'default',
    runtimeKind: 'gigacode',
    workspacePath,
  });
  const completed = await completeAgentRun({
    workspacePath,
    runId: run.runId,
    status: 'complete',
    diagnostics: {
      runtimeModel: {
        runtime: 'gigacode',
        model: 'vllm/DeepSeek-V4-Flash-262k',
        source: 'assistant.message',
      },
    },
  });

  expect(completed).toMatchObject({
    model: 'vllm/DeepSeek-V4-Flash-262k',
    diagnostics: {
      runtimeModel: {
        runtime: 'gigacode',
        model: 'vllm/DeepSeek-V4-Flash-262k',
        source: 'assistant.message',
      },
    },
  });
});
