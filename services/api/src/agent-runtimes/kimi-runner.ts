import { buildRuntimeChildEnv } from './child-env';
import { spawn } from 'node:child_process';
import type { ChatMessage, ChatResponse } from '@sber-designer/llm-gateway';

import type { AgentStreamEvent } from '../agent/stream';
import type { NormalizedRunEvent } from './opencode-events';
import { createRuntimeTraceRecorder } from './record-mode';
import {
  fallbackLineToNormalizedEvents,
  type RuntimeStdoutFallbackOptions,
} from './stdout-fallback';
import type { AgentRuntimeRunSession } from './types';

export const KIMI_RUNTIME_PROVIDER = 'kimi-runtime';

export interface RunKimiHandoffInput {
  command: string;
  model: string | null;
  cwd: string;
  prompt: string;
  runtimeSession?: AgentRuntimeRunSession | null;
  env?: Record<string, string | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
  onRuntimeStdoutNoise?: RuntimeStdoutFallbackOptions['onRuntimeNoise'];
  onRuntimeEvent?:
    | ((event: string, data: Record<string, unknown>) => void | Promise<void>)
    | undefined;
}

export function buildKimiRunArgs(
  model: string | null | undefined,
  runtimeSession?: AgentRuntimeRunSession | null,
): string[] {
  const args = ['--output-format', 'stream-json'];
  const selectedModel = model?.trim();
  if (selectedModel && selectedModel !== 'default') args.push('--model', selectedModel);
  const sessionId = runtimeSession?.sessionId?.trim();
  if (sessionId && runtimeSession?.mode === 'resume') args.push('--session', sessionId);
  return args;
}

export async function* runKimiHandoff(
  input: RunKimiHandoffInput,
): AsyncGenerator<AgentStreamEvent> {
  const iteration = 1;
  const args = [...buildKimiRunArgs(input.model, input.runtimeSession), '--prompt', input.prompt];
  const pendingRuntimeLogs: Promise<void>[] = [];
  const emitRuntimeEvent = (event: string, data: Record<string, unknown> = {}) => {
    try {
      const result = input.onRuntimeEvent?.(event, data);
      if (result && typeof (result as Promise<void>).then === 'function') {
        pendingRuntimeLogs.push(Promise.resolve(result).catch(() => undefined));
      }
    } catch {
      // Runtime diagnostics are best-effort and must never break the agent stream.
    }
  };
  const child = spawn(input.command, args, {
    cwd: input.cwd,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...buildRuntimeChildEnv(process.env, input.env),
      SBER_DESIGNER_RUNTIME: 'kimi',
    },
  });
  const recorder = createRuntimeTraceRecorder({
    runtime: 'kimi',
    command: input.command,
    args,
    cwd: input.cwd,
    prompt: input.prompt,
    protocol: 'stream-json',
  });

  const queue: AgentStreamEvent[] = [{ type: 'iteration-start', iteration }];
  const transcript: ChatMessage[] = [{ role: 'user', content: input.prompt }];
  let assistantText = '';
  let hadToolCalls = false;
  let stdoutBuffer = '';
  let stderrTail = '';
  let finished = false;
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
  const consumeLine = (line: string) => {
    emitKimiRuntimeMetadata(line, emitRuntimeEvent);
    const normalizedEvents = input.onRuntimeStdoutNoise
      ? parseKimiLine(line, { onRuntimeNoise: input.onRuntimeStdoutNoise })
      : parseKimiLine(line);
    for (const normalized of normalizedEvents) {
      const event = encodeNormalizedEvent(normalized, iteration);
      if (!event) continue;
      if (event.type === 'text-delta') assistantText += event.delta;
      if (event.type === 'tool-call') hadToolCalls = true;
      push(event);
    }
  };
  const finish = (code: number | null, signal: NodeJS.Signals | null) => {
    if (finished) return;
    finished = true;
    recorder?.finish(code, signal);
    if (timeout) clearTimeout(timeout);
    if (stdoutBuffer.trim()) consumeLine(stdoutBuffer.trim());
    stdoutBuffer = '';
    if (code && code !== 0) {
      push({
        type: 'error',
        message: `Kimi Code exited with code ${code}${stderrTail ? `: ${redact(stderrTail)}` : ''}`,
      });
    } else if (signal && signal !== 'SIGTERM') {
      push({ type: 'error', message: `Kimi Code exited after signal ${signal}` });
    }
    push({
      type: 'iteration-end',
      iteration,
      hadToolCalls,
      finishReason: code === 0 ? 'stop' : 'other',
    });
    const finalResponse: ChatResponse = {
      text: assistantText,
      provider: KIMI_RUNTIME_PROVIDER,
      model: input.model ?? 'default',
      finishReason: code === 0 ? 'stop' : 'other',
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
    });
    wakeReader();
  };

  const resetWatchdog = () => {
    if (timeout) clearTimeout(timeout);
    const timeoutMs = input.timeoutMs ?? 15 * 60 * 1000;
    if (timeoutMs <= 0) return;
    timeout = setTimeout(() => {
      push({
        type: 'error',
        message: `Kimi Code run timed out after ${Math.round(timeoutMs / 1000)}s.`,
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
      if (line) consumeLine(line);
    }
  });
  child.stderr.on('data', (chunk: string) => {
    recorder?.recordStderr(chunk);
    stderrTail = `${stderrTail}${chunk}`.slice(-2000);
  });
  child.on('error', (err) => {
    recorder?.recordStderr(err.message);
    push({ type: 'error', message: `Kimi Code spawn failed: ${err.message}` });
    finish(1, null);
  });
  child.on('close', finish);

  const abort = () => child.kill('SIGTERM');
  input.signal?.addEventListener('abort', abort, { once: true });
  resetWatchdog();

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
    if (pendingRuntimeLogs.length > 0) await Promise.allSettled(pendingRuntimeLogs);
  }
}

