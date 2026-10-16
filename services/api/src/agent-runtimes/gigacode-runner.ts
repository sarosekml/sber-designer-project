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
import { addRuntimeUsage, hasRuntimeUsage, type RuntimeUsageSummary } from './usage';

export const GIGACODE_RUNTIME_PROVIDER = 'gigacode-runtime';

export interface RunGigaCodeHandoffInput {
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

/**
 * `auto-edit` is what makes a non-interactive run able to write files: the
 * Qwen-derived approval gate otherwise waits for a TTY confirmation that never
 * arrives (0131 Р-10 / open question В-1).
 */
export function buildGigaCodeRunArgs(
  model: string | null | undefined,
  runtimeSession?: AgentRuntimeRunSession | null,
): string[] {
  const args = ['--approval-mode', 'auto-edit', '--output-format', 'stream-json'];
  const selectedModel = model?.trim();
  if (selectedModel && selectedModel !== 'default') args.push('--model', selectedModel);
  const sessionId = runtimeSession?.sessionId?.trim();
  if (sessionId && runtimeSession?.mode === 'resume') {
    args.push('--resume', sessionId);
  } else if (sessionId && runtimeSession?.mode === 'new') {
    args.push('--session-id', sessionId);
  }
  return args;
}

export async function* runGigaCodeHandoff(
  input: RunGigaCodeHandoffInput,
): AsyncGenerator<AgentStreamEvent> {
  const iteration = 1;
  const args = buildGigaCodeRunArgs(input.model, input.runtimeSession);
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
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...buildRuntimeChildEnv(process.env, input.env),
      SBER_DESIGNER_RUNTIME: 'gigacode',
    },
  });
  const recorder = createRuntimeTraceRecorder({
    runtime: 'gigacode',
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
  let runtimeFailed = false;
  let initModel = '';
  let assistantModel = '';
  let usage: RuntimeUsageSummary = {};
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
    const metadata = emitGigaCodeSessionMetadata(line, emitRuntimeEvent);
    if (metadata?.modelSource === 'system.init') initModel = metadata.model;
    if (metadata?.modelSource === 'assistant.message') assistantModel = metadata.model;
    const normalizedEvents = input.onRuntimeStdoutNoise
      ? parseGigaCodeLine(line, { onRuntimeNoise: input.onRuntimeStdoutNoise })
      : parseGigaCodeLine(line);
    for (const normalized of normalizedEvents) {
      if (normalized.type === 'usage') usage = addRuntimeUsage(usage, normalized);
      if (normalized.type === 'error') runtimeFailed = true;
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
    const processFailed = code !== 0 || (signal !== null && signal !== 'SIGTERM');
    const hadErrors = runtimeFailed || processFailed;
    const finishReason = hadErrors ? 'other' : 'stop';
    if (code && code !== 0) {
      push({
        type: 'error',
        message: `GigaCode exited with code ${code}${stderrTail ? `: ${redact(stderrTail)}` : ''}`,
      });
    } else if (signal && signal !== 'SIGTERM') {
      push({ type: 'error', message: `GigaCode exited after signal ${signal}` });
    }
    push({
      type: 'iteration-end',
      iteration,
      hadToolCalls,
      finishReason,
    });
    const finalResponse: ChatResponse = {
      text: assistantText,
      provider: GIGACODE_RUNTIME_PROVIDER,
      model: assistantModel || initModel || input.model || 'default',
      finishReason,
      ...(hasRuntimeUsage(usage) ? { usage } : {}),
    };
    transcript.push({ role: 'assistant', content: assistantText });
    push({
      type: 'done',
      transcript,
      iterations: iteration,
      truncated: false,
      hadErrors,
      stoppedAfterPermissionDeny: false,
      finalResponse,
      ...(hasRuntimeUsage(usage) ? { usage } : {}),
    });
    wakeReader();
  };

  const resetWatchdog = () => {
    if (timeout) clearTimeout(timeout);
    const timeoutMs = input.timeoutMs ?? 15 * 60 * 1000;
    if (timeoutMs <= 0) return;
    timeout = setTimeout(() => {
      runtimeFailed = true;
      push({
        type: 'error',
        message: `GigaCode run timed out after ${Math.round(timeoutMs / 1000)}s.`,
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
    push({ type: 'error', message: `GigaCode spawn failed: ${err.message}` });
    finish(1, null);
  });
  child.on('close', finish);

  const abort = () => child.kill('SIGTERM');
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
    if (pendingRuntimeLogs.length > 0) await Promise.allSettled(pendingRuntimeLogs);
  }
}

interface GigaCodeUsage {
  input_tokens?: unknown;
  output_tokens?: unknown;
  cache_read_input_tokens?: unknown;
  total_tokens?: unknown;
}

type GigaCodeStreamEvent =
  | { type: 'system'; subtype?: unknown; session_id?: unknown; model?: unknown }
  | {
      type: 'assistant';
      session_id?: unknown;
      message?: { model?: unknown; content?: unknown; usage?: GigaCodeUsage };
    }
  | {
      type: 'message';
      action?: unknown;
      tool_call_id?: unknown;
      tool_name?: unknown;
      tool_input?: unknown;
      content?: unknown;
      is_error?: unknown;
    }
  | {
      type: 'result';
      subtype?: unknown;
      is_error?: unknown;
      result?: unknown;
      usage?: GigaCodeUsage;
    }
  | { type: 'error'; message?: unknown; error?: unknown }
  | { type: string; [key: string]: unknown };

/**
 * GigaCode keeps Claude's `system|assistant|result` frame but moves tool traffic
 * into `{"type":"message","action":"tool_call"|"tool_result"}`, so the Claude
 * mapper cannot be reused (0131 §3.3).
 */
export function parseGigaCodeLine(
  line: string,
  options: RuntimeStdoutFallbackOptions = {},
): NormalizedRunEvent[] {
  let event: GigaCodeStreamEvent;
  try {
    event = JSON.parse(line) as GigaCodeStreamEvent;
  } catch {
    return fallbackLineToNormalizedEvents(line, options);
  }
  switch (event.type) {
    case 'system':
      return [{ type: 'status', label: 'running' }];
    case 'assistant':
      return mapAssistantContent(
        (event as Extract<GigaCodeStreamEvent, { type: 'assistant' }>).message?.content,
      );
    case 'message':
      return mapToolMessage(event as Extract<GigaCodeStreamEvent, { type: 'message' }>);
    case 'result':
      return mapResult(event as Extract<GigaCodeStreamEvent, { type: 'result' }>);
    case 'error':
      return [
        {
          type: 'error',
          message: readErrorMessage(event as Extract<GigaCodeStreamEvent, { type: 'error' }>),
        },
      ];
    default:
      return [];
  }
}

export function emitGigaCodeSessionMetadata(
  line: string,
  emitRuntimeEvent: (event: string, data?: Record<string, unknown>) => void,
): { model: string; modelSource: 'system.init' | 'assistant.message' } | null {
  try {
    const event = JSON.parse(line) as {
      type?: unknown;
      subtype?: unknown;
      session_id?: unknown;
      model?: unknown;
      message?: { model?: unknown };
    };
    if (event.type === 'system' && event.subtype === 'init') {
      const sessionId = typeof event.session_id === 'string' ? event.session_id.trim() : '';
      if (sessionId) {
        emitRuntimeEvent('runtime.session', {
          runtime: 'gigacode',
          sessionId,
          captureEvent: 'system.init',
        });
      }
      const model = typeof event.model === 'string' ? event.model.trim() : '';
      if (!model) return null;
      emitRuntimeEvent('runtime.model', {
        runtime: 'gigacode',
        model,
        source: 'system.init',
      });
      return { model, modelSource: 'system.init' };
    }
    if (event.type !== 'assistant') return null;
    const model = typeof event.message?.model === 'string' ? event.message.model.trim() : '';
    if (!model) return null;
    // assistant.message.model is the model that actually produced the answer;
    // it intentionally supersedes the generic alias from system.init.
    emitRuntimeEvent('runtime.model', {
      runtime: 'gigacode',
      model,
      source: 'assistant.message',
    });
    return { model, modelSource: 'assistant.message' };
  } catch {
    // Non-JSON fallback output is handled by parseGigaCodeLine.
    return null;
  }
}

function mapAssistantContent(content: unknown): NormalizedRunEvent[] {
  if (!Array.isArray(content)) return [];
  let text = '';
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    const candidate = block as { type?: unknown; text?: unknown };
    if (candidate.type === 'text' && typeof candidate.text === 'string') text += candidate.text;
  }
  return text ? [{ type: 'text_delta', delta: text }] : [];
}

function mapToolMessage(
  event: Extract<GigaCodeStreamEvent, { type: 'message' }>,
): NormalizedRunEvent[] {
  const toolCallId = typeof event.tool_call_id === 'string' ? event.tool_call_id : '';
  if (!toolCallId) return [];
  if (event.action === 'tool_call') {
    return [
      {
        type: 'tool_use',
        id: toolCallId,
        name: typeof event.tool_name === 'string' ? event.tool_name : 'tool',
        input: event.tool_input ?? {},
      },
    ];
  }
  if (event.action === 'tool_result') {
    return [
      {
        type: 'tool_result',
        toolUseId: toolCallId,
        content: stringifyContent(event.content),
        isError: event.is_error === true,
      },
    ];
  }
  return [];
}

function mapResult(event: Extract<GigaCodeStreamEvent, { type: 'result' }>): NormalizedRunEvent[] {
  const events: NormalizedRunEvent[] = [];
  // `result.result` repeats text already streamed by `assistant` events; only the
  // aggregate usage is new.
  const usage = readUsage(event.usage);
  if (usage) events.push(usage);
  if (event.is_error === true || event.subtype === 'failure') {
    const detail = typeof event.result === 'string' ? event.result.trim() : '';
    events.push({ type: 'error', message: detail || 'GigaCode reported a failed run.' });
  }
  return events;
}

function readUsage(raw: GigaCodeUsage | undefined): NormalizedRunEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const inputTokens = numberOrUndefined(raw.input_tokens);
  const outputTokens = numberOrUndefined(raw.output_tokens);
  const totalTokens = numberOrUndefined(raw.total_tokens);
  if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) {
    return null;
  }
  return {
    type: 'usage',
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {}),
  };
}

function readErrorMessage(event: Extract<GigaCodeStreamEvent, { type: 'error' }>): string {
  if (typeof event.message === 'string' && event.message.trim()) return event.message.trim();
  if (typeof event.error === 'string' && event.error.trim()) return event.error.trim();
  const nested = event.error as { message?: unknown } | undefined;
  if (nested && typeof nested.message === 'string' && nested.message.trim()) {
    return nested.message.trim();
  }
  return 'GigaCode runtime error';
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
          ...(event.totalTokens !== undefined ? { totalTokens: event.totalTokens } : {}),
          ...(event.costUsd !== undefined ? { costUsd: event.costUsd } : {}),
        },
      };
  }
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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
