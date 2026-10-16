import { buildRuntimeChildEnv } from './child-env';
import { spawn } from 'node:child_process';
import type { ChatMessage, ChatResponse } from '@sber-designer/llm-gateway';

import type { AgentStreamEvent } from '../agent/stream';
import {
  mapOpenCodeRawEvent,
  type NormalizedRunEvent,
  type OpenCodeRawEvent,
} from './opencode-events';
import {
  fallbackLineToNormalizedEvents,
  type RuntimeStdoutFallbackOptions,
} from './stdout-fallback';
import { createRuntimeTraceRecorder } from './record-mode';
import { addRuntimeUsage, hasRuntimeUsage, type RuntimeUsageSummary } from './usage';

export const OPENCODE_RUNTIME_PROVIDER = 'opencode-runtime';

export interface RunOpenCodeHandoffInput {
  command: string;
  model: string | null;
  cwd: string;
  prompt: string;
  env?: Record<string, string | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
  onRuntimeStdoutNoise?: RuntimeStdoutFallbackOptions['onRuntimeNoise'];
}

export function buildOpenCodeRunArgs(
  model: string | null | undefined,
  cwd?: string | null,
): string[] {
  const args = ['run', '--format', 'json'];
  const directory = cwd?.trim();
  if (directory) args.push('--dir', directory);
  const selectedModel = model?.trim();
  if (selectedModel && selectedModel !== 'default') args.push('--model', selectedModel);
  return args;
}

export async function* runOpenCodeHandoff(
  input: RunOpenCodeHandoffInput,
): AsyncGenerator<AgentStreamEvent> {
  const iteration = 1;
  const args = buildOpenCodeRunArgs(input.model, input.cwd);
  const child = spawn(input.command, args, {
    cwd: input.cwd,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...buildRuntimeChildEnv(process.env, input.env),
      SBER_DESIGNER_RUNTIME: 'opencode',
    },
  });
  const recorder = createRuntimeTraceRecorder({
    runtime: 'opencode',
    command: input.command,
    args,
    cwd: input.cwd,
    prompt: input.prompt,
    protocol: 'jsonl',
  });

  const queue: AgentStreamEvent[] = [{ type: 'iteration-start', iteration }];
  const seenToolUses = new Set<string>();
  const transcript: ChatMessage[] = [{ role: 'user', content: input.prompt }];
  let assistantText = '';
  let usage: RuntimeUsageSummary = {};
  let finished = false;
  let stderrTail = '';
  let stdoutBuffer = '';
  let timeout: NodeJS.Timeout | null = null;
  let wake: (() => void) | null = null;

  const wakeReader = () => {
    const fn = wake;
    wake = null;
    fn?.();
  };
  const push = (event: AgentStreamEvent) => {
    queue.push(event);
    wakeReader();
  };
  const finish = (code: number | null, signal: NodeJS.Signals | null) => {
    if (finished) return;
    finished = true;
    recorder?.finish(code, signal);
    if (timeout) clearTimeout(timeout);
    if (code && code !== 0) {
      push({
        type: 'error',
        message: `OpenCode exited with code ${code}${stderrTail ? `: ${redact(stderrTail)}` : ''}`,
      });
    } else if (signal && signal !== 'SIGTERM') {
      push({ type: 'error', message: `OpenCode exited after signal ${signal}` });
    }
    push({
      type: 'iteration-end',
      iteration,
      hadToolCalls: false,
      finishReason: code === 0 ? 'stop' : 'other',
    });
    const finalResponse: ChatResponse = {
      text: assistantText,
      provider: OPENCODE_RUNTIME_PROVIDER,
      model: input.model ?? 'default',
      finishReason: code === 0 ? 'stop' : 'other',
      ...(hasRuntimeUsage(usage) ? { usage } : {}),
    };
    transcript.push({ role: 'assistant', content: assistantText });
    push({
      type: 'done',
      transcript,
      iterations: iteration,
      truncated: false,
      hadErrors: code !== 0,
      stoppedAfterPermissionDeny: false,
      finalResponse,
      ...(hasRuntimeUsage(usage) ? { usage } : {}),
    });
    wakeReader();
  };

  const resetWatchdog = () => {
    if (timeout) clearTimeout(timeout);
    const timeoutMs = input.timeoutMs ?? 10 * 60 * 1000;
    if (timeoutMs <= 0) return;
    timeout = setTimeout(() => {
      push({
        type: 'error',
        message: `OpenCode run timed out after ${Math.round(timeoutMs / 1000)}s.`,
      });
      child.kill('SIGTERM');
    }, timeoutMs);
    timeout.unref?.();
  };

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  child.stdout.on('data', (chunk: string) => {
    recorder?.recordStdout(chunk);
    resetWatchdog();
    stdoutBuffer += chunk;
    let newline;
    while ((newline = stdoutBuffer.indexOf('\n')) !== -1) {
      const line = stdoutBuffer.slice(0, newline).trim();
      stdoutBuffer = stdoutBuffer.slice(newline + 1);
      if (!line) continue;
      for (const normalized of parseOpenCodeLine(line, seenToolUses, {
        onRuntimeNoise: input.onRuntimeStdoutNoise,
      })) {
        if (normalized.type === 'usage') {
          usage = addRuntimeUsage(usage, normalized);
        }
        const event = encodeNormalizedEvent(normalized, iteration);
        if (!event) continue;
        if (event.type === 'text-delta') assistantText += event.delta;
        push(event);
      }
    }
  });

  child.stderr.on('data', (chunk: string) => {
    recorder?.recordStderr(chunk);
    stderrTail = `${stderrTail}${chunk}`.slice(-2000);
  });

  child.on('error', (err) => {
    recorder?.recordStderr(err.message);
    push({ type: 'error', message: `OpenCode spawn failed: ${err.message}` });
    finish(1, null);
  });
  child.on('close', finish);

  const abort = () => {
    child.kill('SIGTERM');
  };
  input.signal?.addEventListener('abort', abort, { once: true });

  resetWatchdog();
  child.stdin.end(input.prompt);

  try {
    while (!finished || queue.length > 0) {
      if (queue.length > 0) {
        yield queue.shift()!;
        continue;
      }
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
  } finally {
    input.signal?.removeEventListener('abort', abort);
    if (timeout) clearTimeout(timeout);
    if (!finished) child.kill('SIGTERM');
    await recorder?.settled();
  }
}

