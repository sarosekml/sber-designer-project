import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { AgentStreamEvent } from '../../services/api/src/agent/stream';
import { runClaudeCodeHandoff } from '../../services/api/src/agent-runtimes/claude-runner';
import { runCodexHandoff } from '../../services/api/src/agent-runtimes/codex-runner';
import { runGigaCodeHandoff } from '../../services/api/src/agent-runtimes/gigacode-runner';
import { runKimiHandoff } from '../../services/api/src/agent-runtimes/kimi-runner';
import { runOpenCodeHandoff } from '../../services/api/src/agent-runtimes/opencode-runner';
import type { RuntimeTraceFixture } from '../../services/api/src/agent-runtimes/replay-trace-contract';

const MOCK_CLI = join(import.meta.dir, '..', 'mocks', 'runtime-mock.ts');

export type NormalizedRuntimeReplayEvent =
  | { type: 'iteration-start'; iteration: number }
  | { type: 'text-delta'; iteration: number; delta: string }
  | { type: 'tool-call'; iteration: number; call: { id: string; name: string; arguments: string } }
  | {
      type: 'tool-result';
      iteration: number;
      toolCallId: string;
      content: string;
      isError: boolean;
    }
  | { type: 'usage'; iteration: number; usage: Record<string, unknown> }
  | {
      type: 'iteration-end';
      iteration: number;
      hadToolCalls: boolean;
      finishReason?: string;
    }
  | {
      type: 'done';
      iterations: number;
      truncated: boolean;
      hadErrors: boolean;
      stoppedAfterPermissionDeny: boolean;
      finalResponse: {
        text: string;
        provider: string;
        model: string;
        finishReason?: string;
        usage?: Record<string, unknown>;
      };
      usage?: Record<string, unknown>;
    }
  | {
      type: 'runtime-session';
      sessionId: string;
      threadId?: string;
      captureEvent?: string;
    }
  | { type: 'error'; message: string };

export interface RuntimeReplayGoldenResult {
  goldenPath: string;
  actual: NormalizedRuntimeReplayEvent[];
  expected: NormalizedRuntimeReplayEvent[];
  updated: boolean;
}

export async function replayRuntimeTraceFixture(
  fixture: RuntimeTraceFixture,
  options: { cwd: string },
): Promise<AgentStreamEvent[]> {
  return await withMockTrace(fixture.dir, async () => {
    const events: AgentStreamEvent[] = [];
    for await (const event of runFixture(fixture, options.cwd)) {
      events.push(event);
    }
    return events;
  });
}

