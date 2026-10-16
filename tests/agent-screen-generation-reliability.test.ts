import { expect, test } from 'bun:test';

import { ApiError } from '../apps/web/src/lib/api/http';
import { streamChat } from '../apps/web/src/lib/api/chat';
import { formatChatSendError } from '../apps/web/src/lib/chat-transcript';
import { createAgentRun } from '../services/api/src/agent/run-record/manifest';
import {
  readAgentRunReceipts,
  recordToolReceiptSafely,
} from '../services/api/src/agent/run-record/receipts';
import {
  finalizeBuiltInRunDone,
  resolveBuiltInRunCompletion,
} from '../services/api/src/routes/chat-stream/built-in';
import { finalizeExternalRuntimeDone } from '../services/api/src/routes/chat-stream/external-finalization';
import { recordRuntimeRenderHealthSafely } from '../services/api/src/routes/chat-stream/render-health';
import { ensureFinalScreenQualityEvidence } from '../services/api/src/routes/chat-stream/quality-evidence';

test('built-in run fails when tool loop truncates with errors', () => {
  const result = resolveBuiltInRunCompletion({
    iterations: 20,
    truncated: true,
    hadErrors: true,
    stoppedAfterPermissionDeny: false,
    finalResponse: { finishReason: 'tool_calls' },
  });

  expect(result.status).toBe('failed');
  expect(result.summary).toContain('truncated');
  expect(result.diagnostics.truncated).toBe(true);
  expect(result.diagnostics.hadErrors).toBe(true);
  expect(result.diagnostics.finishReason).toBe('tool_calls');
});

test('chat send error includes debug log and run manifest metadata', () => {
  const message = formatChatSendError(
    new ApiError('Connect Codex CLI before using this model.', 409, 'runtime_not_connected', {
      attemptId: 'attempt-abc',
      debugLogPath: '/tmp/sber-designer/agent-runs/attempt-abc.jsonl',
      runManifestPath: '.sber-designer/runs/run-abc/run-manifest.json',
    }),
  );

  expect(message).toContain('runtime_not_connected');
  expect(message).toContain('/tmp/sber-designer/agent-runs/attempt-abc.jsonl');
  expect(message).toContain('.sber-designer/runs/run-abc/run-manifest.json');
});

test('built-in run fails when a permission request is denied', () => {
  const result = resolveBuiltInRunCompletion({
    iterations: 4,
    truncated: false,
    hadErrors: true,
    stoppedAfterPermissionDeny: true,
    finalResponse: { finishReason: 'tool_calls' },
  });

  expect(result.status).toBe('failed');
  expect(result.summary).toContain('permission request was denied');
  expect(result.diagnostics.stoppedAfterPermissionDeny).toBe(true);
});

test('built-in run completes only when loop ends cleanly', () => {
  const result = resolveBuiltInRunCompletion({
    iterations: 2,
    truncated: false,
    hadErrors: false,
    stoppedAfterPermissionDeny: false,
    finalResponse: { finishReason: 'stop' },
  });

  expect(result.status).toBe('complete');
  expect(result.diagnostics.truncated).toBe(false);
  expect(result.diagnostics.hadErrors).toBe(false);
});

test('built-in done finalization treats an aborted run as cancelled before gates', async () => {
  const finalized = await finalizeBuiltInRunDone({
    event: {
      type: 'done',
      transcript: [],
      iterations: 3,
      truncated: false,
      hadErrors: true,
      stoppedAfterPermissionDeny: false,
      finalResponse: {
        text: 'Tool loop reported an error after stop.',
        provider: 'mock',
        model: 'mock',
        finishReason: 'tool_calls',
      },
    },
    workspacePath: null,
    agentRun: null,
    canvasUrl: null,
    runAborted: true,
  });

  expect(finalized.status).toBe('cancelled');
  expect(finalized.summary).toBe('Cancelled by user.');
  expect(finalized.diagnostics.finishReason).toBe('cancelled');
  expect(finalized.event.finalResponse.text).toBe('Cancelled by user.');
});

