import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  loadRuntimeTraceManifest,
  listRuntimeTraceFixtures,
  loadRuntimeTraceFixture,
  runtimeTraceStdoutFile,
} from '../services/api/src/agent-runtimes/replay-trace-contract';

async function writeTraceFixture(
  root: string,
  runtime: string,
  traceId: string,
  meta: Record<string, unknown>,
  stdout = '{"type":"assistant","message":{"content":[{"type":"text","text":"Done"}]}}\n',
) {
  const dir = join(root, runtime, traceId);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  await writeFile(join(dir, runtimeTraceStdoutFile(runtime)), stdout, 'utf8');
  return dir;
}

test('loads a valid runtime trace fixture', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-runtime-traces-'));
  const dir = await writeTraceFixture(root, 'claude-code', 'minimal-success', {
    version: 1,
    runtime: 'claude-code',
    command: 'claude',
    argsSnapshot: ['-p', '--output-format', 'stream-json'],
    exitCode: 0,
    durationMs: 25,
    notes: 'Minimal successful Claude Code stream-json response.',
  });
  await writeFile(join(dir, 'stderr.txt'), 'debug noise\n', 'utf8');

  const fixture = loadRuntimeTraceFixture(dir);

  expect(fixture.id).toBe('minimal-success');
  expect(fixture.runtime).toBe('claude-code');
  expect(fixture.meta).toMatchObject({
    version: 1,
    runtime: 'claude-code',
    exitCode: 0,
    durationMs: 25,
  });
  expect(fixture.stdoutPath.endsWith('/stdout.stream-jsonl')).toBe(true);
  expect(fixture.stderrPath?.endsWith('/stderr.txt')).toBe(true);
});

test('rejects fixtures whose meta runtime does not match the directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-runtime-traces-'));
  const dir = await writeTraceFixture(root, 'codex', 'wrong-runtime', {
    version: 1,
    runtime: 'opencode',
    command: 'codex',
    argsSnapshot: ['exec', '--json'],
    exitCode: 0,
  });

  expect(() => loadRuntimeTraceFixture(dir)).toThrow(/meta runtime .* does not match/i);
});

test('lists trace fixtures in deterministic runtime and trace order', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-runtime-traces-'));
  await writeTraceFixture(root, 'opencode', 'zeta', {
    version: 1,
    runtime: 'opencode',
    command: 'opencode',
    argsSnapshot: ['run', '--format', 'json'],
    exitCode: 0,
  });
  await writeTraceFixture(root, 'claude-code', 'alpha', {
    version: 1,
    runtime: 'claude-code',
    command: 'claude',
    argsSnapshot: ['-p', '--output-format', 'stream-json'],
    exitCode: 0,
  });
  await writeTraceFixture(root, 'codex', 'beta', {
    version: 1,
    runtime: 'codex',
    command: 'codex',
    argsSnapshot: ['exec', '--json'],
    exitCode: 0,
  });

  expect(
    listRuntimeTraceFixtures(root).map((fixture) => `${fixture.runtime}/${fixture.id}`),
  ).toEqual(['claude-code/alpha', 'codex/beta', 'opencode/zeta']);
});

test('repo runtime trace fixtures satisfy the D1.7 corpus contract', () => {
  const fixtures = listRuntimeTraceFixtures(join(import.meta.dir, 'fixtures', 'runtime-traces'));

  expect(fixtures.map((fixture) => `${fixture.runtime}/${fixture.id}`)).toEqual([
    'claude-code/auth-401-stream',
    'claude-code/minimal-success',
    'claude-code/permission-143',
    'codex/duplicate-final',
    'codex/mcp-auth-stderr-exit0',
    'codex/minimal-success',
    'codex/thread-started',
    'gigacode/failure-exit-zero',
    'gigacode/minimal-success',
    'gigacode/tool-call-keychain-noise',
    'opencode/minimal-success',
    'opencode/stdout-error-exit0',
  ]);
  expect(fixtures.every((fixture) => fixture.meta.version === 1)).toBe(true);
  expect(fixtures.filter((fixture) => fixture.meta.exitCode !== 0).length).toBe(2);
});

test('repo runtime trace manifest pins corpus metadata and stdout checksums', () => {
  const root = join(import.meta.dir, 'fixtures', 'runtime-traces');
  const manifest = loadRuntimeTraceManifest(root);

  expect(manifest.version).toBe(1);
  expect(manifest.traces.map((trace) => trace.traceId)).toEqual([
    'claude-code/auth-401-stream',
    'claude-code/minimal-success',
    'claude-code/permission-143',
    'codex/duplicate-final',
    'codex/mcp-auth-stderr-exit0',
    'codex/minimal-success',
    'codex/thread-started',
    'gigacode/failure-exit-zero',
    'gigacode/minimal-success',
    'gigacode/tool-call-keychain-noise',
    'opencode/minimal-success',
    'opencode/stdout-error-exit0',
  ]);
  expect(manifest.traces.map((trace) => trace.outcome)).toEqual([
    'error',
    'success',
    'error',
    'needs_review',
    'error',
    'success',
    'success',
    'error',
    'success',
    'success',
    'success',
    'error',
  ]);
  expect(manifest.traces.every((trace) => /^[a-f0-9]{64}$/u.test(trace.sha256))).toBe(true);
  expect(manifest.traces.every((trace) => trace.bytes > 0)).toBe(true);
});