type KimiStreamEvent =
  | {
      role: 'assistant';
      content?: unknown;
      tool_calls?: Array<{
        id?: unknown;
        function?: { name?: unknown; arguments?: unknown };
      }>;
    }
  | { role: 'tool'; tool_call_id?: unknown; content?: unknown; is_error?: unknown }
  | { role: 'meta'; type?: unknown; session_id?: unknown; [key: string]: unknown };

export function parseKimiLine(
  line: string,
  options: RuntimeStdoutFallbackOptions = {},
): NormalizedRunEvent[] {
  let event: KimiStreamEvent;
  try {
    event = JSON.parse(line) as KimiStreamEvent;
  } catch {
    return fallbackLineToNormalizedEvents(line, options);
  }
  if (event.role === 'assistant') {
    const normalized: NormalizedRunEvent[] = [];
    if (typeof event.content === 'string' && event.content.length > 0) {
      normalized.push({ type: 'text_delta', delta: event.content });
    }
    for (const call of event.tool_calls ?? []) {
      const id = typeof call.id === 'string' ? call.id : '';
      const name = typeof call.function?.name === 'string' ? call.function.name : '';
      if (!id || !name) continue;
      normalized.push({
        type: 'tool_use',
        id,
        name,
        input: parseToolInput(call.function?.arguments),
      });
    }
    return normalized;
  }
  if (event.role === 'tool') {
    const toolUseId = typeof event.tool_call_id === 'string' ? event.tool_call_id : '';
    return toolUseId
      ? [
          {
            type: 'tool_result',
            toolUseId,
            content: stringifyContent(event.content),
            isError: event.is_error === true,
          },
        ]
      : [];
  }
  return [];
}

function emitKimiRuntimeMetadata(
  line: string,
  emitRuntimeEvent: (event: string, data?: Record<string, unknown>) => void,
): void {
  try {
    const event = JSON.parse(line) as KimiStreamEvent;
    if (event.role !== 'meta') return;
    if (event.type === 'session.resume_hint') {
      const sessionId = typeof event.session_id === 'string' ? event.session_id.trim() : '';
      if (sessionId) {
        emitRuntimeEvent('runtime.session', {
          runtime: 'kimi',
          sessionId,
          captureEvent: 'session.resume_hint',
        });
      }
      return;
    }
    if (typeof event.type === 'string') emitRuntimeEvent(`kimi.${event.type}`, event);
  } catch {
    // Non-JSON fallback output is handled by parseKimiLine.
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
        call: { id: event.id, name: event.name, arguments: stringifyContent(event.input) },
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

function parseToolInput(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? {};
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function stringifyContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function redact(value: string): string {
  return value.replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]').trim();
}