test('HTML profile final quality records craft without component-tree compatibility pressure', async () => {
  const { mkdir, mkdtemp, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-html-quality-evidence-'));
  const screenPath = 'pages/dashboard.html';
  await mkdir(join(workspacePath, 'pages'), { recursive: true });
  await writeFile(
    join(workspacePath, screenPath),
    '<!doctype html><body data-sd-screen-root><main>Dashboard</main></body>',
    'utf8',
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'echo',
    workspacePath,
    activeScreen: {
      id: 'screen-dashboard',
      name: 'Dashboard',
      kind: 'page',
      filePath: screenPath,
      implementationFilePath: screenPath,
    },
  });
  agentRun.projectProfile = {
    kind: 'html-css',
    screenUnit: {
      sourceGlob: '**/*.html',
      storyRequired: false,
      rootMarker: 'data-sd-screen-root',
    },
    componentModel: 'css-catalog',
    renderProbe: 'static-html',
  };

  const evidence = await ensureFinalScreenQualityEvidence({ workspacePath, agentRun });
  const receipts = await readAgentRunReceipts(workspacePath, agentRun.runId);

  expect(evidence.craft).not.toBeNull();
  expect(evidence.designMode).toBeNull();
  expect(receipts.some((receipt) => receipt.tool === 'validate_screen_craft')).toBe(true);
  expect(receipts.some((receipt) => receipt.tool === 'validate_design_screen')).toBe(false);
});

test('external failed finalization replaces optimistic terminal claims with machine evidence', async () => {
  const modelSummary =
    'Updated src/screens/Payments.tsx. The screen renders on the canvas. All checks passed.';
  const finalized = await finalizeExternalRuntimeDone({
    event: {
      type: 'done',
      transcript: [{ role: 'assistant', content: modelSummary }],
      iterations: 2,
      truncated: false,
      hadErrors: true,
      stoppedAfterPermissionDeny: false,
      finalResponse: {
        text: modelSummary,
        provider: 'codex-runtime',
        model: 'default',
        finishReason: 'other',
      },
    },
    runtimeLabel: 'Codex CLI',
    workspacePath: null,
    agentRun: null,
    snapshots: [],
    canvasUrl: null,
    visualSnapshot: {
      status: 'unavailable',
      bytes: null,
      path: null,
      message: 'No canvas URL was available.',
    },
    sawError: true,
  });

  const finalText = finalized.event.finalResponse.text;
  expect(finalized.status).toBe('failed');
  expect(finalText).toContain('Updated src/screens/Payments.tsx.');
  expect(finalText).not.toContain('renders on the canvas');
  expect(finalText).not.toContain('All checks passed');
  expect(finalText.match(/Run status: FAILED/gu)).toHaveLength(1);
  expect(finalized.event.transcript.at(-1)?.content).toBe(finalText);
});

