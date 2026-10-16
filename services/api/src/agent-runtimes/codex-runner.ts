import { buildRuntimeChildEnv } from './child-env';
import { spawn } from 'node:child_process';
import type { ChatMessage, ChatResponse } from '@sber-designer/llm-gateway';

import type { AgentStreamEvent } from '../agent/stream';
import { mapCodexRawEvent, type CodexRawEvent } from './codex-events';
import {
  fallbackLineToNormalizedEvents,
  type RuntimeStdoutFallbackOptions,
} from './stdout-fallback';
import { createRuntimeTraceRecorder } from './record-mode';
import { addRuntimeUsage, hasRuntimeUsage, type RuntimeUsageSummary } from './usage';
import type { AgentRuntimeRunSession } from './types';

export const CODEX_RUNTIME_PROVIDER = 'codex-runtime';

export interface RunCodexHandoffInput {
  command: string;
  model: string | null;
  cwd: string;
  prompt: string;
  runtimeSession?: AgentRuntimeRunSession | null;
  imagePaths?: string[];
  env?: Record<string, string | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
  onRuntimeStdoutNoise?: RuntimeStdoutFallbackOptions['onRuntimeNoise'];
  onRuntimeEvent?:
    | ((event: string, data: Record<string, unknown>) => void | Promise<void>)
    | undefined;
  configArgs?: string[];
}

export type CodexSmokeCheckResult =
  | { ok: true; detail: string }
  | {
      ok: false;
      code:
        | 'runtime_config_invalid'
        | 'runtime_spawn_failed'
        | 'runtime_startup_timeout'
        | 'runtime_nonzero_exit';
      detail: string;
      stderrTail?: string;
      configKey?: string;
      configValue?: string;
      expectedValues?: string[];
    };

export function buildCodexRunArgs(
  model: string | null | undefined,
  cwd: string,
  imagePaths: string[] = [],
  runtimeSession?: AgentRuntimeRunSession | null,
  configArgs: string[] = [],
): string[] {
  const args = [
    '--ask-for-approval',
    'never',
    '--cd',
    cwd,
    '--sandbox',
    'workspace-write',
    ...configArgs,
    'exec',
  ];
  const sessionId = runtimeSession?.sessionId?.trim();
  if (sessionId && runtimeSession?.mode === 'resume') args.push('resume', sessionId);
  args.push('--json');
  const selectedModel = model?.trim();
  if (selectedModel && selectedModel !== 'default') args.push('--model', selectedModel);
  for (const imagePath of imagePaths) {
    args.push('--image', imagePath);
  }
  return args;
}

export async function smokeCheckCodexRuntime(input: {
  command: string;
  model: string | null;
  cwd: string;
  processCwd?: string | null;
  timeoutMs?: number;
}): Promise<CodexSmokeCheckResult> {
  const args = buildCodexRunArgs(input.model, input.cwd);
  const timeoutMs = input.timeoutMs ?? 30_000;
  return await new Promise<CodexSmokeCheckResult>((resolve) => {
    let settled = false;
    let stderrTail = '';
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const finish = (result: CodexSmokeCheckResult) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolve(result);
    };
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(input.command, args, {
        cwd: input.processCwd ?? input.cwd,
        shell: false,
        stdio: ['pipe', 'ignore', 'pipe'],
        env: {
          ...buildRuntimeChildEnv(process.env),
          SBER_DESIGNER_RUNTIME: 'codex',
        },
      });
    } catch (err) {
      finish({
        ok: false,
        code: 'runtime_spawn_failed',
        detail: err instanceof Error ? err.message : String(err),
      });
      return;
    }
    // stdio is spawned as 'pipe' above, so these exist; the types stay
    // nullable because the stdio option is dynamic in general.
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      stderrTail = `${stderrTail}${chunk}`.slice(-2000);
    });
    child.on('error', (err) => {
      finish({ ok: false, code: 'runtime_spawn_failed', detail: err.message });
    });
    child.on('close', (code) => {
      if (code === 0) {
        finish({ ok: true, detail: 'Codex CLI smoke check passed.' });
        return;
      }
      const classified = classifyCodexExit(stderrTail);
      if (classified) {
        finish(codexInvalidConfigSmokeResult(classified, stderrTail));
        return;
      }
      finish({
        ok: false,
        code: 'runtime_nonzero_exit',
        detail: `Codex CLI smoke check exited with code ${code}${stderrTail ? `: ${redact(stderrTail)}` : ''}`,
        stderrTail: compactRuntimeLog(redact(stderrTail)),
      });
    });
    timeout = setTimeout(() => {
      const classified = classifyCodexExit(stderrTail);
      if (classified) {
        child.kill('SIGTERM');
        finish(codexInvalidConfigSmokeResult(classified, stderrTail));
        return;
      }
      child.kill('SIGTERM');
      finish({
        ok: false,
        code: 'runtime_startup_timeout',
        detail: `Codex CLI smoke check timed out after ${Math.round(timeoutMs / 1000)}s.`,
        stderrTail: compactRuntimeLog(redact(stderrTail)),
      });
    }, timeoutMs);
    timeout.unref?.();
    child.stdin?.end('Reply with OK. Do not edit files.');
  });
}

