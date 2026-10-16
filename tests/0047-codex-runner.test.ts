import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  buildCodexRunArgs,
  parseCodexLine,
  runCodexHandoff,
  smokeCheckCodexRuntime,
} from '../services/api/src/agent-runtimes/codex-runner';

test('builds non-interactive Codex JSONL run args without dangerous sandbox bypass', () => {
  const args = buildCodexRunArgs('selected-model', '/work/demo-project');

  expect(args).toEqual([
    '--ask-for-approval',
    'never',
    '--cd',
    '/work/demo-project',
    '--sandbox',
    'workspace-write',
    'exec',
    '--json',
    '--model',
    'selected-model',
  ]);
  expect(args).not.toContain('--dangerously-bypass-approvals-and-sandbox');
});

test('omits Codex default pseudo-model flag', () => {
  expect(buildCodexRunArgs('default', '/work/demo-project')).toEqual([
    '--ask-for-approval',
    'never',
    '--cd',
    '/work/demo-project',
    '--sandbox',
    'workspace-write',
    'exec',
    '--json',
  ]);
});

test('omits model flag when no Codex model is selected', () => {
  expect(buildCodexRunArgs(null, '/work/demo-project')).toEqual([
    '--ask-for-approval',
    'never',
    '--cd',
    '/work/demo-project',
    '--sandbox',
    'workspace-write',
    'exec',
    '--json',
  ]);
});

test('passes attached image paths to Codex CLI image input flag', () => {
  expect(
    buildCodexRunArgs('selected-model', '/work/demo-project', [
      '.sber-designer/runs/run-1/attachments/01-reference.png',
      '.sber-designer/runs/run-1/attachments/02-mock.jpg',
    ]),
  ).toEqual([
    '--ask-for-approval',
    'never',
    '--cd',
    '/work/demo-project',
    '--sandbox',
    'workspace-write',
    'exec',
    '--json',
    '--model',
    'selected-model',
    '--image',
    '.sber-designer/runs/run-1/attachments/01-reference.png',
    '--image',
    '.sber-designer/runs/run-1/attachments/02-mock.jpg',
  ]);
});

test('adds Codex exec resume args after global workspace and sandbox flags', () => {
  expect(
    buildCodexRunArgs('gpt-5.5', '/work/demo-project', [], {
      mode: 'resume',
      sessionId: 'codex-session-123',
    }),
  ).toEqual([
    '--ask-for-approval',
    'never',
    '--cd',
    '/work/demo-project',
    '--sandbox',
    'workspace-write',
    'exec',
    'resume',
    'codex-session-123',
    '--json',
    '--model',
    'gpt-5.5',
  ]);
});

test('adds run-scoped MCP config before the Codex exec subcommand', () => {
  expect(
    buildCodexRunArgs('default', '/work/demo-project', [], null, [
      '-c',
      'mcp_servers.sber-designer.command="bun"',
    ]),
  ).toEqual([
    '--ask-for-approval',
    'never',
    '--cd',
    '/work/demo-project',
    '--sandbox',
    'workspace-write',
    '-c',
    'mcp_servers.sber-designer.command="bun"',
    'exec',
    '--json',
  ]);
});

test('reports resumed Codex cumulative usage as the current-run delta', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-codex-resume-usage-'));
  const fakeCodex = join(workspace, 'codex-resume-usage.js');
  await writeFile(
    fakeCodex,
    [
      '#!/usr/bin/env node',
      'process.stdout.write(JSON.stringify({ type: "turn.completed", usage: { input_tokens: 270, cached_input_tokens: 120, output_tokens: 45 } }) + "\\n");',
      '',
    ].join('\n'),
    'utf8',
  );
  await chmod(fakeCodex, 0o755);

  const events = [];
  const runtimeEvents: Array<{ event: string; data: Record<string, unknown> }> = [];
  for await (const event of runCodexHandoff({
    command: fakeCodex,
    model: 'gpt-5.5',
    cwd: workspace,
    prompt: 'Continue the active screen.',
    runtimeSession: {
      mode: 'resume',
      sessionId: 'codex-session-123',
      usageBaseline: { inputTokens: 120, outputTokens: 30, totalTokens: 150 },
    },
    onRuntimeEvent: (event, data) => runtimeEvents.push({ event, data }),
  })) {
    events.push(event);
  }

  expect(events.find((event) => event.type === 'usage')).toMatchObject({
    usage: { inputTokens: 30, outputTokens: 15 },
  });
  expect(events.find((event) => event.type === 'done')).toMatchObject({
    usage: { inputTokens: 30, outputTokens: 15 },
  });
  expect(runtimeEvents).toContainEqual({
    event: 'runtime.usage.cumulative',
    data: { runtime: 'codex', inputTokens: 150, outputTokens: 45 },
  });
});