test('streamChat preserves preflight attempt metadata from JSON errors', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: 'runtime_not_connected',
        detail: 'Connect Codex CLI in Settings -> LLM providers before using this model.',
        attemptId: 'attempt-abc',
        debugLogPath: '/tmp/sber-designer/agent-runs/attempt-abc.jsonl',
        runManifestPath: '.sber-designer/runs/run-abc/run-manifest.json',
      }),
      {
        status: 409,
        headers: { 'content-type': 'application/json' },
      },
    );

  try {
    const iterator = streamChat({ messages: [{ role: 'user', content: 'Generate screen' }] });
    await expect(iterator.next()).rejects.toMatchObject({
      status: 409,
      code: 'runtime_not_connected',
      attemptId: 'attempt-abc',
      debugLogPath: '/tmp/sber-designer/agent-runs/attempt-abc.jsonl',
      runManifestPath: '.sber-designer/runs/run-abc/run-manifest.json',
    } satisfies Partial<ApiError>);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('records skipped render health when active screen render probe is unavailable', async () => {
  const { mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-render-health-'));
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'echo',
    workspacePath,
    activeScreen: {
      id: 'screen-risk',
      name: 'Risk-metrics',
      kind: 'story',
      storyId: 'screens-dev-test-risk-metrics--default',
      filePath: 'src/stories/screens/Dev-test/RiskMetrics.stories.tsx',
      implementationFilePath: 'src/screens/Dev-test/RiskMetrics.tsx',
    },
  });

  const health = await recordRuntimeRenderHealthSafely({
    workspacePath,
    agentRun,
    canvasUrl: null,
    changedFiles: ['src/screens/Dev-test/RiskMetrics.tsx'],
  });

  const receipts = await readAgentRunReceipts(workspacePath, agentRun.runId);
  expect(health.status).toBe('unavailable');
  expect(receipts).toContainEqual(
    expect.objectContaining({
      tool: 'runtime_render_health',
      status: 'skipped',
      changedFiles: ['src/screens/Dev-test/RiskMetrics.tsx'],
    }),
  );
});

test('render health does not fail a run when a new Storybook story is not indexed yet', async () => {
  const { mkdir, mkdtemp, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-render-health-'));
  await mkdir(join(workspacePath, 'src/stories/screens/2026-06-04'), { recursive: true });
  await writeFile(
    join(workspacePath, 'src/stories/screens/2026-06-04/DCMDeal.stories.tsx'),
    [
      "import { DCMDeal } from '../../../../screens/2026-06-04/DCMDeal';",
      '',
      "export default { title: 'Screens/2026-06-04/DCM Deal', component: DCMDeal };",
      'export const Default = {};',
      '',
    ].join('\n'),
    'utf8',
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'echo',
    workspacePath,
    activeScreen: {
      id: 'screen-dcm-deal',
      name: 'DCM Deal',
      kind: 'story',
      storyId: 'screens-2026-06-04-dcm-deal--default',
      filePath: 'src/stories/screens/2026-06-04/DCMDeal.stories.tsx',
      implementationFilePath: 'src/screens/2026-06-04/DCMDeal.tsx',
    },
  });

  const health = await recordRuntimeRenderHealthSafely({
    workspacePath,
    agentRun,
    canvasUrl:
      'http://localhost:3000/api/preview/iframe.html?id=screens-2026-06-04-dcm-deal--default',
    changedFiles: ['src/screens/2026-06-04/DCMDeal.tsx'],
    readinessDelaysMs: [0],
    fetchImpl: async () => new Response('{}', { status: 404 }),
  });

  const receipts = await readAgentRunReceipts(workspacePath, agentRun.runId);
  const reason = health.reason;
  expect(health).toMatchObject({
    status: 'unavailable',
    weakEvidence: true,
    reason: expect.stringContaining('Source saved, preview server unavailable'),
  });
  expect(reason).toContain('story file is consistent on disk');
  expect(reason).toContain('Storybook index returned HTTP 404');
  expect(receipts).toContainEqual(
    expect.objectContaining({
      tool: 'runtime_render_health',
      status: 'skipped',
      changedFiles: ['src/screens/2026-06-04/DCMDeal.tsx'],
    }),
  );
});

