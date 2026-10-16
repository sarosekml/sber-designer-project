import { spawn } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { runtimeTraceStdoutFile } from '../services/api/src/agent-runtimes/replay-trace-contract';

const MOCK_CLI = join(import.meta.dir, 'mocks', 'runtime-mock.ts');
const CLAUDE_WRAPPER = join(import.meta.dir, 'mocks', 'bin', 'claude');

async function createTrace(root: string, runtime: string, traceId: string, exitCode = 0) {
  const dir = join(root, runtime, traceId);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, 'meta.json'),
    `${JSON.stringify(
      {
        version: 1,
        runtime,
        command: runtime === 'claude-code' ? 'claude' : runtime,
        argsSnapshot: [],
        exitCode,
        durationMs: 0,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(
    join(dir, runtimeTraceStdoutFile(runtime)),
    '{"type":"system","subtype":"init"}\n',
    'utf8',
  );
  await writeFile(join(dir, 'stderr.txt'), 'stderr from trace\n', 'utf8');
  return dir;
}

async function runMock(
  command: string,
  args: string[],
  env: Record<string, string>,
  stdin = 'prompt',
) {
  return await new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(command, args, {
        cwd: import.meta.dir,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...env },
      });
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
      });
      child.on('error', reject);
      child.on('close', (code) => resolve({ code, stdout, stderr }));
      child.stdin.end(stdin);
    },
  );
}

test('runtime mock replays trace stdout and stderr after draining stdin', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-runtime-mock-'));
  const traceDir = await createTrace(root, 'claude-code', 'minimal-success');

  const result = await runMock('bun', [MOCK_CLI], {
    SD_MOCK_TRACE: traceDir,
    SD_MOCK_SPEED: 'instant',
  });

  expect(result).toEqual({
    code: 0,
    stdout: await readFile(join(traceDir, 'stdout.stream-jsonl'), 'utf8'),
    stderr: 'stderr from trace\n',
  });
});

test('runtime mock can resolve a trace id through runtime and trace root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-runtime-mock-'));
  await createTrace(root, 'codex', 'minimal-success', 7);

  const result = await runMock('bun', [MOCK_CLI], {
    SBER_DESIGNER_RUNTIME: 'codex',
    SD_MOCK_TRACE_ROOT: root,
    SD_MOCK_TRACE: 'minimal-success',
  });

  expect(result.code).toBe(7);
  expect(result.stdout).toBe('{"type":"system","subtype":"init"}\n');
});

test('PATH overlay wrapper selects the matching runtime trace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-runtime-mock-'));
  const traceDir = await createTrace(root, 'claude-code', 'minimal-success');
  await chmod(CLAUDE_WRAPPER, 0o755);

  const result = await runMock(CLAUDE_WRAPPER, [], {
    SD_MOCK_TRACE_ROOT: root,
    SD_MOCK_TRACE: 'minimal-success',
  });

  expect(result.code).toBe(0);
  expect(result.stdout).toBe(await readFile(join(traceDir, 'stdout.stream-jsonl'), 'utf8'));
}, 10_000);
