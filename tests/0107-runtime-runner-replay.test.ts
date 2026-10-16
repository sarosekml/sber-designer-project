import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import type { AgentStreamEvent } from '../services/api/src/agent/stream';
import { runClaudeCodeHandoff } from '../services/api/src/agent-runtimes/claude-runner';
import { runCodexHandoff } from '../services/api/src/agent-runtimes/codex-runner';
import { runOpenCodeHandoff } from '../services/api/src/agent-runtimes/opencode-runner';
import { loadRuntimeTraceFixture } from '../services/api/src/agent-runtimes/replay-trace-contract';

const MOCK_CLI = join(import.meta.dir, 'mocks', 'runtime-mock.ts');

type RunnerCase = {
  name: string;
  runtime: string;
  run: (cwd: string) => AsyncGenerator<AgentStreamEvent>;
};

async function collectEvents(stream: AsyncGenerator<AgentStreamEvent>) {
  const events: AgentStreamEvent[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
}

async function withMockTrace<T>(traceId: string, fn: () => Promise<T>): Promise<T> {
  const previousPassthrough = process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH;
  process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH = 'SD_MOCK_TRACE,SD_MOCK_SPEED';
  const previousTrace = process.env.SD_MOCK_TRACE;
  const previousSpeed = process.env.SD_MOCK_SPEED;
  process.env.SD_MOCK_TRACE = traceId;
  process.env.SD_MOCK_SPEED = 'instant';
  try {
    return await fn();
  } finally {
    if (previousPassthrough === undefined) delete process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH;
    else process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH = previousPassthrough;
    restoreEnv('SD_MOCK_TRACE', previousTrace);
    restoreEnv('SD_MOCK_SPEED', previousSpeed);
  }
}

test('runtime replay mock drives runner success streams for every CLI runtime', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'sd-runner-replay-'));
  const cases: RunnerCase[] = [
    {
      name: 'Claude Code',
      runtime: 'claude-code',
      run: (cwd) =>
        runClaudeCodeHandoff({
          command: MOCK_CLI,
          model: 'default',
          cwd,
          prompt: 'Generate the active screen.',
        }),
    },
    {
      name: 'Codex',
      runtime: 'codex',
      run: (cwd) =>
        runCodexHandoff({
          command: MOCK_CLI,
          model: 'default',
          cwd,
          prompt: 'Generate the active screen.',
        }),
    },
    {
      name: 'OpenCode',
      runtime: 'opencode',
      run: (cwd) =>
        runOpenCodeHandoff({
          command: MOCK_CLI,
          model: 'default',
          cwd,
          prompt: 'Generate the active screen.',
        }),
    },
  ];

  for (const item of cases) {
    const events = await withMockTrace('minimal-success', () => collectEvents(item.run(cwd)));
    const done = events.find(
      (event): event is Extract<AgentStreamEvent, { type: 'done' }> => event.type === 'done',
    );

    expect(
      events.map((event) => event.type),
      item.name,
    ).toEqual(['iteration-start', 'text-delta', 'usage', 'iteration-end', 'done']);
    expect(
      events.some((event) => event.type === 'error'),
      item.name,
    ).toBe(false);
    expect(done?.hadErrors, item.name).toBe(false);
    expect(done?.finalResponse.text, item.name).toBe('Done.');
    expect(done?.usage?.outputTokens, item.runtime).toBe(3);
  }
});

test('record-mode tees a real runtime invocation into the replay trace contract', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'sd-runner-record-cwd-'));
  const recordRoot = await mkdtemp(join(tmpdir(), 'sd-runner-record-root-'));
  const previousEnabled = process.env.SBER_DESIGNER_RUNTIME_RECORD;
  const previousRoot = process.env.SBER_DESIGNER_RUNTIME_RECORD_DIR;
  const previousPassthrough = process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH;
  process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH = 'SD_MOCK_TRACE,SD_MOCK_SPEED';
  const previousTrace = process.env.SD_MOCK_TRACE;
  const previousSpeed = process.env.SD_MOCK_SPEED;
  process.env.SBER_DESIGNER_RUNTIME_RECORD = '1';
  process.env.SBER_DESIGNER_RUNTIME_RECORD_DIR = recordRoot;
  process.env.SD_MOCK_TRACE = 'codex/minimal-success';
  process.env.SD_MOCK_SPEED = 'instant';
  try {
    await collectEvents(
      runCodexHandoff({
        command: MOCK_CLI,
        model: 'default',
        cwd,
        prompt: 'token sk-ant-abcdefghijklmnopqrstuvwxyz123456 should be redacted',
      }),
    );
  } finally {
    restoreEnv('SBER_DESIGNER_RUNTIME_RECORD', previousEnabled);
    restoreEnv('SBER_DESIGNER_RUNTIME_RECORD_DIR', previousRoot);
    if (previousPassthrough === undefined) delete process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH;
    else process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH = previousPassthrough;
    restoreEnv('SD_MOCK_TRACE', previousTrace);
    restoreEnv('SD_MOCK_SPEED', previousSpeed);
  }

  const runtimeDirs = await readdir(join(recordRoot, 'codex'));
  expect(runtimeDirs).toHaveLength(1);
  const traceDir = join(recordRoot, 'codex', runtimeDirs[0]!);
  const fixture = loadRuntimeTraceFixture(traceDir);
  const meta = JSON.parse(await readFile(join(traceDir, 'meta.json'), 'utf8')) as {
    promptBytes?: number;
  };

  expect(fixture.runtime).toBe('codex');
  expect(fixture.meta.exitCode).toBe(0);
  expect(meta.promptBytes).toBeGreaterThan(0);
  expect(await readFile(fixture.stdoutPath, 'utf8')).toContain('Done.');
  expect(await readFile(join(traceDir, 'prompt.txt'), 'utf8')).toContain('[redacted]');
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
