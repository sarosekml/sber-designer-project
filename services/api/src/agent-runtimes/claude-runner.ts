import { buildRuntimeChildEnv } from './child-env';
import { spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';
import type { ChatMessage, ChatResponse } from '@sber-designer/llm-gateway';

import type { AgentStreamEvent } from '../agent/stream';
import { mapClaudeCodeRawEvent, type ClaudeCodeRawEvent } from './claude-events';
import { classifyRuntimeFailure } from './failure-taxonomy';
import type { NormalizedRunEvent } from './opencode-events';
import {
  fallbackLineToNormalizedEvents,
  type RuntimeStdoutFallbackOptions,
} from './stdout-fallback';
import { createRuntimeTraceRecorder } from './record-mode';
import { addRuntimeUsage, hasRuntimeUsage, type RuntimeUsageSummary } from './usage';
import type { AgentRunRuntimeLaunchDiagnostics } from '../agent/run-recorder';
import type { AgentRuntimeRunSession, RuntimeDiagnostic } from './types';

export const CLAUDE_CODE_RUNTIME_PROVIDER = 'claude-code-runtime';

export interface RunClaudeCodeHandoffInput {
  command: string;
  model: string | null;
  cwd: string;
  prompt: string;
  runtimeConfigArgs?: string[];
  runtimeSession?: AgentRuntimeRunSession | null;
  imagePaths?: string[];
  env?: Record<string, string | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
  onRuntimeStdoutNoise?: RuntimeStdoutFallbackOptions['onRuntimeNoise'];
  onRuntimeEvent?:
    | ((event: string, data: Record<string, unknown>) => void | Promise<void>)
    | undefined;
}

export function buildClaudeCodeRunArgs(
  model: string | null | undefined,
  _imagePaths: string[] = [],
  runtimeSession?: AgentRuntimeRunSession | null,
  runtimeConfigArgs: string[] = [],
): string[] {
  const args = [
    ...runtimeConfigArgs,
    '-p',
    '--verbose',
    '--permission-mode',
    'acceptEdits',
    '--output-format',
    'stream-json',
  ];
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

export interface ClaudeCodeInvocationAuthProbeInput {
  command: string;
  model: string | null;
  cwd: string;
  workspaceCwd?: string | null;
  timeoutMs?: number;
}

export type ClaudeCodeInvocationAuthProbeResult =
  | {
      ok: true;
      detail: string;
      diagnostics: { runtimeLaunch: AgentRunRuntimeLaunchDiagnostics };
    }
  | {
      ok: false;
      code: string;
      detail: string;
      diagnostics: { runtimeLaunch: AgentRunRuntimeLaunchDiagnostics };
    };

export async function probeClaudeCodeInvocationAuth(
  input: ClaudeCodeInvocationAuthProbeInput,
): Promise<ClaudeCodeInvocationAuthProbeResult> {
  const args = [...buildClaudeCodeRunArgs(input.model), '--max-turns', '1'];
  const prompt = 'Reply with exactly: SD_AUTH_OK';
  const timeoutMs = input.timeoutMs ?? 15_000;
  const launchBase = {
    runtime: 'claude-code',
    command: input.command,
    args,
    cwd: input.cwd,
    workspaceCwd: input.workspaceCwd ?? null,
    probeCwd: input.cwd,
    model: input.model ?? null,
    version: null,
    authStatus: 'unknown' as const,
    env: claudeLaunchEnvironmentDiagnostics(),
  };

  return await new Promise<ClaudeCodeInvocationAuthProbeResult>((resolve) => {
    const child = spawn(input.command, args, {
      cwd: input.cwd,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...buildRuntimeChildEnv(process.env),
        SBER_DESIGNER_RUNTIME: 'claude-code',
      },
    });
    let settled = false;
    let stdoutTail = '';
    let stderrTail = '';
    const settle = (result: ClaudeCodeInvocationAuthProbeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      const diagnostic = classifyRuntimeFailure(
        'auth',
        `Claude Code auth probe timed out after ${Math.round(timeoutMs / 1000)}s.`,
      );
      settle({
        ok: false,
        code: diagnostic.code,
        detail: diagnostic.message,
        diagnostics: {
          runtimeLaunch: {
            ...launchBase,
            probe: {
              kind: 'print-mode-auth',
              ok: false,
              code: diagnostic.code,
              detail: diagnostic.message,
            },
          },
        },
      });
    }, timeoutMs);
    timeout.unref?.();

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdoutTail = `${stdoutTail}${chunk}`.slice(-2000);
    });
    child.stderr.on('data', (chunk: string) => {
      stderrTail = `${stderrTail}${chunk}`.slice(-2000);
    });
    child.on('error', (err) => {
      const diagnostic = classifyRuntimeFailure('auth', err.message);
      settle({
        ok: false,
        code: diagnostic.code,
        detail: diagnostic.message,
        diagnostics: {
          runtimeLaunch: {
            ...launchBase,
            probe: {
              kind: 'print-mode-auth',
              ok: false,
              code: diagnostic.code,
              detail: diagnostic.message,
              rawTail: compactRuntimeLog(redact(err.message)),
            },
          },
        },
      });
    });
    child.on('close', (code) => {
      const combined = compactRuntimeLog(redact(`${stdoutTail}\n${stderrTail}`));
      if (code === 0 && !/401|unauthorized|invalid authentication|credential/iu.test(combined)) {
        const detail = 'Claude Code CLI print-mode auth is ready.';
        settle({
          ok: true,
          detail,
          diagnostics: {
            runtimeLaunch: {
              ...launchBase,
              probe: {
                kind: 'print-mode-auth',
                ok: true,
                detail,
                ...(combined ? { rawTail: combined } : {}),
              },
            },
          },
        });
        return;
      }
      const detail = combined || `Claude Code auth probe exited with code ${code ?? 'unknown'}.`;
      const normalized = normalizeClaudeCodeAuthProbeFailure({
        detail,
        model: input.model ?? null,
      });
      settle({
        ok: false,
        code: normalized.code,
        detail: `${normalized.detail}${claudeAuthEnvironmentHint()}`,
        diagnostics: {
          runtimeLaunch: {
            ...launchBase,
            probe: {
              kind: 'print-mode-auth',
              ok: false,
              code: normalized.code,
              detail: normalized.detail,
              rawTail: normalized.rawTail,
            },
          },
        },
      });
    });
    child.stdin.end(prompt);
  });
}