test('truncated built-in run with active-screen writes records render health and needs review', async () => {
  const { mkdir, mkdtemp, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-partial-write-'));
  await mkdir(join(workspacePath, 'src/stories/screens/2026-06-06'), { recursive: true });
  await mkdir(join(workspacePath, 'src/screens/2026-06-06'), { recursive: true });
  await writeFile(
    join(workspacePath, 'src/stories/screens/2026-06-06/NewScreen01.stories.tsx'),
    [
      "import type { Meta, StoryObj } from '@storybook/react-vite';",
      "import { NewScreen01 } from '../../../screens/2026-06-06/NewScreen01';",
      "const meta = { title: 'Screens/2026-06-06/New screen 01', component: NewScreen01 } satisfies Meta<typeof NewScreen01>;",
      'export default meta;',
      'type Story = StoryObj<typeof meta>;',
      'export const Default: Story = {};',
      '',
    ].join('\n'),
  );
  await writeFile(
    join(workspacePath, 'src/screens/2026-06-06/NewScreen01.tsx'),
    [
      'export function NewScreen01() {',
      '  return <main data-sd-screen-root="true">New screen</main>;',
      '}',
      '',
    ].join('\n'),
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'echo',
    workspacePath,
    activeScreen: {
      id: 'screen-new',
      name: 'New screen 01',
      kind: 'story',
      storyId: 'screens-2026-06-06-new-screen-01--default',
      filePath: 'src/stories/screens/2026-06-06/NewScreen01.stories.tsx',
      implementationFilePath: 'src/screens/2026-06-06/NewScreen01.tsx',
    },
  });
  await recordToolReceiptSafely({
    workspacePath,
    runId: agentRun.runId,
    tool: 'write_file',
    status: 'ok',
    changedFiles: ['src/screens/2026-06-06/NewScreen01.tsx'],
    summary: 'Updated src/screens/2026-06-06/NewScreen01.tsx.',
  });

  const finalized = await finalizeBuiltInRunDone({
    workspacePath,
    agentRun,
    canvasUrl: null,
    event: {
      type: 'done',
      transcript: [],
      iterations: 20,
      truncated: true,
      hadErrors: true,
      stoppedAfterPermissionDeny: false,
      finalResponse: {
        text: '',
        provider: 'mock',
        model: 'echo',
        finishReason: 'tool_calls',
      },
    },
  });

  const receipts = await readAgentRunReceipts(workspacePath, agentRun.runId);
  expect(finalized.status).toBe('needs_review');
  expect(finalized.summary).toContain('No canvas URL');
  expect(receipts).toContainEqual(
    expect.objectContaining({
      tool: 'runtime_render_health',
      status: 'skipped',
      changedFiles: ['src/screens/2026-06-06/NewScreen01.tsx'],
    }),
  );
});

test('built-in screen generation rejects validation-only evidence without starting craft repair', async () => {
  const { mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-craft-blocked-'));
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'echo',
    workspacePath,
    activeScreen: {
      id: 'screen-new',
      name: 'New screen 01',
      kind: 'story',
      storyId: 'screens-2026-06-06-new-screen-01--default',
      filePath: 'src/stories/screens/2026-06-06/NewScreen01.stories.tsx',
      implementationFilePath: 'src/screens/2026-06-06/NewScreen01.tsx',
    },
  });
  await recordToolReceiptSafely({
    workspacePath,
    runId: agentRun.runId,
    tool: 'validate_screen_craft',
    status: 'ok',
    changedFiles: ['src/screens/2026-06-06/NewScreen01.tsx'],
    summary: 'screen.craft status=blocked target=src/screens/2026-06-06/NewScreen01.tsx findings=2',
    metadata: {
      status: 'blocked',
      findings: {
        blocking: 2,
        shouldFix: 0,
        advisory: 0,
      },
    },
  });

  const finalized = await finalizeBuiltInRunDone({
    workspacePath,
    agentRun,
    canvasUrl: null,
    componentPack: {
      status: 'weak',
      source: 'design-index',
      stale: false,
      taskKind: 'image-to-screen',
      candidates: [],
      diagnostics: [],
    },
    event: {
      type: 'done',
      transcript: [{ role: 'assistant', content: 'Screen written.' }],
      iterations: 3,
      truncated: false,
      hadErrors: false,
      stoppedAfterPermissionDeny: false,
      finalResponse: {
        text: 'Screen written.',
        provider: 'mock',
        model: 'echo',
        finishReason: 'stop',
      },
    },
  });

  const receipts = await readAgentRunReceipts(workspacePath, agentRun.runId);
  expect(finalized.status).toBe('failed');
  expect(finalized.summary).toContain('without writing the active screen');
  expect(finalized.event.finalResponse.finishReason).toBe('other');
  expect(finalized.event.finalResponse.text).toContain('Active screen was not written');
  expect(receipts.some((receipt) => receipt.tool === 'automatic_craft_repair')).toBe(false);
});