function codexInvalidConfigSmokeResult(
  classified: CodexExitClassification,
  stderrTail: string,
): CodexSmokeCheckResult {
  return {
    ok: false,
    code: 'runtime_config_invalid',
    detail: classified.message,
    stderrTail: compactRuntimeLog(redact(stderrTail)),
    configKey: classified.configKey,
    configValue: classified.configValue,
    expectedValues: classified.expectedValues,
  };
}

export async function* runCodexHandoff(
  input: RunCodexHandoffInput,
): AsyncGenerator<AgentStreamEvent> {
  const iteration = 1;
  const args = buildCodexRunArgs(
    input.model,
    input.cwd,
    input.imagePaths ?? [],
    input.runtimeSession,
    input.configArgs ?? [],
  );
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
  emitRuntimeEvent('codex.handoff.start', {
    command: input.command,
    args,
    cwd: input.cwd,
    model: input.model ?? 'default',
    imageCount: input.imagePaths?.length ?? 0,
    promptBytes: Buffer.byteLength(input.prompt, 'utf8'),
  });
  const child = spawn(input.command, args, {
    cwd: input.cwd,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...buildRuntimeChildEnv(process.env, input.env),
      SBER_DESIGNER_RUNTIME: 'codex',
    },
  });
  const recorder = createRuntimeTraceRecorder({
    runtime: 'codex',
    command: input.command,
    args,
    cwd: input.cwd,
    prompt: input.prompt,
    protocol: 'jsonl',
  });

  const queue: AgentStreamEvent[] = [{ type: 'iteration-start', iteration }];
  const transcript: ChatMessage[] = [{ role: 'user', content: input.prompt }];
  let assistantText = '';
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
  const finish = (code: number | null, signal: NodeJS.Signals | null) => {
    if (finished) return;
    finished = true;
    recorder?.finish(code, signal);
    if (timeout) clearTimeout(timeout);
    if (stdoutBuffer.trim()) {
      emitCodexRuntimeSession(stdoutBuffer.trim(), emitRuntimeEvent);
      for (const event of parseCodexLine(stdoutBuffer.trim(), {
        onRuntimeNoise: input.onRuntimeStdoutNoise,
      })) {
        emitCodexCumulativeUsage(event, emitRuntimeEvent);
        const runEvent = codexEventUsageForRun(event, input.runtimeSession);
        if (runEvent.type === 'usage') {
          usage = addRuntimeUsage(usage, runEvent);
        }
        const encoded = encodeNormalizedEvent(runEvent, iteration);
        if (encoded?.type === 'text-delta') assistantText += encoded.delta;
        if (encoded) push(encoded);
      }
      stdoutBuffer = '';
    }
    const codexFailure = classifyCodexExit(stderrTail);
    emitRuntimeEvent('codex.exit', {
      code,
      signal,
      stderrTail: compactRuntimeLog(redact(stderrTail)),
      classification: codexFailure?.classification ?? (code && code !== 0 ? 'nonzero_exit' : 'ok'),
      ...(codexFailure?.configKey ? { configKey: codexFailure.configKey } : {}),
      ...(codexFailure?.configValue ? { configValue: codexFailure.configValue } : {}),
      ...(codexFailure?.expectedValues ? { expectedValues: codexFailure.expectedValues } : {}),
    });
    if (code && code !== 0) {
      push({
        type: 'error',
        message: codexFailure
          ? `Codex exited with code ${code}: ${codexFailure.message}`
          : `Codex exited with code ${code}${stderrTail ? `: ${redact(stderrTail)}` : ''}`,
      });
    } else if (signal && signal !== 'SIGTERM') {
      push({ type: 'error', message: `Codex exited after signal ${signal}` });
    }
    push({
      type: 'iteration-end',
      iteration,
      hadToolCalls: false,
      finishReason: code === 0 ? 'stop' : 'other',
    });
    const finalResponse: ChatResponse = {
      text: assistantText,
      provider: CODEX_RUNTIME_PROVIDER,
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
    const timeoutMs = input.timeoutMs ?? 15 * 60 * 1000;
    if (timeoutMs <= 0) return;
    timeout = setTimeout(() => {
      push({
        type: 'error',
        message: `Codex run timed out after ${Math.round(timeoutMs / 1000)}s.`,
      });
      child.kill('SIGTERM');
    }, timeoutMs);
    timeout.unref?.();
  };

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.on('spawn', () => {
    emitRuntimeEvent('codex.spawn', {
      pid: child.pid ?? null,
    });
  });

  child.stdout.on('data', (chunk: string) => {
    recorder?.recordStdout(chunk);
    resetWatchdog();
    stdoutBuffer += chunk;
    let newline;
    while ((newline = stdoutBuffer.indexOf('\n')) !== -1) {
      const line = stdoutBuffer.slice(0, newline).trim();
      stdoutBuffer = stdoutBuffer.slice(newline + 1);
      if (!line) continue;
      emitCodexRuntimeSession(line, emitRuntimeEvent);
      for (const normalized of parseCodexLine(line, {
        onRuntimeNoise: input.onRuntimeStdoutNoise,
      })) {
        emitCodexCumulativeUsage(normalized, emitRuntimeEvent);
        const runEvent = codexEventUsageForRun(normalized, input.runtimeSession);
        if (runEvent.type === 'usage') {
          usage = addRuntimeUsage(usage, runEvent);
        }
        const event = encodeNormalizedEvent(runEvent, iteration);
        if (!event) continue;
        if (event.type === 'text-delta') assistantText += event.delta;
        push(event);
      }
    }
  });

  child.stderr.on('data', (chunk: string) => {
    recorder?.recordStderr(chunk);
    stderrTail = `${stderrTail}${chunk}`.slice(-2000);
    emitRuntimeEvent('codex.stderr', {
      chunk: compactRuntimeLog(redact(chunk)),
    });
  });

  child.on('error', (err) => {
    recorder?.recordStderr(err.message);
    emitRuntimeEvent('codex.spawn.error', {
      message: err.message,
    });
    push({ type: 'error', message: `Codex spawn failed: ${err.message}` });
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
    if (pendingRuntimeLogs.length > 0) {
      await Promise.allSettled(pendingRuntimeLogs);
    }
  }
}

export interface CodexExitClassification {
  classification: 'config_invalid';
  configKey: string;
  configValue: string;
  expectedValues: string[];
  message: string;
}

export function classifyCodexExit(stderr: string): CodexExitClassification | null {
  const match =
    /Error loading config\.toml:\s*unknown variant `([^`]+)`, expected ([\s\S]*?)\s+in `([^`]+)`/u.exec(
      stderr,
    );
  if (!match) return null;
  const configValue = match[1] ?? 'unknown';
  const expectedValues = Array.from((match[2] ?? '').matchAll(/`([^`]+)`/gu))
    .map((item) => item[1])
    .filter((value): value is string => value !== undefined);
  const configKey = match[3] ?? 'unknown';
  const expected = expectedValues.length > 0 ? expectedValues.join(' or ') : 'a supported value';
  return {
    classification: 'config_invalid',
    configKey,
    configValue,
    expectedValues,
    message: `Codex config invalid: ${configKey}="${configValue}" is not supported by this Codex CLI. Use ${configKey}="${expected}" in ~/.codex/config.toml or update the configured Codex CLI.`,
  };
}

export function parseCodexLine(line: string, options: RuntimeStdoutFallbackOptions = {}) {
  try {
    return mapCodexRawEvent(JSON.parse(line) as CodexRawEvent);
  } catch {
    return fallbackLineToNormalizedEvents(line, options);
  }
}

function emitCodexRuntimeSession(
  line: string,
  emitRuntimeEvent: (event: string, data?: Record<string, unknown>) => void,
): void {
  try {
    const parsed = JSON.parse(line) as CodexRawEvent;
    if (parsed.type !== 'thread.started') return;
    const sessionId = typeof parsed.thread_id === 'string' ? parsed.thread_id.trim() : '';
    if (!sessionId) return;
    emitRuntimeEvent('runtime.session', {
      runtime: 'codex',
      sessionId,
      threadId: sessionId,
      captureEvent: 'thread.started',
    });
  } catch {
    // Non-JSON fallback output is handled by parseCodexLine.
  }
}

function encodeNormalizedEvent(
  event: ReturnType<typeof mapCodexRawEvent>[number],
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

function codexEventUsageForRun(
  event: ReturnType<typeof mapCodexRawEvent>[number],
  runtimeSession: AgentRuntimeRunSession | null | undefined,
): ReturnType<typeof mapCodexRawEvent>[number] {
  if (event.type !== 'usage' || runtimeSession?.mode !== 'resume') return event;
  const baseline = runtimeSession.usageBaseline;
  if (!baseline) return event;
  const pairs = [
    [event.inputTokens, baseline.inputTokens],
    [event.outputTokens, baseline.outputTokens],
    [event.costUsd, baseline.costUsd],
  ] as const;
  const comparable = pairs.filter(
    (pair): pair is readonly [number, number] => pair[0] !== undefined && pair[1] !== undefined,
  );
  if (comparable.length === 0 || comparable.some(([current, previous]) => current < previous)) {
    return event;
  }
  return {
    ...event,
    ...(event.inputTokens !== undefined && baseline.inputTokens !== undefined
      ? { inputTokens: event.inputTokens - baseline.inputTokens }
      : {}),
    ...(event.outputTokens !== undefined && baseline.outputTokens !== undefined
      ? { outputTokens: event.outputTokens - baseline.outputTokens }
      : {}),
    ...(event.costUsd !== undefined && baseline.costUsd !== undefined
      ? { costUsd: event.costUsd - baseline.costUsd }
      : {}),
  };
}

function emitCodexCumulativeUsage(
  event: ReturnType<typeof mapCodexRawEvent>[number],
  emitRuntimeEvent: (event: string, data?: Record<string, unknown>) => void,
): void {
  if (event.type !== 'usage') return;
  emitRuntimeEvent('runtime.usage.cumulative', {
    runtime: 'codex',
    ...(event.inputTokens !== undefined ? { inputTokens: event.inputTokens } : {}),
    ...(event.outputTokens !== undefined ? { outputTokens: event.outputTokens } : {}),
    ...(event.costUsd !== undefined ? { costUsd: event.costUsd } : {}),
  });
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

function compactRuntimeLog(value: string, max = 2_000): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length <= max ? compact : `${compact.slice(0, max - 16).trim()}... [truncated]`;
}