export function normalizeClaudeCodeAuthProbeFailure(input: {
  detail: string;
  model: string | null | undefined;
}): { code: string; detail: string; rawTail: string } {
  const rawTail = compactRuntimeLog(redact(input.detail));
  const modelLabel = input.model?.trim() || 'default';
  if (/401|authentication_failed|invalid authentication|credential/iu.test(rawTail)) {
    return {
      code: 'auth_expired',
      detail: `Claude Code print-mode authentication failed for model "${modelLabel}" (401 authentication_failed). Re-authenticate or remove stale Anthropic env overrides from the backend process.`,
      rawTail,
    };
  }
  const diagnostic = classifyRuntimeFailure('auth', rawTail);
  return {
    code: diagnostic.code,
    detail: diagnostic.message,
    rawTail,
  };
}

export function classifyClaudeCodePermissionFailure(input: {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdoutTail: string;
  stderrTail: string;
  lastRuntimeFailureDetail?: string;
}): RuntimeDiagnostic | null {
  const rawTail = compactRuntimeLog(
    redact(
      [input.lastRuntimeFailureDetail, input.stdoutTail, input.stderrTail]
        .filter((item): item is string => Boolean(item?.trim()))
        .join('\n'),
    ),
  );
  if (!rawTail) return null;

  const lower = rawTail.toLowerCase();
  const mentionsPermission =
    /permission_required|permission required|requires permission|needs permission|approval required|requires approval|tool approval|permission to use/.test(
      lower,
    );
  if (!mentionsPermission) return null;

  const looksLikeToolApproval =
    /\b(bash|read|edit|write|multiedit|glob|grep|ls|tool|command|mcp)\b/iu.test(rawTail) ||
    input.code === 143 ||
    input.signal === 'SIGTERM';
  if (!looksLikeToolApproval) return null;

  const toolName = extractClaudePermissionToolName(rawTail);
  return {
    code: 'permission_required',
    severity: 'warning',
    message: [
      'permission_required: Claude Code stopped because a non-interactive tool approval was required.',
      toolName ? `Tool: ${toolName}.` : '',
      `Detail: ${rawTail}`,
      'Retry after granting/configuring non-interactive CLI permissions, or use a runtime that can auto-allow the requested read/edit command.',
    ]
      .filter(Boolean)
      .join(' '),
  };
}

