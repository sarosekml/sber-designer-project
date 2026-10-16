import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import type { AgentStreamEvent } from '../../services/api/src/agent/stream';
import { createAgentRun } from '../../services/api/src/agent/run-record/manifest';
import { readAgentRunReceipts } from '../../services/api/src/agent/run-record/receipts';
import { snapshotRuntimeTargetFiles } from '../../services/api/src/agent-runtimes/change-validation';
import { streamExternalRuntimeHandoff } from '../../services/api/src/routes/chat-stream/index';
import { mockOpenCodeWritesScreen } from '../fixtures/external-runtime/mock-opencode-writes-screen';

test('ai-product-designer main flow writes, verifies, completes, and records metrics', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-e2e-product-designer-'));
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
    'utf8',
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'opencode-runtime',
    model: 'mock-opencode',
    runtimeKind: 'cli',
    projectName: 'Fixture project',
    workspacePath: workspace,
    userGoal: 'Generate the active administration screen.',
    activeScreen: {
      id: 'screen-admin',
      name: 'Admin',
      kind: 'story',
      storyId: 'screens-admin--default',
      filePath: storyPath,
      implementationFilePath: targetPath,
    },
  });
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [targetPath, storyPath]);
  const previousFetch = globalThis.fetch;
  const previousChrome = process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL;
  delete process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL;
  globalThis.fetch = async (input) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('/index.json')) {
      return new Response(
        JSON.stringify({
          entries: {
            'screens-admin--default': {
              id: 'screens-admin--default',
              type: 'story',
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response('<main data-sd-screen-root="true"><h1>Administration</h1></main>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });
  };
  const written: Array<{ data: string }> = [];

  try {
    await streamExternalRuntimeHandoff({
      stream: {
        writeSSE(input) {
          written.push(input);
        },
      },
      runtimeLabel: 'OpenCode',
      workspacePath: workspace,
      agentRun,
      snapshots,
      canvasUrl: 'http://storybook.local/iframe.html?id=screens-admin--default',
      visualSnapshot: {
        status: 'unavailable',
        bytes: null,
        path: null,
        message: 'Visual evidence capture disabled in test.',
      },
      events: mockOpenCodeWritesScreen({ workspacePath: workspace, targetPath }),
    });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousChrome === undefined) {
      delete process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL;
    } else {
      process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL = previousChrome;
    }
  }

  const events = written.map(
    (item) =>
      JSON.parse(item.data) as AgentStreamEvent & {
        runStatus?: string;
        runSummary?: string;
      },
  );
  const serialized = written.map((item) => item.data).join('\n');
  const finalDone = events.findLast((event) => event.type === 'done');
  const manifest = JSON.parse(
    await readFile(
      join(workspace, '.sber-designer/runs', agentRun.runId, 'run-manifest.json'),
      'utf8',
    ),
  ) as {
    status: string;
    metrics?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  };
  const receipts = await readAgentRunReceipts(workspace, agentRun.runId);

  expect(serialized).not.toContain('Agent run needs review');
  expect(serialized).not.toContain('apiKey');
  expect(serialized).not.toContain('OPENROUTER');
  expect(finalDone?.runStatus).toBe('complete');
  expect(finalDone?.runSummary).toContain('changed 1 allowed target file');
  expect(manifest.status).toBe('complete');
  expect(manifest.metrics).toMatchObject({
    inputTokens: 700,
    outputTokens: 106,
    totalTokens: 806,
  });
  expect(receipts).toContainEqual(
    expect.objectContaining({
      tool: 'runtime_render_health',
      status: 'ok',
    }),
  );
  expect(await readFile(join(workspace, targetPath), 'utf8')).toContain('data-sd-screen-root');
});
