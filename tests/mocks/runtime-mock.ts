#!/usr/bin/env bun
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

import { loadRuntimeTraceFixture } from '../../services/api/src/agent-runtimes/replay-trace-contract';
import type { AgentRuntimeKind } from '../../services/api/src/agent-runtimes/types';

const DEFAULT_TRACE_ROOT = resolve(import.meta.dir, '..', 'fixtures', 'runtime-traces');

async function main() {
  await writePidFile();
  await drainStdin();

  const traceDir = resolveTraceDir();
  const fixture = loadRuntimeTraceFixture(traceDir);

  if (fixture.stderrPath) {
    process.stderr.write(readFileSync(fixture.stderrPath, 'utf8'));
  }

  await maybeHangBeforeStdout();
  await writeStdoutTrace(readFileSync(fixture.stdoutPath, 'utf8'), fixture.meta.durationMs ?? 0);
  process.exitCode = fixture.meta.exitCode;
}

function resolveTraceDir(): string {
  const trace = process.env.SD_MOCK_TRACE?.trim();
  if (!trace) {
    throw new Error('SD_MOCK_TRACE is required for runtime mock replay.');
  }

  const direct = isAbsolute(trace) ? trace : resolve(process.cwd(), trace);
  if (existsSync(join(direct, 'meta.json'))) {
    return direct;
  }

  const traceRoot = process.env.SD_MOCK_TRACE_ROOT
    ? resolve(process.cwd(), process.env.SD_MOCK_TRACE_ROOT)
    : DEFAULT_TRACE_ROOT;

  if (trace.includes('/')) {
    return join(traceRoot, trace);
  }

  const runtime = normalizeRuntime(
    process.env.SD_MOCK_RUNTIME ?? process.env.SBER_DESIGNER_RUNTIME,
  );
  return join(traceRoot, runtime, trace);
}

function normalizeRuntime(value: string | undefined): AgentRuntimeKind {
  switch (value) {
    case 'claude':
    case 'claude-code':
      return 'claude-code';
    case 'codex':
      return 'codex';
    case 'opencode':
      return 'opencode';
    case 'kimi':
      return 'kimi';
    case 'gigacode':
      return 'gigacode';
    default:
      throw new Error(
        'SD_MOCK_RUNTIME or SBER_DESIGNER_RUNTIME must be one of claude-code, codex, opencode, kimi, gigacode.',
      );
  }
}

async function drainStdin(): Promise<void> {
  process.stdin.resume();
  let input = '';
  for await (const chunk of process.stdin) {
    input += String(chunk);
  }
  const capturePath = process.env.SD_MOCK_STDIN_FILE?.trim();
  if (capturePath) await writeFile(capturePath, input, 'utf8');
}

async function writeStdoutTrace(stdout: string, durationMs: number): Promise<void> {
  const chunks = stdout.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const speed = process.env.SD_MOCK_SPEED ?? 'instant';
  const delayMs =
    speed === 'realtime' && chunks.length > 1 ? Math.floor(durationMs / chunks.length) : 0;

  for (const chunk of chunks) {
    process.stdout.write(chunk);
    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function writePidFile(): Promise<void> {
  const path = process.env.SD_MOCK_PID_FILE?.trim();
  if (!path) return;
  await writeFile(path, `${process.pid}\n`, 'utf8');
}

async function maybeHangBeforeStdout(): Promise<void> {
  const hangMs = Number(process.env.SD_MOCK_HANG_MS ?? 0);
  if (Number.isFinite(hangMs) && hangMs > 0) {
    await sleep(Math.floor(hangMs));
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
});
