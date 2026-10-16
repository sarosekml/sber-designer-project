import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import type { AgentStreamEvent } from '../services/api/src/agent/stream';
import { createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { readAgentRunReceipts, readRunManifest } from '../services/api/src/agent/run-recorder';
import { snapshotRuntimeTargetFiles } from '../services/api/src/agent-runtimes/change-validation';
import { runCodexHandoff } from '../services/api/src/agent-runtimes/codex-runner';
import { streamExternalRuntimeHandoff } from '../services/api/src/routes/chat-stream/external';

const MOCK_CLI = join(import.meta.dir, 'mocks', 'runtime-mock.ts');

test('pipeline replay runs mock CLI through runner and external finalization without tokens', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-pipeline-'));
  const targetPath = 'src/screens/Admin.tsx';
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspace, targetPath),
    ['export function Admin() {', '  return <main>Empty</main>;', '}', ''].join('\n'),
    'utf8',
  );
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [targetPath]);
  const written: Array<{ data: string }> = [];

  await withMockTrace('codex/minimal-success', async () => {
    await streamExternalRuntimeHandoff({
      stream: {
        writeSSE(input) {
          written.push(input);
        },
      },
      runtimeLabel: 'Codex',
      workspacePath: workspace,
      agentRun: null,
      snapshots,
      canvasUrl: null,
      visualSnapshot: {
        status: 'unavailable',
        bytes: null,
        path: null,
        message: 'test',
      },
      events: runCodexHandoff({
        command: MOCK_CLI,
        model: 'default',
        cwd: workspace,
        prompt: 'Generate the active screen.',
      }),
    });
  });

  const events = written.map(
    (item) =>
      JSON.parse(item.data) as AgentStreamEvent & {
        runStatus?: string;
        runSummary?: string;
      },
  );
  const text = events.find((event) => event.type === 'text-delta');
  const finalDone = events.findLast((event) => event.type === 'done');

  expect(text).toMatchObject({ type: 'text-delta', delta: 'Done.' });
  expect(finalDone?.runStatus).toBe('failed');
  expect(finalDone?.runSummary).toContain('produced no changes in allowed target files');
});

test('pipeline finalization keeps Claude auth failure as the primary terminal cause', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-auth-lock-'));
  const targetPath = 'src/screens/Admin.tsx';
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspace, targetPath),
    ['export function Admin() {', '  return <main>Empty</main>;', '}', ''].join('\n'),
    'utf8',
  );
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [targetPath]);
  const written: Array<{ data: string }> = [];

  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE(input) {
        written.push(input);
      },
    },
    runtimeLabel: 'Claude Code CLI',
    workspacePath: workspace,
    agentRun: null,
    snapshots,
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    events: (async function* authFailure(): AsyncGenerator<AgentStreamEvent> {
      yield {
        type: 'error',
        message: 'Failed to authenticate. API Error: 401 Invalid authentication credentials',
      };
      yield {
        type: 'done',
        transcript: [
          {
            role: 'assistant',
            content: 'Failed to authenticate. API Error: 401 Invalid authentication credentials',
          },
        ],
        iterations: 1,
        truncated: false,
        hadErrors: true,
        stoppedAfterPermissionDeny: false,
        finalResponse: {
          text: 'Failed to authenticate. API Error: 401 Invalid authentication credentials',
          provider: 'claude-code-runtime',
          model: 'opus',
          finishReason: 'other',
        },
      };
    })(),
  });

  const events = written.map(
    (item) =>
      JSON.parse(item.data) as AgentStreamEvent & {
        runStatus?: string;
        runSummary?: string;
      },
  );
  const finalDone = events.findLast((event) => event.type === 'done');
  const allText = events
    .map((event) =>
      'delta' in event ? event.delta : 'runSummary' in event ? event.runSummary : '',
    )
    .join('\n');

  expect(finalDone?.runStatus).toBe('failed');
  expect(finalDone?.runSummary).toContain('Invalid authentication credentials');
  expect(allText).not.toContain('produced no changes in allowed target files');
});