function claudeAuthEnvironmentHint(): string {
  const envNames = claudeAuthEnvironmentNames();
  if (envNames.length === 0) return '';
  return ` Detected Claude auth environment override(s): ${envNames.join(
    ', ',
  )}. Claude Code non-interactive mode may prefer these over subscription login; clear stale Anthropic env credentials or reconnect Claude Code.`;
}

function claudeAuthEnvironmentNames(): string[] {
  return [
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_BASE_URL',
    'ANTHROPIC_AWS_API_KEY',
    'ANTHROPIC_FOUNDRY_API_KEY',
  ].filter((name) => Boolean(process.env[name]));
}

function claudeLaunchEnvironmentDiagnostics(): AgentRunRuntimeLaunchDiagnostics['env'] {
  const pathEntries = (process.env.PATH ?? '').split(':').filter(Boolean).length;
  return {
    home: process.env.HOME || null,
    pathEntries,
    authOverrideNames: claudeAuthEnvironmentNames(),
  };
}

export async function* runClaudeCodeHandoff(
  input: RunClaudeCodeHandoffInput,
): AsyncGenerator<AgentStreamEvent> {
  const iteration = 1;
  const args = buildClaudeCodeRunArgs(
    input.model,
    input.imagePaths ?? [],
    input.runtimeSession,
    input.runtimeConfigArgs ?? [],
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
  emitRuntimeEvent('claude.handoff.start', {
    command: input.command,
    args,
    cwd: input.cwd,
    model: input.model ?? 'default',
    imageCount: input.imagePaths?.length ?? 0,
    imageDeliveryMode: input.imagePaths?.length ? 'prompt_path' : 'none',
    promptBytes: Buffer.byteLength(input.prompt, 'utf8'),
  });
  const child = spawn(input.command, args, {
    cwd: input.cwd,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...buildRuntimeChildEnv(process.env, input.env),
      SBER_DESIGNER_RUNTIME: 'claude-code',
    },
  });
  const recorder = createRuntimeTraceRecorder({
    runtime: 'claude-code',
    command: input.command,
    args,
    cwd: input.cwd,
    prompt: input.prompt,
    protocol: 'stream-json',
  });

  const queue: AgentStreamEvent[] = [{ type: 'iteration-start', iteration }];
  const transcript: ChatMessage[] = [{ role: 'user', content: input.prompt }];
  let assistantText = '';
  let usage: RuntimeUsageSummary = {};
  let finished = false;
  let stderrTail = '';
  let stdoutTail = '';
  let stdoutBuffer = '';
  let lastRuntimeFailureDetail = '';
  let sawRuntimeErrorEvent = false;
  const mcpToolCalls = new Map<string, { serverName: string; toolName: string }>();
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
  const handleNormalizedEvent = (normalized: NormalizedRunEvent) => {
    if (normalized.type === 'tool_use') {
      const target = parseClaudeMcpToolName(normalized.name);
      if (target) mcpToolCalls.set(normalized.id, target);
    } else if (normalized.type === 'tool_result') {
      const target = mcpToolCalls.get(normalized.toolUseId);
      if (target) {
        mcpToolCalls.delete(normalized.toolUseId);
        if (!normalized.isError) {
          emitRuntimeEvent('runtime.mcp_tool_result', {
            ...target,
            toolCallId: normalized.toolUseId,
            success: true,
          });
        }
      }
    }
    if (normalized.type === 'usage') {
      usage = addRuntimeUsage(usage, normalized);
    }
    if (normalized.type === 'error') {
      sawRuntimeErrorEvent = true;
      lastRuntimeFailureDetail = normalized.message;
    } else if (normalized.type === 'tool_result' && normalized.isError) {
      lastRuntimeFailureDetail = normalized.content;
    }

    const event = encodeNormalizedEvent(normalized, iteration);
    if (!event) return;
    if (event.type === 'text-delta') assistantText += event.delta;
    push(event);
  };
  const finish = (code: number | null, signal: NodeJS.Signals | null) => {
    if (finished) return;
    finished = true;
    recorder?.finish(code, signal);
    if (timeout) clearTimeout(timeout);
    if (stdoutBuffer.trim()) {
      for (const normalized of parseClaudeLine(stdoutBuffer.trim(), {
        onRuntimeNoise: input.onRuntimeStdoutNoise,
      })) {
        handleNormalizedEvent(normalized);
      }
      stdoutBuffer = '';
    }
    const permissionFailure = classifyClaudeCodePermissionFailure({
      code,
      signal,
      stdoutTail,
      stderrTail,
      lastRuntimeFailureDetail,
    });
    const runtimeFailed =
      Boolean(code && code !== 0) ||
      Boolean(signal && signal !== 'SIGTERM') ||
      Boolean(permissionFailure && signal === 'SIGTERM');
    if (permissionFailure && runtimeFailed && !sawRuntimeErrorEvent) {
      push({ type: 'error', message: permissionFailure.message });
    } else if (code && code !== 0 && !sawRuntimeErrorEvent) {
      const detail = stderrTail.trim() || lastRuntimeFailureDetail.trim();
      push({
        type: 'error',
        message: `Claude Code exited with code ${code}${detail ? `: ${redact(detail)}` : ''}`,
      });
    } else if (signal && signal !== 'SIGTERM') {
      push({ type: 'error', message: `Claude Code exited after signal ${signal}` });
    }
    push({
      type: 'iteration-end',
      iteration,
      hadToolCalls: false,
      finishReason: code === 0 ? 'stop' : 'other',
    });
    const finalResponse: ChatResponse = {
      text: assistantText,
      provider: CLAUDE_CODE_RUNTIME_PROVIDER,
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
      hadErrors: runtimeFailed,
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
        message: `Claude Code run timed out after ${Math.round(timeoutMs / 1000)}s.`,
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
    stdoutTail = `${stdoutTail}${chunk}`.slice(-2000);
    stdoutBuffer += chunk;
    let newline;
    while ((newline = stdoutBuffer.indexOf('\n')) !== -1) {
      const line = stdoutBuffer.slice(0, newline).trim();
      stdoutBuffer = stdoutBuffer.slice(newline + 1);
      if (!line) continue;
      for (const normalized of parseClaudeLine(line, {
        onRuntimeNoise: input.onRuntimeStdoutNoise,
      })) {
        handleNormalizedEvent(normalized);
      }
    }
  });

  child.stderr.on('data', (chunk: string) => {
    recorder?.recordStderr(chunk);
    stderrTail = `${stderrTail}${chunk}`.slice(-2000);
    emitRuntimeEvent('claude.stderr', {
      chunk: compactRuntimeLog(redact(chunk)),
    });
  });

  child.on('error', (err) => {
    recorder?.recordStderr(err.message);
    emitRuntimeEvent('claude.spawn.error', {
      message: err.message,
    });
    push({ type: 'error', message: `Claude Code spawn failed: ${err.message}` });
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

function parseClaudeMcpToolName(name: string): { serverName: string; toolName: string } | null {
  const match = /^mcp__(.+?)__(.+)$/u.exec(name);
  if (!match?.[1] || !match[2]) return null;
  return { serverName: match[1], toolName: match[2] };
}

export function parseClaudeLine(
  line: string,
  options: RuntimeStdoutFallbackOptions = {},
): NormalizedRunEvent[] {
  try {
    const parsed = JSON.parse(line) as ClaudeCodeRawEvent;
    return mapClaudeCodeRawEvent(parsed);
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

function compactRuntimeLog(value: string): string {
  return value.replace(/\s+/gu, ' ').trim().slice(0, 500);
}

function extractClaudePermissionToolName(value: string): string | null {
  const match =
    value.match(/\b(?:use|run|call)\s+([A-Za-z][A-Za-z0-9_-]{1,40})\b/u) ??
    value.match(/\b([A-Za-z][A-Za-z0-9_-]{1,40})\s+(?:command|tool)\b/u);
  return match?.[1] ?? null;
}