export async function readOrUpdateRuntimeReplayGolden(
  fixture: RuntimeTraceFixture,
  events: AgentStreamEvent[],
): Promise<RuntimeReplayGoldenResult> {
  const actual = normalizeRuntimeReplayEvents(events);
  const goldenPath = join(fixture.dir, 'events.golden.json');

  if (process.env.RUNTIME_GOLDEN_UPDATE === '1') {
    await writeFile(goldenPath, `${JSON.stringify(actual, null, 2)}\n`, 'utf8');
    return { goldenPath, actual, expected: actual, updated: true };
  }

  let expected: NormalizedRuntimeReplayEvent[];
  try {
    expected = JSON.parse(await readFile(goldenPath, 'utf8')) as NormalizedRuntimeReplayEvent[];
  } catch (error) {
    throw new Error(
      `Missing or invalid runtime replay golden at ${goldenPath}. Run RUNTIME_GOLDEN_UPDATE=1 bun test tests/0107-runtime-replay-goldens.test.ts to refresh it. Cause: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return { goldenPath, actual, expected, updated: false };
}

export function normalizeRuntimeReplayEvents(
  events: AgentStreamEvent[],
): NormalizedRuntimeReplayEvent[] {
  return events.flatMap((event): NormalizedRuntimeReplayEvent[] => {
    switch (event.type) {
      case 'iteration-start':
        return [{ type: 'iteration-start', iteration: event.iteration }];
      case 'text-delta':
        return [{ type: 'text-delta', iteration: event.iteration, delta: event.delta }];
      case 'tool-call':
        return [{ type: 'tool-call', iteration: event.iteration, call: event.call }];
      case 'tool-result':
        return [
          {
            type: 'tool-result',
            iteration: event.iteration,
            toolCallId: event.toolCallId,
            content: event.content,
            isError: event.isError,
          },
        ];
      case 'usage':
        return [{ type: 'usage', iteration: event.iteration, usage: event.usage }];
      case 'external-runtime-diagnostic':
        if (event.name !== 'runtime.session') return [];
        if (typeof event.data.sessionId !== 'string') return [];
        return [
          {
            type: 'runtime-session',
            sessionId: event.data.sessionId,
            ...(typeof event.data.threadId === 'string' ? { threadId: event.data.threadId } : {}),
            ...(typeof event.data.captureEvent === 'string'
              ? { captureEvent: event.data.captureEvent }
              : {}),
          },
        ];
      case 'iteration-end':
        return [
          {
            type: 'iteration-end',
            iteration: event.iteration,
            hadToolCalls: event.hadToolCalls,
            ...(event.finishReason ? { finishReason: event.finishReason } : {}),
          },
        ];
      case 'done':
        return [
          {
            type: 'done',
            iterations: event.iterations,
            truncated: event.truncated,
            hadErrors: event.hadErrors,
            stoppedAfterPermissionDeny: event.stoppedAfterPermissionDeny,
            finalResponse: {
              text: event.finalResponse.text,
              provider: event.finalResponse.provider,
              model: event.finalResponse.model,
              ...(event.finalResponse.finishReason
                ? { finishReason: event.finalResponse.finishReason }
                : {}),
              ...(event.finalResponse.usage ? { usage: event.finalResponse.usage } : {}),
            },
            ...(event.usage ? { usage: event.usage } : {}),
          },
        ];
      case 'error':
        return [{ type: 'error', message: event.message }];
      default:
        return [];
    }
  });
}

function runFixture(fixture: RuntimeTraceFixture, cwd: string): AsyncGenerator<AgentStreamEvent> {
  switch (fixture.runtime) {
    case 'claude-code':
      return runClaudeCodeHandoff({
        command: MOCK_CLI,
        model: 'default',
        cwd,
        prompt: 'Replay the runtime trace.',
      });
    case 'codex':
      return runSessionCapturingFixture(runCodexHandoff, cwd);
    case 'gigacode':
      return runSessionCapturingFixture(runGigaCodeHandoff, cwd);
    case 'kimi':
      return runSessionCapturingFixture(runKimiHandoff, cwd);
    case 'opencode':
      return runOpenCodeHandoff({
        command: MOCK_CLI,
        model: 'default',
        cwd,
        prompt: 'Replay the runtime trace.',
      });
  }
}

type SessionCapturingRunner = (input: {
  command: string;
  model: string | null;
  cwd: string;
  prompt: string;
  onRuntimeEvent: (name: string, data: Record<string, unknown>) => void;
}) => AsyncGenerator<AgentStreamEvent>;

async function* runSessionCapturingFixture(
  runner: SessionCapturingRunner,
  cwd: string,
): AsyncGenerator<AgentStreamEvent> {
  const runtimeEvents: AgentStreamEvent[] = [];
  const flushRuntimeEvents = async function* () {
    while (runtimeEvents.length > 0) {
      yield runtimeEvents.shift()!;
    }
  };
  const stream = runner({
    command: MOCK_CLI,
    model: 'default',
    cwd,
    prompt: 'Replay the runtime trace.',
    onRuntimeEvent: (name, data) => {
      if (name !== 'runtime.session') return;
      runtimeEvents.push({ type: 'external-runtime-diagnostic', name, data });
    },
  });

  for await (const event of stream) {
    yield* flushRuntimeEvents();
    yield event;
  }
  yield* flushRuntimeEvents();
}

async function withMockTrace<T>(traceDir: string, fn: () => Promise<T>): Promise<T> {
  const previousPassthrough = process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH;
  process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH = 'SD_MOCK_TRACE,SD_MOCK_SPEED';
  const previousTrace = process.env.SD_MOCK_TRACE;
  const previousSpeed = process.env.SD_MOCK_SPEED;
  process.env.SD_MOCK_TRACE = traceDir;
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

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