test('filters Codex stdout fallback noise without dropping assistant text', () => {
  expect(parseCodexLine('Here is the result')).toEqual([
    { type: 'text_delta', delta: 'Here is the result\n' },
  ]);
  expect(parseCodexLine('WARNING: proceeding even though PATH could not be updated')).toEqual([]);
  expect(parseCodexLine('Loading project context')).toEqual([]);
});

test('reports Codex stdout fallback noise reasons for observability', () => {
  const reasons: string[] = [];
  expect(
    parseCodexLine('WARNING: proceeding even though PATH could not be updated', {
      onRuntimeNoise: (reason) => reasons.push(reason),
    }),
  ).toEqual([]);

  expect(reasons).toEqual(['log-prefix']);
});

test('classifies invalid Codex config exits and emits handoff diagnostics', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-codex-config-failure-'));
  const fakeCodex = join(workspace, 'codex-fails-config.js');
  await writeFile(
    fakeCodex,
    [
      '#!/usr/bin/env node',
      'process.stderr.write("Error loading config.toml: unknown variant `priority`, expected `fast` or `flex`\\nin `service_tier`\\n");',
      'process.exit(1);',
      '',
    ].join('\n'),
    'utf8',
  );
  await chmod(fakeCodex, 0o755);

  const diagnostics: { event: string; data: Record<string, unknown> }[] = [];
  const events = [];
  for await (const event of runCodexHandoff({
    command: fakeCodex,
    model: 'default',
    cwd: workspace,
    prompt: 'Generate the active screen.',
    onRuntimeEvent: (event, data) => diagnostics.push({ event, data }),
  })) {
    events.push(event);
  }

  const errorEvent = events.find((event) => event.type === 'error');
  expect(errorEvent?.message).toContain('Codex config invalid');
  expect(errorEvent?.message).toContain('service_tier');
  expect(diagnostics).toContainEqual(
    expect.objectContaining({
      event: 'codex.handoff.start',
      data: expect.objectContaining({
        command: fakeCodex,
        cwd: workspace,
        args: buildCodexRunArgs('default', workspace),
      }),
    }),
  );
  expect(diagnostics).toContainEqual(
    expect.objectContaining({
      event: 'codex.exit',
      data: expect.objectContaining({
        code: 1,
        classification: 'config_invalid',
        configKey: 'service_tier',
      }),
    }),
  );
});

test('smokeCheckCodexRuntime returns machine-readable invalid config errors', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-codex-smoke-config-failure-'));
  const fakeCodex = join(workspace, 'codex-fails-config.js');
  await writeFile(
    fakeCodex,
    [
      '#!/usr/bin/env node',
      'process.stderr.write("Error loading config.toml: unknown variant `priority`, expected `fast` or `flex`\\nin `service_tier`\\n");',
      'process.exit(1);',
      '',
    ].join('\n'),
    'utf8',
  );
  await chmod(fakeCodex, 0o755);

  const result = await smokeCheckCodexRuntime({
    command: fakeCodex,
    model: 'default',
    cwd: workspace,
    timeoutMs: 500,
  });

  expect(result).toMatchObject({
    ok: false,
    code: 'runtime_config_invalid',
    configKey: 'service_tier',
    configValue: 'priority',
  });
  expect(result.detail).toContain('Codex config invalid');
});

test('marks Codex timeout as an error in the final done event', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-codex-timeout-'));
  const fakeCodex = join(workspace, 'codex-hangs.js');
  await writeFile(
    fakeCodex,
    ['#!/usr/bin/env node', 'setTimeout(() => {}, 10_000);', ''].join('\n'),
    'utf8',
  );
  await chmod(fakeCodex, 0o755);

  const events = [];
  for await (const event of runCodexHandoff({
    command: fakeCodex,
    model: 'default',
    cwd: workspace,
    prompt: 'Generate the active screen.',
    timeoutMs: 25,
  })) {
    events.push(event);
  }

  expect(events.find((event) => event.type === 'error')?.message).toContain('timed out');
  const done = events.find((event) => event.type === 'done');
  expect(done?.hadErrors).toBe(true);
  expect(done?.finalResponse.finishReason).toBe('other');
});