test('pipeline finalization keeps Claude permission-required failure as the primary terminal cause', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-permission-lock-'));
  const targetPath = 'src/screens/Admin.tsx';
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspace, targetPath),
    ['export function Admin() {', '  return <main>Empty</main>;', '}', ''].join('\n'),
    'utf8',
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'claude-code-runtime',
    model: 'opus',
    workspacePath: workspace,
    userGoal: 'Replace Grid with Tile on the active screen.',
    activeScreen: {
      id: 'screen-admin',
      name: 'Admin',
      kind: 'story',
      implementationFilePath: targetPath,
    },
  });
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [targetPath]);
  const written: Array<{ data: string }> = [];
  const failure =
    'permission_required: Claude Code stopped because a non-interactive tool approval was required. Tool: Bash. Detail: rg -n "Grid" src/screens/Admin.tsx';

  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE(input) {
        written.push(input);
      },
    },
    runtimeLabel: 'Claude Code CLI',
    workspacePath: workspace,
    agentRun,
    snapshots,
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    events: (async function* permissionFailure(): AsyncGenerator<AgentStreamEvent> {
      yield { type: 'error', message: failure };
      yield {
        type: 'done',
        transcript: [{ role: 'assistant', content: failure }],
        iterations: 1,
        truncated: false,
        hadErrors: true,
        stoppedAfterPermissionDeny: false,
        finalResponse: {
          text: failure,
          provider: 'claude-code-runtime',
          model: 'opus',
          finishReason: 'other',
        },
      };
    })(),
  });

  const events = written.map(
    (item) =>
      JSON.parse(item.data) as AgentStreamEvent & {
        runStatus?: string;
        runSummary?: string;
      },
  );
  const finalDone = events.findLast((event) => event.type === 'done');
  const manifest = await readRunManifest(workspace, agentRun.runId);

  expect(finalDone?.runStatus).toBe('failed');
  expect(finalDone?.runSummary).toContain('permission_required');
  expect(finalDone?.runSummary).toContain('Bash');
  expect(manifest?.diagnostics?.errorCode).toBe('permission_required');
});

test('pipeline marks changed source as needs review when preview freshness is unverified', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-preview-unverified-'));
  const targetPath = 'src/screens/Admin.tsx';
  const storyPath = 'src/stories/screens/Admin.stories.tsx';
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await mkdir(join(workspace, 'src/stories/screens'), { recursive: true });
  await writeFile(
    join(workspace, targetPath),
    ['export function Admin() {', '  return <main>Empty</main>;', '}', ''].join('\n'),
    'utf8',
  );
  await writeFile(
    join(workspace, storyPath),
    [
      "import { Admin } from '../../screens/Admin';",
      "export default { title: 'screens/Admin', component: Admin };",
      'export const Default = {};',
      '',
    ].join('\n'),
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'codex-runtime',
    model: 'default',
    workspacePath: workspace,
    userGoal: 'Update the active screen.',
    activeScreen: {
      id: 'screen-admin',
      name: 'Admin',
      kind: 'story',
      filePath: storyPath,
      implementationFilePath: targetPath,
    },
  });
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [targetPath]);
  const written: Array<{ data: string }> = [];
  const previousFetch = globalThis.fetch;
  const previousChrome = process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL;
  delete process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL;
  globalThis.fetch = async () => new Response('preview warming up', { status: 503 });

  try {
    await streamExternalRuntimeHandoff({
      stream: {
        writeSSE(input) {
          written.push(input);
        },
      },
      runtimeLabel: 'Codex',
      workspacePath: workspace,
      agentRun,
      snapshots,
      canvasUrl: 'http://storybook.local/iframe.html?id=screens-admin--default',
      visualSnapshot: {
        status: 'unavailable',
        bytes: null,
        path: null,
        message: 'test',
      },
      events: (async function* changedSource(): AsyncGenerator<AgentStreamEvent> {
        await writeFile(
          join(workspace, targetPath),
          [
            'export function Admin() {',
            '  return <main data-sd-screen-root="true"><h1>Administration</h1></main>;',
            '}',
            '',
          ].join('\n'),
        );
        yield doneEvent('Implemented the screen.');
      })(),
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousChrome === undefined) delete process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL;
    else process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL = previousChrome;
  }

  const events = written.map(
    (item) =>
      JSON.parse(item.data) as AgentStreamEvent & {
        runStatus?: string;
        runSummary?: string;
      },
  );
  const finalDone = events.findLast((event) => event.type === 'done');

  expect(finalDone?.runStatus).toBe('needs_review');
  expect(finalDone?.runSummary).toContain('preview_stale_or_unverified');
});

