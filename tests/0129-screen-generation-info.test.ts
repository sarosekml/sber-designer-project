import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  RUNS_DATASET_PATH,
  buildAgentRunDatasetRow,
} from '../services/api/src/agent/run-record/dataset';
import { completeAgentRun, createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { recordToolReceipt } from '../services/api/src/agent/run-record/receipts';
import { readRunManifest, writeRunManifest } from '../services/api/src/agent/run-record/store';
import {
  ProjectSchema,
  loadProjectForWorkspace,
  reconcileProjectScreenTimestamps,
  resetProject,
  touchScreens,
} from '../services/api/src/project-store';

test('0129 dataset row keeps screen, attachment, cost, mode, and log evidence', async () => {
  const workspace = await workspaceWithScreens();
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'model-a',
    runtimeKind: 'api',
    sessionMode: 'design',
    workspacePath: workspace,
    activeScreen: screen('screen-a', 'pages/a.html'),
  });
  await writeRunManifest(workspace, {
    ...run,
    affectedScreenIds: ['screen-a'],
    affectedScreenAttribution: { 'screen-a': 'active-screen' },
    promptAttachments: [
      {
        id: 'brief',
        kind: 'text',
        documentKind: 'markdown',
        name: 'brief.md',
        mimeType: 'text/markdown',
        size: 42,
        sha256: 'abc123',
        runPath: '.sber-designer/runs/run/attachments/brief.md',
        excerpt: 'Brief',
      },
    ],
    diagnostics: {
      attemptLogPath: join(workspace, '.sber-designer/runs/attempt.jsonl'),
      debugLogPath: '/tmp/external-debug.jsonl',
    },
    metrics: {
      startedAt: 1,
      completedAt: 2,
      durationMs: 1,
      inputTokens: 100,
      outputTokens: 25,
      totalTokens: 125,
      costUsd: 0.14,
    },
  });
  const manifest = await readRunManifest(workspace, run.runId);
  const row = buildAgentRunDatasetRow(manifest!, []);

  expect(row).toMatchObject({
    screen_ids: ['screen-a'],
    screen_attribution: { 'screen-a': 'active-screen' },
    session_mode: 'design',
    cost_usd: 0.14,
    attachments: [
      {
        kind: 'text',
        name: 'brief.md',
        document_kind: 'markdown',
        mime_type: 'text/markdown',
        size: 42,
        sha256: 'abc123',
      },
    ],
    logs: {
      run_dir: `.sber-designer/runs/${run.runId}`,
      attempt_log: '.sber-designer/runs/attempt.jsonl',
      debug_log: '/tmp/external-debug.jsonl',
    },
  });
  resetProject(workspace);
});

test('0129 completion attributes active, receipt-created, and changed-file screens', async () => {
  const workspace = await workspaceWithScreens();
  await loadProjectForWorkspace(workspace);
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'model-a',
    runtimeKind: 'api',
    workspacePath: workspace,
    activeScreen: screen('screen-a', 'pages/a.html'),
  });
  await recordToolReceipt({
    workspacePath: workspace,
    runId: run.runId,
    tool: 'screen_create',
    status: 'ok',
    changedFiles: ['.sber-designer/project.sdproj'],
    metadata: { screenId: 'screen-b' },
  });
  await recordToolReceipt({
    workspacePath: workspace,
    runId: run.runId,
    tool: 'write_file',
    status: 'ok',
    changedFiles: ['pages/c.html'],
  });

  const completed = await completeAgentRun({
    workspacePath: workspace,
    runId: run.runId,
    status: 'complete',
    metrics: { inputTokens: 10, outputTokens: 2 },
  });

  expect(completed?.affectedScreenIds).toEqual(['screen-a', 'screen-b', 'screen-c']);
  expect(completed?.affectedScreenAttribution).toEqual({
    'screen-a': 'active-screen',
    'screen-b': 'receipt',
    'screen-c': 'changed-files',
  });
  const row = JSON.parse(
    (await readFile(join(workspace, RUNS_DATASET_PATH), 'utf8')).trim(),
  ) as Record<string, unknown>;
  expect(row.screen_ids).toEqual(['screen-a', 'screen-b', 'screen-c']);
  resetProject(workspace);
});

test('0129 CLI completion falls back to cumulative runtime usage without inventing data', async () => {
  const workspace = await workspaceWithScreens();
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'claude-code-runtime',
    model: 'sonnet',
    runtimeKind: 'cli',
    workspacePath: workspace,
  });
  const completed = await completeAgentRun({
    workspacePath: workspace,
    runId: run.runId,
    status: 'cancelled',
    diagnostics: {
      runtimeSession: {
        runtime: 'claude-code',
        style: 'capture',
        mode: 'resume',
        resumeUsed: true,
        model: 'sonnet',
        workspacePath: workspace,
        source: 'runtime-event',
        cumulativeUsage: {
          inputTokens: 300,
          outputTokens: 40,
          totalTokens: 340,
          costUsd: 0.21,
        },
      },
    },
  });
  expect(completed?.metrics).toMatchObject({
    inputTokens: 300,
    outputTokens: 40,
    totalTokens: 340,
    costUsd: 0.21,
  });
  resetProject(workspace);
});

test('0129 project timestamps preserve old screens and advance explicit touches', async () => {
  const old = screen('screen-old', 'pages/old.html');
  expect(ProjectSchema.parse(project('/workspace', [old])).screens[0]?.createdAt).toBeUndefined();
  expect(reconcileProjectScreenTimestamps([old], [old], 100)).toEqual([old]);
  expect(reconcileProjectScreenTimestamps([], [old], 100)[0]).toMatchObject({
    createdAt: 100,
    updatedAt: 100,
  });

  const workspace = await workspaceWithScreens();
  await loadProjectForWorkspace(workspace);
  await touchScreens(workspace, ['screen-a'], { created: true, at: 500 });
  const saved = JSON.parse(
    await readFile(join(workspace, '.sber-designer/project.sdproj'), 'utf8'),
  ) as { screens: Array<{ id: string; createdAt?: number; updatedAt?: number }> };
  expect(saved.screens.find((candidate) => candidate.id === 'screen-a')).toMatchObject({
    createdAt: 500,
    updatedAt: 500,
  });
  resetProject(workspace);
});

async function workspaceWithScreens(): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0129-screen-info-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  await mkdir(join(workspace, 'pages'), { recursive: true });
  const screens = [
    screen('screen-a', 'pages/a.html'),
    screen('screen-b', 'pages/b.html'),
    screen('screen-c', 'pages/c.html'),
  ];
  await Promise.all(
    screens.map((item) => writeFile(join(workspace, item.filePath!), `<main>${item.name}</main>`)),
  );
  await writeFile(
    join(workspace, '.sber-designer/project.sdproj'),
    JSON.stringify(project(workspace, screens)),
  );
  return workspace;
}

function screen(id: string, filePath: string) {
  return { id, name: id, kind: 'page' as const, filePath, implementationFilePath: filePath };
}

function project(workspacePath: string, screens: ReturnType<typeof screen>[]) {
  return { version: 1 as const, name: 'Screen info fixture', workspacePath, screens, flow: [] };
}
