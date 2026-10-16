import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { classifyCanvasRuntimeHealth } from '../services/api/src/agent-runtimes/render-health';
import {
  probeStorybookRender,
  waitForStorybookStoryIndexed,
} from '../services/api/src/agent-runtimes/storybook-render-probe';
import { createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { readAgentRunReceipts } from '../services/api/src/agent/run-record/receipts';
import {
  formatRuntimeRenderHealthNeedsReviewNotice,
  recordRuntimeRenderHealthSafely,
} from '../services/api/src/routes/chat-stream/render-health';

test('classifies Vite module errors as failed render health', () => {
  const result = classifyCanvasRuntimeHealth({
    rootFound: false,
    bodyText: "Cannot find module '@/components/atoms/Header/DashboardGroupHeader'",
    consoleErrors: [],
  });

  expect(result).toMatchObject({
    status: 'failed',
    reason: expect.stringContaining('Cannot find module'),
  });
});

test('classifies Storybook runtime TypeError text as failed render health', () => {
  const result = classifyCanvasRuntimeHealth({
    rootFound: false,
    bodyText: 'Storybook preview error: t.addEventListener is not a function',
    consoleErrors: [],
  });

  expect(result).toMatchObject({
    status: 'failed',
    reason: expect.stringContaining('addEventListener is not a function'),
  });
});

test('classifies a mounted screen root without console errors as ok', () => {
  const result = classifyCanvasRuntimeHealth({
    rootFound: true,
    bodyText: 'Администрирование',
    consoleErrors: [],
  });

  expect(result).toEqual({
    status: 'ok',
    reason: 'Canvas rendered a screen root without runtime error evidence.',
  });
});

test('classifies a missing screen root with non-error content as failed', () => {
  const result = classifyCanvasRuntimeHealth({
    rootFound: false,
    bodyText: 'Storybook',
    consoleErrors: [],
    evidenceJsCapable: true,
  });

  expect(result).toMatchObject({
    status: 'failed',
    reason: expect.stringContaining('No data-sd-screen-root'),
  });
});

test('classifies missing root from no-JS evidence as an unproven runtime root', () => {
  const result = classifyCanvasRuntimeHealth({
    rootFound: false,
    bodyText: 'Storybook shell',
    consoleErrors: [],
    evidenceJsCapable: false,
  });

  expect(result).toMatchObject({
    status: 'warning',
    reasonCode: 'runtime_root_unproven',
    weakEvidence: true,
    reason: expect.stringContaining('cannot execute preview JavaScript'),
  });
});

test('classifies source marker without JS-capable DOM root as a marker mismatch', () => {
  const result = classifyCanvasRuntimeHealth({
    rootFound: false,
    bodyText: 'Rendered shell without root marker',
    consoleErrors: [],
    evidenceJsCapable: true,
    sourceMarkerFound: true,
    sourcePath: 'src/screens/Payment.tsx',
    storyId: 'screens-payment--default',
  });

  expect(result).toMatchObject({
    status: 'warning',
    reasonCode: 'runtime_root_marker_mismatch',
    weakEvidence: false,
    sourcePath: 'src/screens/Payment.tsx',
    storyId: 'screens-payment--default',
    reason: expect.stringContaining('source contains data-sd-screen-root'),
  });
});

test('classifies a missing screen root with empty content as failed', () => {
  const result = classifyCanvasRuntimeHealth({
    rootFound: false,
    bodyText: '',
    consoleErrors: [],
    evidenceJsCapable: true,
  });

  expect(result).toMatchObject({
    status: 'failed',
    reason: expect.stringContaining('No data-sd-screen-root'),
  });
});

test('storybook render probe treats non-2xx preview responses as unavailable weak evidence', async () => {
  const result = await probeStorybookRender({
    url: 'http://storybook.local/iframe.html?id=screen--default',
    fetchImpl: async () => new Response('error', { status: 500 }),
  });

  expect(result).toMatchObject({
    status: 'unavailable',
    evidenceSource: 'storybook-http',
    weakEvidence: true,
    httpStatus: 500,
    reason: expect.stringContaining('HTTP 500'),
  });
});

test('storybook render probe detects module errors from preview HTML', async () => {
  const result = await probeStorybookRender({
    url: 'http://storybook.local/iframe.html?id=screen--default',
    fetchImpl: async () =>
      new Response("<div>Cannot find module '@/components/Missing'</div>", { status: 200 }),
  });

  expect(result).toMatchObject({
    status: 'failed',
    reason: expect.stringContaining('Cannot find module'),
  });
});

test('storybook render probe accepts rendered screen-root HTML', async () => {
  const result = await probeStorybookRender({
    url: 'http://storybook.local/iframe.html?id=screen--default',
    fetchImpl: async () => new Response('<main data-sd-screen-root>Ready</main>', { status: 200 }),
  });

  expect(result).toMatchObject({
    status: 'ok',
  });
});

test('static html render health detects inline script runtime errors without Chrome', async () => {
  const previousChromeUrl = process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL;
  delete process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL;
  const workspace = await mkdtemp(join(tmpdir(), 'sd-static-render-health-'));
  try {
    const run = await createAgentRun({
      route: 'chat-stream',
      user: 'test-user',
      workspacePath: workspace,
      activeScreen: {
        id: 'screen-static-home',
        name: 'Static home',
        kind: 'page',
        filePath: 'site/index.html',
        implementationFilePath: 'site/index.html',
      },
    });

    const health = await recordRuntimeRenderHealthSafely({
      workspacePath: workspace,
      agentRun: run,
      canvasUrl: 'http://static.local/site/index.html',
      changedFiles: ['site/index.html'],
      fetchImpl: async () =>
        new Response(
          '<main data-sd-screen-root>Ready<script>throw new Error("Static preview exploded")</script></main>',
          { status: 200 },
        ),
    });

    expect(health).toMatchObject({
      status: 'failed',
      reasonCode: 'runtime_error',
      evidenceSource: 'static-html-http',
      errorText: expect.stringContaining('Static preview exploded'),
    });
  } finally {
    if (previousChromeUrl === undefined) {
      delete process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL;
    } else {
      process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL = previousChromeUrl;
    }
  }
});

test('runtime render health records marker mismatch probe diagnostics', async () => {
  const previousChromeUrl = process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL;
  delete process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL;
  const workspace = await mkdtemp(join(tmpdir(), 'sd-runtime-root-probe-'));
  try {
    await mkdir(join(workspace, 'src', 'screens'), { recursive: true });
    await writeFile(
      join(workspace, 'src', 'screens', 'Payment.tsx'),
      '<main data-sd-screen-root>Payment</main>',
      'utf8',
    );
    const run = await createAgentRun({
      route: 'chat-stream',
      user: 'test-user',
      workspacePath: workspace,
      activeScreen: {
        id: 'screen-payment',
        name: 'Payment',
        kind: 'page',
        filePath: 'src/screens/Payment.tsx',
        implementationFilePath: 'src/screens/Payment.tsx',
      },
    });

    const health = await recordRuntimeRenderHealthSafely({
      workspacePath: workspace,
      agentRun: run,
      canvasUrl: 'http://static.local/src/screens/Payment.tsx',
      changedFiles: ['src/screens/Payment.tsx'],
      fetchImpl: async () => new Response('<main>Payment preview</main>', { status: 200 }),
    });
    const timeline = await readFile(
      join(workspace, '.sber-designer', 'runs', run.runId, 'timeline.jsonl'),
      'utf8',
    );
    const receipt = timeline
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
      .find((event) => event.tool === 'runtime_render_health');
    const receiptFile = JSON.parse(
      await readFile(
        join(
          workspace,
          '.sber-designer',
          'runs',
          run.runId,
          'receipts',
          `${receipt.receiptId}.json`,
        ),
        'utf8',
      ),
    );

    expect(health).toMatchObject({
      status: 'warning',
      reasonCode: 'runtime_root_marker_mismatch',
      sourcePath: 'src/screens/Payment.tsx',
    });
    expect(receipt).toMatchObject({
      status: 'skipped',
    });
    expect(receiptFile).toMatchObject({
      metadata: {
        runtimeRootProbe: {
          reasonCode: 'runtime_root_marker_mismatch',
          evidenceJsCapable: true,
          sourceMarkerFound: true,
          sourcePath: 'src/screens/Payment.tsx',
          evidenceSource: 'static-html-http',
          sourceHash: expect.stringMatching(/^sha256:/),
        },
      },
    });
  } finally {
    if (previousChromeUrl === undefined) {
      delete process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL;
    } else {
      process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL = previousChromeUrl;
    }
  }
});

test('runtime render health records recovered transient preview runtime errors', async () => {
  const previousChromeUrl = process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL;
  delete process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL;
  const workspace = await mkdtemp(join(tmpdir(), 'sd-preview-runtime-error-'));
  try {
    await mkdir(join(workspace, 'src', 'screens'), { recursive: true });
    await writeFile(
      join(workspace, 'src', 'screens', 'Payment.tsx'),
      '<main data-sd-screen-root>Payment</main>',
      'utf8',
    );
    const run = await createAgentRun({
      route: 'chat-stream',
      user: 'test-user',
      workspacePath: workspace,
      activeScreen: {
        id: 'screen-payment',
        name: 'Payment',
        kind: 'page',
        filePath: 'src/screens/Payment.tsx',
        implementationFilePath: 'src/screens/Payment.tsx',
      },
    });
    await mkdir(join(workspace, '.sber-designer', 'runs', run.runId, 'external-runtime'), {
      recursive: true,
    });
    await writeFile(
      join(workspace, '.sber-designer', 'runs', run.runId, 'external-runtime', 'events.jsonl'),
      `${JSON.stringify({
        timestamp: '2026-07-03T00:30:00.000Z',
        runtime: 'Codex CLI',
        event: {
          type: 'external-runtime-diagnostic',
          name: 'preview_runtime_error',
          data: {
            storyId: 'screen-payment--default',
            url: 'http://storybook.local/iframe.html?id=screen-payment--default',
            message: "Cannot read properties of undefined (reading 'badge')",
          },
        },
      })}\n`,
      'utf8',
    );

    const health = await recordRuntimeRenderHealthSafely({
      workspacePath: workspace,
      agentRun: run,
      canvasUrl: 'http://static.local/src/screens/Payment.tsx',
      changedFiles: ['src/screens/Payment.tsx'],
      fetchImpl: async () =>
        new Response('<main data-sd-screen-root>Payment rendered</main>', { status: 200 }),
    });
    const receipts = await readAgentRunReceipts(workspace, run.runId);
    const previewError = receipts.find((receipt) => receipt.tool === 'preview_runtime_error');

    expect(health).toMatchObject({ status: 'ok' });
    expect(previewError).toMatchObject({
      status: 'ok',
      summary: expect.stringContaining('recovered'),
      metadata: {
        recovered: true,
        errors: [
          expect.objectContaining({
            recovered: true,
            storyId: 'screen-payment--default',
            message: expect.stringContaining('Cannot read properties of undefined'),
          }),
        ],
      },
    });
  } finally {
    if (previousChromeUrl === undefined) {
      delete process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL;
    } else {
      process.env.SBER_DESIGNER_CHROME_DEBUGGING_URL = previousChromeUrl;
    }
  }
});

test('storybook render probe explains static HTML fallback limitations', async () => {
  const result = await probeStorybookRender({
    url: 'http://storybook.local/iframe.html?id=screen--default',
    fetchImpl: async () => new Response('<div>Storybook shell</div>', { status: 200 }),
  });

  expect(result).toMatchObject({
    status: 'warning',
    reasonCode: 'runtime_root_unproven',
    evidenceSource: 'storybook-http',
    weakEvidence: true,
    reason: expect.stringContaining('cannot execute preview JavaScript'),
  });
});

test('storybook readiness waits for a story id in index.json', async () => {
  const calls: string[] = [];
  const result = await waitForStorybookStoryIndexed({
    canvasUrl: 'http://storybook.local/api/preview/iframe.html?id=screen--default',
    storyId: 'screen--default',
    delaysMs: [0, 0],
    fetchImpl: async (url) => {
      calls.push(String(url));
      return new Response(
        JSON.stringify({
          entries:
            calls.length === 1
              ? {}
              : {
                  'screen--default': {
                    id: 'screen--default',
                    type: 'story',
                  },
                },
        }),
        { status: 200 },
      );
    },
  });

  expect(result).toMatchObject({
    status: 'indexed',
    indexUrl: 'http://storybook.local/api/preview/index.json',
  });
  expect(calls[0]).toContain('/api/preview/index.json');
});

test('storybook readiness times out instead of failing when index is not ready', async () => {
  const result = await waitForStorybookStoryIndexed({
    canvasUrl: 'http://storybook.local/iframe.html?id=screen--default',
    storyId: 'screen--default',
    delaysMs: [0],
    fetchImpl: async () => new Response('{}', { status: 404 }),
  });

  expect(result).toMatchObject({
    status: 'timeout',
    reason: expect.stringContaining('HTTP 404'),
    indexUrl: 'http://storybook.local/index.json',
  });
});

test('0108.4.3 static HTML needs-review notice is page-centric and never mentions Storybook', () => {
  const staticNotice = formatRuntimeRenderHealthNeedsReviewNotice({
    status: 'unavailable',
    reason: 'Static preview server unavailable.',
    evidenceSource: 'static-html-http',
  });
  expect(staticNotice).toContain('static HTML preview');
  expect(staticNotice).not.toContain('Storybook');

  // A page without a storyId (html profile) also stays Storybook-free.
  const pageNotice = formatRuntimeRenderHealthNeedsReviewNotice({
    status: 'unavailable',
    reason: 'Canvas not proven.',
  });
  expect(pageNotice).not.toContain('Storybook');
});

test('0108.4.3 Storybook story needs-review notice still references Storybook', () => {
  const storyNotice = formatRuntimeRenderHealthNeedsReviewNotice({
    status: 'unavailable',
    reason: 'Story not proven.',
    evidenceSource: 'storybook-http',
    storyId: 'screen--default',
  });
  expect(storyNotice).toContain('Storybook');
});