test('pipeline repairs an active screen that loses the screen root marker', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-root-repair-'));
  const targetPath = 'src/screens/Admin.tsx';
  const storyPath = 'src/stories/screens/Admin.stories.tsx';
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await mkdir(join(workspace, 'src/stories/screens'), { recursive: true });
  await writeFile(
    join(workspace, targetPath),
    [
      'export function Admin() {',
      '  return <main data-sd-screen-root="true">Empty</main>;',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(workspace, storyPath),
    [
      "import { Admin } from '../../screens/Admin';",
      "export default { title: 'screens/Admin', component: Admin };",
      'export const Default = {};',
      '',
    ].join('\n'),
    'utf8',
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'codex-runtime',
    model: 'default',
    workspacePath: workspace,
    userGoal: 'Build the active screen from the markdown spec.',
    activeScreen: {
      id: 'screen-admin',
      name: 'Admin',
      kind: 'story',
      filePath: storyPath,
      implementationFilePath: targetPath,
    },
  });
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [targetPath]);
  const written: Array<{ data: string }> = [];

  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE(input) {
        written.push(input);
      },
    },
    runtimeLabel: 'Codex',
    workspacePath: workspace,
    agentRun,
    snapshots,
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    events: (async function* changedSource(): AsyncGenerator<AgentStreamEvent> {
      await writeFile(
        join(workspace, targetPath),
        [
          'export function Admin() {',
          '  return (',
          '    <Page>',
          '      <h1>Administration</h1>',
          '    </Page>',
          '  );',
          '}',
          '',
        ].join('\n'),
        'utf8',
      );
      yield doneEvent('Implemented the screen.');
    })(),
  });

  const events = written.map(
    (item) =>
      JSON.parse(item.data) as AgentStreamEvent & {
        runStatus?: string;
        runSummary?: string;
      },
  );
  const finalDone = events.findLast((event) => event.type === 'done');
  const source = await readFile(join(workspace, targetPath), 'utf8');
  const receipts = await readAgentRunReceipts(workspace, agentRun.runId);

  expect(finalDone?.runStatus).toBe('complete');
  expect(source).toContain('data-sd-screen-root="true"');
  expect(source).toContain('<Page>');
  expect(receipts).toContainEqual(
    expect.objectContaining({
      tool: 'screen_root_marker_repair',
      status: 'ok',
      changedFiles: [targetPath],
    }),
  );
});

test('pipeline keeps image-to-screen source writes reviewable when component role contract misses Tile', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-role-review-'));
  const targetPath = 'src/screens/Admin.tsx';
  const storyPath = 'src/stories/screens/Admin.stories.tsx';
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await mkdir(join(workspace, 'src/stories/screens'), { recursive: true });
  await writeFile(
    join(workspace, targetPath),
    ['export function Admin() {', '  return <main>Empty</main>;', '}', ''].join('\n'),
    'utf8',
  );
  await writeFile(
    join(workspace, storyPath),
    [
      "import { Admin } from '../../screens/Admin';",
      "export default { title: 'screens/Admin', component: Admin };",
      'export const Default = {};',
      '',
    ].join('\n'),
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'claude-code-runtime',
    model: 'opus',
    workspacePath: workspace,
    userGoal: 'Build this banking screen from the attached image.',
    activeScreen: {
      id: 'screen-admin',
      name: 'Admin',
      kind: 'story',
      filePath: storyPath,
      implementationFilePath: targetPath,
    },
  });
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [targetPath]);
  const written: Array<{ data: string }> = [];

  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE(input) {
        written.push(input);
      },
    },
    runtimeLabel: 'Claude Code CLI',
    workspacePath: workspace,
    agentRun,
    snapshots,
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    componentPack: {
      status: 'ready',
      source: 'design-index',
      stale: false,
      taskKind: 'image-to-screen',
      diagnostics: [],
      candidates: [
        {
          role: 'content-panel',
          componentId: 'components/molecules/Tile',
          title: 'Tile',
          shortName: 'Tile',
          confidence: 'high',
          recordConfidence: 'confirmed',
          score: 10,
          reason: 'Matched content panel.',
          guidance: ['Use Tile for content panels.'],
        },
      ],
    },
    events: (async function* changedSource(): AsyncGenerator<AgentStreamEvent> {
      await writeFile(
        join(workspace, targetPath),
        [
          "import { Card } from '@mui/material';",
          '',
          'export function Admin() {',
          '  return (',
          '    <main data-sd-screen-root="true">',
          '      <Card>Client data</Card>',
          '      <Card>Terms data</Card>',
          '    </main>',
          '  );',
          '}',
          '',
        ].join('\n'),
      );
      yield doneEvent('Implemented the image screen.');
    })(),
  });

  const events = written.map(
    (item) =>
      JSON.parse(item.data) as AgentStreamEvent & {
        runStatus?: string;
        runSummary?: string;
      },
  );
  const finalDone = events.findLast((event) => event.type === 'done');
  const allText = events.map((event) => ('delta' in event ? event.delta : '')).join('\n');

  expect(finalDone?.runStatus).toBe('needs_review');
  expect(finalDone?.runSummary).toContain('Component-pack role content-panel expected Tile');
  expect(allText).toContain('Component role contract verification needs review.');
});