export function parseOpenCodeLine(
  line: string,
  seenToolUses: Set<string>,
  options: RuntimeStdoutFallbackOptions = {},
): NormalizedRunEvent[] {
  try {
    const parsed = JSON.parse(line) as OpenCodeRawEvent;
    return mapOpenCodeRawEvent(parsed, seenToolUses);
  } catch {
    return fallbackLineToNormalizedEvents(line, options);
  }
}

function encodeNormalizedEvent(
  event: NormalizedRunEvent,
  iteration: number,
): AgentStreamEvent | null {
  switch (event.type) {
    case 'text_delta':
      return { type: 'text-delta', iteration, delta: event.delta };
    case 'tool_use':
      return {
        type: 'tool-call',
        iteration,
        call: { id: event.id, name: event.name, arguments: stringify(event.input) },
      };
    case 'tool_result':
      return {
        type: 'tool-result',
        iteration,
        toolCallId: event.toolUseId,
        content: event.content,
        isError: event.isError,
      };
    case 'error':
      return { type: 'error', message: event.message };
    case 'status':
      return null;
    case 'usage':
      return {
        type: 'usage',
        iteration,
        usage: {
          ...(event.inputTokens !== undefined ? { inputTokens: event.inputTokens } : {}),
          ...(event.outputTokens !== undefined ? { outputTokens: event.outputTokens } : {}),
          ...(event.costUsd !== undefined ? { costUsd: event.costUsd } : {}),
        },
      };
  }
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return '{}';
  }
}

function redact(value: string): string {
  return value.replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]').trim();
}