test('built-in run completes after a recovered tool error when deterministic checks pass', async () => {
  const { mkdir, mkdtemp, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-recovered-tool-error-'));
  const screenPath = 'src/screens/Page.tsx';
  await mkdir(join(workspacePath, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspacePath, screenPath),
    [
      'export function Page() {',
      '  return <main data-sd-screen-root="true">Recovered screen</main>;',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'echo',
    workspacePath,
    activeScreen: {
      id: 'screen-page',
      name: 'Page',
      kind: 'page',
      filePath: screenPath,
      implementationFilePath: screenPath,
    },
  });
  await recordToolReceiptSafely({
    workspacePath,
    runId: agentRun.runId,
    tool: 'write_file',
    status: 'ok',
    changedFiles: [screenPath],
    summary: `Updated ${screenPath}.`,
  });

  const finalized = await finalizeBuiltInRunDone({
    workspacePath,
    agentRun,
    canvasUrl: 'http://localhost:3000/page.html',
    fetchImpl: async () =>
      new Response('<main data-sd-screen-root="true">Recovered screen</main>', {
        status: 200,
      }),
    event: {
      type: 'done',
      transcript: [{ role: 'assistant', content: 'Screen saved after retry.' }],
      iterations: 5,
      truncated: false,
      hadErrors: true,
      stoppedAfterPermissionDeny: false,
      finalResponse: {
        text: 'Screen saved after retry.',
        provider: 'mock',
        model: 'echo',
        finishReason: 'stop',
      },
    },
  });

  expect(finalized.status).toBe('complete');
  expect(finalized.summary).toContain('after recovered tool errors');
  expect(finalized.diagnostics.hadErrors).toBe(true);
});

test('complete built-in run with root-missing HTTP Storybook evidence needs browser proof', async () => {
  const { mkdir, mkdtemp, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-weak-render-'));
  await mkdir(join(workspacePath, 'src/stories/screens/2026-06-06'), { recursive: true });
  await mkdir(join(workspacePath, 'src/screens/2026-06-06'), { recursive: true });
  await writeFile(
    join(workspacePath, 'src/stories/screens/2026-06-06/NewScreen01.stories.tsx'),
    [
      "import type { Meta, StoryObj } from '@storybook/react-vite';",
      "import { NewScreen01 } from '../../../screens/2026-06-06/NewScreen01';",
      "const meta = { title: 'Screens/2026-06-06/New screen 01', component: NewScreen01 } satisfies Meta<typeof NewScreen01>;",
      'export default meta;',
      'type Story = StoryObj<typeof meta>;',
      'export const Default: Story = {};',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(workspacePath, 'src/screens/2026-06-06/NewScreen01.tsx'),
    [
      'export function NewScreen01() {',
      '  return <main data-sd-screen-root="true">New screen</main>;',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'echo',
    workspacePath,
    activeScreen: {
      id: 'screen-new',
      name: 'New screen 01',
      kind: 'story',
      storyId: 'screens-2026-06-06-new-screen-01--default',
      filePath: 'src/stories/screens/2026-06-06/NewScreen01.stories.tsx',
      implementationFilePath: 'src/screens/2026-06-06/NewScreen01.tsx',
    },
  });
  await recordToolReceiptSafely({
    workspacePath,
    runId: agentRun.runId,
    tool: 'write_file',
    status: 'ok',
    changedFiles: ['src/screens/2026-06-06/NewScreen01.tsx'],
    summary: 'Updated src/screens/2026-06-06/NewScreen01.tsx.',
  });

  const finalized = await finalizeBuiltInRunDone({
    workspacePath,
    agentRun,
    canvasUrl:
      'http://localhost:3000/api/preview/iframe.html?id=screens-2026-06-06-new-screen-01--default',
    fetchImpl: async (url: URL | RequestInfo) => {
      const text = String(url).includes('/index.json')
        ? JSON.stringify({
            entries: {
              'screens-2026-06-06-new-screen-01--default': {
                id: 'screens-2026-06-06-new-screen-01--default',
                type: 'story',
              },
            },
          })
        : '<div>Storybook shell without executed preview JavaScript</div>';
      return new Response(text, { status: 200 });
    },
    event: {
      type: 'done',
      transcript: [
        {
          role: 'assistant',
          content:
            'Updated src/screens/2026-06-06/NewScreen01.tsx. Screen rendered. All checks passed.',
        },
      ],
      iterations: 3,
      truncated: false,
      hadErrors: false,
      stoppedAfterPermissionDeny: false,
      finalResponse: {
        text: 'Updated src/screens/2026-06-06/NewScreen01.tsx. Screen rendered. All checks passed.',
        provider: 'mock',
        model: 'echo',
        finishReason: 'stop',
      },
    },
  });

  expect(finalized.status).toBe('needs_review');
  expect(finalized.summary).toContain('Runtime screen root was not proven');
  expect(finalized.event.finalResponse.text).toContain(
    'Screen saved — browser verification pending',
  );
  expect(finalized.event.transcript.at(-1)?.content).toContain(
    'Screen saved — browser verification pending',
  );
  // R7 (0083): an authoritative status banner must supersede any optimistic
  // render prose the agent wrote before render health ran.
  expect(finalized.event.finalResponse.text).toContain('Run status: NEEDS REVIEW');
  expect(finalized.event.finalResponse.text).toContain(
    'Updated src/screens/2026-06-06/NewScreen01.tsx.',
  );
  expect(finalized.event.finalResponse.text).not.toContain('Screen rendered');
  expect(finalized.event.finalResponse.text).not.toContain('All checks passed');
  expect(finalized.event.finalResponse.text.match(/Run status: NEEDS REVIEW/gu)).toHaveLength(1);
  expect(finalized.event.transcript.at(-1)?.content).toBe(finalized.event.finalResponse.text);
});

test('complete built-in run repairs an active screen source that loses the root marker', async () => {
  const { mkdir, mkdtemp, readFile, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-built-in-root-repair-'));
  const storyPath = 'src/stories/screens/2026-06-06/NewScreen01.stories.tsx';
  const screenPath = 'src/screens/2026-06-06/NewScreen01.tsx';
  await mkdir(join(workspacePath, 'src/stories/screens/2026-06-06'), { recursive: true });
  await mkdir(join(workspacePath, 'src/screens/2026-06-06'), { recursive: true });
  await writeFile(
    join(workspacePath, storyPath),
    [
      "import type { Meta, StoryObj } from '@storybook/react-vite';",
      "import { NewScreen01 } from '../../../screens/2026-06-06/NewScreen01';",
      "const meta = { title: 'Screens/2026-06-06/New screen 01', component: NewScreen01 } satisfies Meta<typeof NewScreen01>;",
      'export default meta;',
      'type Story = StoryObj<typeof meta>;',
      'export const Default: Story = {};',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(workspacePath, screenPath),
    [
      'export function NewScreen01() {',
      '  return (',
      '    <section>',
      '      <h1>New screen</h1>',
      '    </section>',
      '  );',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'echo',
    workspacePath,
    activeScreen: {
      id: 'screen-new',
      name: 'New screen 01',
      kind: 'story',
      storyId: 'screens-2026-06-06-new-screen-01--default',
      filePath: storyPath,
      implementationFilePath: screenPath,
    },
  });
  await recordToolReceiptSafely({
    workspacePath,
    runId: agentRun.runId,
    tool: 'write_file',
    status: 'ok',
    changedFiles: [screenPath],
    summary: `Updated ${screenPath}.`,
  });

  const finalized = await finalizeBuiltInRunDone({
    workspacePath,
    agentRun,
    canvasUrl:
      'http://localhost:3000/api/preview/iframe.html?id=screens-2026-06-06-new-screen-01--default',
    fetchImpl: async (url: URL | RequestInfo) => {
      const text = String(url).includes('/index.json')
        ? JSON.stringify({
            entries: {
              'screens-2026-06-06-new-screen-01--default': {
                id: 'screens-2026-06-06-new-screen-01--default',
                type: 'story',
              },
            },
          })
        : '<div>Storybook shell without executed preview JavaScript</div>';
      return new Response(text, { status: 200 });
    },
    event: {
      type: 'done',
      transcript: [{ role: 'assistant', content: 'Screen rendered.' }],
      iterations: 3,
      truncated: false,
      hadErrors: false,
      stoppedAfterPermissionDeny: false,
      finalResponse: {
        text: 'Screen rendered.',
        provider: 'mock',
        model: 'echo',
        finishReason: 'stop',
      },
    },
  });

  const source = await readFile(join(workspacePath, screenPath), 'utf8');
  const receipts = await readAgentRunReceipts(workspacePath, agentRun.runId);
  expect(source).toContain('data-sd-screen-root="true"');
  expect(finalized.status).toBe('needs_review');
  expect(finalized.summary).toContain('Runtime screen root was not proven');
  expect(receipts).toContainEqual(
    expect.objectContaining({
      tool: 'screen_root_marker_repair',
      status: 'ok',
      changedFiles: [screenPath],
    }),
  );
});

test('complete built-in run with JS-capable root mismatch remains needs review with mismatch evidence', async () => {
  const { mkdir, mkdtemp, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-js-root-mismatch-'));
  await mkdir(join(workspacePath, 'src/screens'), { recursive: true });
  await writeFile(
    join(workspacePath, 'src/screens/Page.tsx'),
    [
      'export function Page() {',
      '  return <main data-sd-screen-root="true">New screen</main>;',
      '}',
      '',
    ].join('\n'),
    'utf8',
  );
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'echo',
    workspacePath,
    activeScreen: {
      id: 'screen-page',
      name: 'Page',
      kind: 'page',
      filePath: 'src/screens/Page.tsx',
      implementationFilePath: 'src/screens/Page.tsx',
    },
  });
  await recordToolReceiptSafely({
    workspacePath,
    runId: agentRun.runId,
    tool: 'write_file',
    status: 'ok',
    changedFiles: ['src/screens/Page.tsx'],
    summary: 'Updated src/screens/Page.tsx.',
  });

  const finalized = await finalizeBuiltInRunDone({
    workspacePath,
    agentRun,
    canvasUrl: 'http://localhost:3000/page.html',
    fetchImpl: async () =>
      new Response('<main><h1>Preview shell without the runtime marker</h1></main>', {
        status: 200,
      }),
    event: {
      type: 'done',
      transcript: [{ role: 'assistant', content: 'Screen rendered.' }],
      iterations: 3,
      truncated: false,
      hadErrors: false,
      stoppedAfterPermissionDeny: false,
      finalResponse: {
        text: 'Screen rendered.',
        provider: 'mock',
        model: 'echo',
        finishReason: 'stop',
      },
    },
  });

  const receipts = await readAgentRunReceipts(workspacePath, agentRun.runId);
  expect(finalized.status).toBe('needs_review');
  expect(finalized.summary).toContain('Runtime screen root marker mismatch');
  expect(finalized.event.finalResponse.text).toContain(
    'Screen saved — browser verification pending',
  );
  expect(receipts).toContainEqual(
    expect.objectContaining({
      tool: 'runtime_render_health',
      status: 'skipped',
      metadata: expect.objectContaining({
        runtimeRootProbe: expect.objectContaining({
          reasonCode: 'runtime_root_marker_mismatch',
          evidenceJsCapable: true,
          sourceMarkerFound: true,
        }),
      }),
    }),
  );
});
