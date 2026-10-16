import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { expect, test } from 'bun:test';

import { getAgentRunCoordinator } from '../services/api/src/agent/run-coordinator';
import { resetProject } from '../services/api/src/project-store';
import {
  clearScreenInfoDatasetCache,
  screenInfoRouter,
} from '../services/api/src/routes/screen-info';
import { patchState, resetState } from '../services/api/src/state-store';

test('screen info route filters old/new rows, totals usage, and keeps pruned history', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-info-route-'));
  await mkdir(join(workspace, '.sber-designer/runs/run-live'), { recursive: true });
  await mkdir(join(workspace, '.sber-designer/runs/run-manifest-fallback'), { recursive: true });
  await writeFile(
    join(workspace, '.sber-designer/runs/run-manifest-fallback/run-manifest.json'),
    JSON.stringify({
      runId: 'run-manifest-fallback',
      metrics: { inputTokens: 100, outputTokens: 20, totalTokens: 120, costUsd: 0.05 },
    }),
  );
  await mkdir(join(workspace, 'pages'), { recursive: true });
  await writeFile(join(workspace, 'pages/dashboard.html'), '<main>Dashboard</main>');
  await writeFile(
    join(workspace, '.sber-designer/project.sdproj'),
    JSON.stringify({
      version: 1,
      name: 'Screen info route',
      workspacePath: workspace,
      screens: [
        {
          id: 'dashboard',
          name: 'Dashboard',
          kind: 'page',
          filePath: 'pages/dashboard.html',
          implementationFilePath: 'pages/dashboard.html',
        },
      ],
      flow: [],
    }),
  );
  const rows = [
    {
      version: 1,
      run_id: 'run-live',
      started_at: '2026-07-20T10:00:00.000Z',
      completed_at: '2026-07-20T10:02:00.000Z',
      status: 'complete',
      route: 'chat-stream',
      provider: 'mock',
      model: 'model-a',
      runtime_kind: 'api',
      screen_id: 'dashboard',
      screen_ids: ['dashboard'],
      screen_attribution: { dashboard: 'active-screen' },
      session_mode: 'design',
      cost_usd: 0.2,
      token_usage: { input: 100, output: 20, total: 120, iterations: 2 },
      attachments: [
        {
          kind: 'text',
          name: 'brief.md',
          document_kind: 'markdown',
          mime_type: 'text/markdown',
          size: 12,
          sha256: 'abc',
        },
      ],
      logs: { run_dir: '.sber-designer/runs/run-live' },
    },
    {
      version: 1,
      run_id: 'run-pruned',
      started_at: '2026-07-21T10:00:00.000Z',
      completed_at: '2026-07-21T10:01:00.000Z',
      status: 'failed',
      route: 'chat-stream',
      provider: 'cli',
      model: 'model-b',
      runtime_kind: 'cli',
      screen_id: null,
      screen_ids: ['dashboard'],
      screen_attribution: { dashboard: 'receipt' },
      session_mode: 'plan',
      cost_usd: null,
      token_usage: { input: null, output: null, total: null, iterations: 1 },
      attachments: null,
      logs: { run_dir: '.sber-designer/runs/run-pruned' },
    },
    {
      version: 1,
      run_id: 'run-manifest-fallback',
      started_at: '2026-07-21T12:00:00.000Z',
      completed_at: '2026-07-21T12:01:00.000Z',
      status: 'complete',
      route: 'chat-stream',
      provider: 'mock',
      model: 'model-fallback',
      runtime_kind: 'api',
      screen_id: 'dashboard',
      screen_ids: ['dashboard'],
      screen_attribution: { dashboard: 'active-screen' },
      session_mode: 'design',
      cost_usd: null,
      token_usage: { input: null, output: null, total: null, iterations: 1 },
      attachments: null,
      logs: { run_dir: '.sber-designer/runs/run-manifest-fallback' },
    },
    {
      version: 1,
      run_id: 'run-old-format',
      started_at: '2026-07-19T10:00:00.000Z',
      completed_at: '2026-07-19T10:01:00.000Z',
      status: 'cancelled',
      route: 'chat',
      provider: null,
      model: null,
      runtime_kind: null,
      screen_id: 'dashboard',
      screen_name: 'Dashboard',
      token_usage: { input: 50, output: 5, total: 55, iterations: 1 },
    },
    {
      version: 1,
      run_id: 'run-other',
      started_at: '2026-07-22T10:00:00.000Z',
      completed_at: '2026-07-22T10:01:00.000Z',
      status: 'complete',
      route: 'chat-stream',
      screen_id: 'other',
      token_usage: { input: 999, output: 999, total: 1998 },
    },
  ];
  await writeFile(
    join(workspace, '.sber-designer/runs-dataset.jsonl'),
    `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`,
  );
  resetState();
  resetProject(workspace);
  clearScreenInfoDatasetCache();
  patchState({ workspacePath: workspace });
  const coordinator = getAgentRunCoordinator();
  coordinator.reset();
  const acquired = coordinator.acquire({
    clientRunId: 'client-running',
    sessionId: 'session-running',
    screenId: 'dashboard',
    provider: 'mock',
    model: 'model-running',
    sessionMode: 'ask',
    runtimeKind: 'api',
  });
  expect(acquired.ok).toBe(true);

  const app = new Hono().route('/api/screens', screenInfoRouter);
  const response = await app.request('/api/screens/dashboard/generation-info');
  expect(response.status).toBe(200);
  const body = (await response.json()) as Record<string, any>;
  expect(body.totals).toEqual({
    runs: 4,
    inputTokens: 250,
    outputTokens: 45,
    totalTokens: 295,
    costUsd: 0.25,
    runsWithoutTokenData: 1,
  });
  expect(body.screen.createdAt.source).toBe('estimated');
  expect(body.screen.updatedAt.source).toBe('estimated');
  expect(body.runs.map((run: { runId: string }) => run.runId)).toEqual([
    'run-manifest-fallback',
    'run-pruned',
    'run-live',
    'run-old-format',
  ]);
  expect(body.runs[0]).toMatchObject({
    inputTokens: 100,
    outputTokens: 20,
    totalTokens: 120,
    costUsd: 0.05,
  });
  expect(body.runs[1]).toMatchObject({
    logs: { available: false },
    attribution: 'receipt',
    inputTokens: null,
  });
  expect(body.runs[2]).toMatchObject({
    logs: { available: true },
    attachments: [{ name: 'brief.md', documentKind: 'markdown' }],
  });
  expect(body.activeRun).toMatchObject({
    runId: 'client-running',
    sessionMode: 'ask',
    model: 'model-running',
  });

  const missing = await app.request('/api/screens/missing/generation-info');
  expect(missing.status).toBe(404);
  if (acquired.ok) coordinator.release(acquired.lease.leaseId);
  coordinator.reset();
  resetProject(workspace);
  resetState();
});
