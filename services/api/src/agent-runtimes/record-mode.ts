import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { resolveInside } from '@sber-designer/ast-bridge';
import { RUNTIME_TRACE_CONTRACT_VERSION, runtimeTraceStdoutFile } from './replay-trace-contract';
import type { AgentRuntimeKind } from './types';

interface RuntimeTraceRecorderInput {
  runtime: AgentRuntimeKind;
  command: string;
  args: string[];
  cwd: string;
  prompt: string;
  protocol: string;
}

export interface RuntimeTraceRecorder {
  readonly traceDir: string;
  recordStdout(chunk: string): void;
  recordStderr(chunk: string): void;
  finish(code: number | null, signal: NodeJS.Signals | null): void;
  settled(): Promise<void>;
}

export function createRuntimeTraceRecorder(
  input: RuntimeTraceRecorderInput,
): RuntimeTraceRecorder | null {
  if (!runtimeRecordModeEnabled()) return null;
  const root = process.env.SBER_DESIGNER_RUNTIME_RECORD_DIR?.trim()
    ? process.env.SBER_DESIGNER_RUNTIME_RECORD_DIR.trim()
    : resolveInside(input.cwd, '.sber-designer/runtime-recordings');
  const traceId = `${new Date().toISOString().replace(/[:.]/gu, '-')}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const traceDir = join(root, input.runtime, traceId);
  const stdoutPath = join(traceDir, runtimeTraceStdoutFile(input.runtime));
  const stderrPath = join(traceDir, 'stderr.txt');
  const promptPath = join(traceDir, 'prompt.txt');
  const metaPath = join(traceDir, 'meta.json');
  const startedAt = Date.now();
  const pending: Promise<unknown>[] = [];
  let writeChain: Promise<unknown> = Promise.resolve();
  let finished = false;

  const enqueue = (work: () => Promise<unknown>) => {
    writeChain = writeChain.then(work, work);
    pending.push(writeChain.catch(() => undefined));
  };
  enqueue(async () => {
    await mkdir(traceDir, { recursive: true });
    await Promise.all([
      writeFile(stdoutPath, '', 'utf8'),
      writeFile(stderrPath, '', 'utf8'),
      writeFile(promptPath, redactRuntimeRecord(input.prompt), 'utf8'),
    ]);
    await writeMeta(255, null);
  });

  const writeMeta = async (exitCode: number, signal: NodeJS.Signals | null) => {
    const meta = {
      version: RUNTIME_TRACE_CONTRACT_VERSION,
      runtime: input.runtime,
      command: input.command,
      argsSnapshot: input.args,
      exitCode,
      durationMs: Math.max(0, Date.now() - startedAt),
      protocol: input.protocol,
      captured: 'recorded',
      anonymization: 'redacted',
      promptBytes: Buffer.byteLength(input.prompt, 'utf8'),
      ...(signal ? { signal } : {}),
      notes: 'Recorded by sber-designer runtime record-mode.',
    };
    await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  };

  return {
    traceDir,
    recordStdout(chunk) {
      enqueue(() => appendFile(stdoutPath, redactRuntimeRecord(chunk), 'utf8'));
    },
    recordStderr(chunk) {
      enqueue(() => appendFile(stderrPath, redactRuntimeRecord(chunk), 'utf8'));
    },
    finish(code, signal) {
      if (finished) return;
      finished = true;
      enqueue(() => writeMeta(normalizeExitCode(code, signal), signal));
    },
    async settled() {
      while (pending.length > 0) {
        const batch = pending.splice(0, pending.length);
        await Promise.allSettled(batch);
      }
    },
  };
}

function runtimeRecordModeEnabled(): boolean {
  const value = process.env.SBER_DESIGNER_RUNTIME_RECORD?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function normalizeExitCode(code: number | null, signal: NodeJS.Signals | null): number {
  if (typeof code === 'number' && Number.isInteger(code) && code >= 0 && code <= 255) return code;
  return signal ? 143 : 1;
}

function redactRuntimeRecord(value: string): string {
  return value
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/gu, '[redacted]')
    .replace(/\bsk-ant-[A-Za-z0-9_-]{16,}\b/gu, '[redacted]')
    .replace(/\b[A-Za-z0-9_-]{48,}\b/gu, '[redacted]');
}