test('pipeline records a context budget warning when external runtime usage crosses threshold', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-context-budget-'));
  const targetPath = 'src/screens/Admin.tsx';
  await mkdir(join(workspace, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspace, targetPath),
    ['export function Admin() {', '  return <main>Empty</main>;', '}', ''].join('\n'),
    'utf8',
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'codex-runtime',
    model: 'default',
    workspacePath: workspace,
    userGoal: 'Update the active screen.',
    activeScreen: {
      id: 'screen-admin',
      name: 'Admin',
      kind: 'story',
      implementationFilePath: targetPath,
    },
  });
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [targetPath]);
  const written: Array<{ data: string }> = [];

  await streamExternalRuntimeHandoff({
    stream: {
      writeSSE(input) {
        written.push(input);
      },
    },
    runtimeLabel: 'Codex',
    workspacePath: workspace,
    agentRun,
    snapshots,
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'test',
    },
    events: (async function* highUsageRun(): AsyncGenerator<AgentStreamEvent> {
      await writeFile(
        join(workspace, targetPath),
        [
          'export function Admin() {',
          '  return <main data-sd-screen-root="true"><h1>Administration</h1></main>;',
          '}',
          '',
        ].join('\n'),
      );
      yield {
        ...doneEvent('Implemented the screen.'),
        usage: {
          inputTokens: 260_000,
          outputTokens: 2_831,
        },
      };
    })(),
  });

  const events = written.map((item) => JSON.parse(item.data) as AgentStreamEvent);
  const allText = events.map((event) => ('delta' in event ? event.delta : '')).join('\n');
  const manifest = await readRunManifest(workspace, agentRun.runId);

  expect(allText).toContain('sber-designer: Context budget warning.');
  expect(allText).toContain('262,831 tokens');
  expect(manifest?.diagnostics?.contextBudget).toMatchObject({
    status: 'warning',
    thresholdTokens: 200_000,
    inputTokens: 260_000,
    outputTokens: 2_831,
    totalTokens: 262_831,
  });
});

async function withMockTrace<T>(traceId: string, fn: () => Promise<T>): Promise<T> {
  const previousPassthrough = process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH;
  process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH = 'SD_MOCK_TRACE,SD_MOCK_SPEED';
  const previousTrace = process.env.SD_MOCK_TRACE;
  const previousSpeed = process.env.SD_MOCK_SPEED;
  process.env.SD_MOCK_TRACE = traceId;
  process.env.SD_MOCK_SPEED = 'instant';
  try {
    return await fn();
  } finally {
    if (previousPassthrough === undefined) delete process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH;
    else process.env.SBER_DESIGNER_RUNTIME_ENV_PASSTHROUGH = previousPassthrough;
    restoreEnv('SD_MOCK_TRACE', previousTrace);
    restoreEnv('SD_MOCK_SPEED', previousSpeed);
  }
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

function doneEvent(text: string): Extract<AgentStreamEvent, { type: 'done' }> {
  return {
    type: 'done',
    transcript: [{ role: 'assistant', content: text }],
    iterations: 1,
    truncated: false,
    hadErrors: false,
    stoppedAfterPermissionDeny: false,
    finalResponse: {
      text,
      provider: 'codex-runtime',
      model: 'default',
      finishReason: 'stop',
    },
  };
}
