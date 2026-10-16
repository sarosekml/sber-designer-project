import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'bun:test';

import type { AgentStreamEvent } from '../services/api/src/agent/stream';
import { createAgentRun } from '../services/api/src/agent/run-record/manifest';
import {
  readAgentRunReceipts,
  recordToolReceipt,
} from '../services/api/src/agent/run-record/receipts';
import { snapshotRuntimeTargetFiles } from '../services/api/src/agent-runtimes/change-validation';
import {
  clearProjectIndexJobs,
  getProjectIndexJob,
  listProjectIndexJobs,
} from '../services/api/src/project-index/job-store';
import { finalizeBuiltInRunDone } from '../services/api/src/routes/chat-stream/built-in';
import { finalizeExternalRuntimeDone } from '../services/api/src/routes/chat-stream/external-finalization';

afterEach(async () => {
  await waitForTerminalJobs();
  clearProjectIndexJobs();
});

test('external finalization starts project reindex after component description sidecar changes', async () => {
  clearProjectIndexJobs();
  const workspace = await createWorkspace();
  const sidecarPath = '.sber-designer/components/components-data-table.md';
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'codex-runtime',
    model: 'default',
    runtimeKind: 'cli',
    projectName: 'Sidecar CRM',
    userGoal: 'Update the component description sidecar.',
    workspacePath: workspace,
  });
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [sidecarPath]);

  await writeFile(
    join(workspace, sidecarPath),
    [
      '## Description for AI',
      '',
      '**Intent:** Use DataTable for dense approval queues with sortable rows.',
      '**Structure:** Wrap in a scrollable region when content exceeds the page width.',
      '',
    ].join('\n'),
    'utf8',
  );

  await finalizeExternalRuntimeDone({
    event: doneEvent('Updated the component description sidecar.'),
    runtimeLabel: 'Codex',
    workspacePath: workspace,
    agentRun,
    snapshots,
    canvasUrl: null,
    visualSnapshot: unavailableVisualSnapshot(),
    componentPack: null,
    selection: null,
    sawError: false,
  });

  const jobs = listProjectIndexJobs();
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({
    workspaceRoot: workspace,
    projectName: 'Sidecar CRM',
  });

  const receipts = await readAgentRunReceipts(workspace, agentRun.runId);
  expect(receipts).toContainEqual(
    expect.objectContaining({
      tool: 'project_index_reconcile',
      status: 'ok',
      changedFiles: [sidecarPath],
      metadata: expect.objectContaining({
        reason: 'component_description_sidecar_changed',
        sidecarFiles: [sidecarPath],
        jobId: jobs[0]?.id,
      }),
    }),
  );
});

test('built-in finalization starts project reindex after component description sidecar receipt changes', async () => {
  clearProjectIndexJobs();
  const workspace = await createWorkspace();
  const sidecarPath = '.sber-designer/components/components-data-table.md';
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock-api',
    model: 'mock-model',
    runtimeKind: 'api',
    projectName: 'Sidecar CRM',
    userGoal: 'Update the component description sidecar.',
    workspacePath: workspace,
  });

  await writeFile(
    join(workspace, sidecarPath),
    [
      '## Description for AI',
      '',
      '**Intent:** Use DataTable for dense approval queues with sortable rows.',
      '',
    ].join('\n'),
    'utf8',
  );
  await recordToolReceipt({
    workspacePath: workspace,
    runId: agentRun.runId,
    tool: 'write_component_description',
    status: 'ok',
    changedFiles: [sidecarPath],
    summary: 'Wrote Description for AI for DataTable.',
  });

  await finalizeBuiltInRunDone({
    event: doneEvent('Updated the component description sidecar.'),
    workspacePath: workspace,
    agentRun,
    canvasUrl: null,
  });

  const jobs = listProjectIndexJobs();
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({
    workspaceRoot: workspace,
    projectName: 'Sidecar CRM',
  });

  const receipts = await readAgentRunReceipts(workspace, agentRun.runId);
  expect(receipts).toContainEqual(
    expect.objectContaining({
      tool: 'project_index_reconcile',
      status: 'ok',
      changedFiles: [sidecarPath],
      metadata: expect.objectContaining({
        reason: 'component_description_sidecar_changed',
        sidecarFiles: [sidecarPath],
        jobId: jobs[0]?.id,
      }),
    }),
  );
});

test('external finalization does not reindex when no component description sidecar changed', async () => {
  clearProjectIndexJobs();
  const workspace = await createWorkspace();
  const targetPath = 'src/components/DataTable.tsx';
  const agentRun = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'codex-runtime',
    model: 'default',
    runtimeKind: 'cli',
    projectName: 'Sidecar CRM',
    userGoal: 'Update DataTable source.',
    workspacePath: workspace,
  });
  const snapshots = await snapshotRuntimeTargetFiles(workspace, [targetPath]);

  await writeFile(
    join(workspace, targetPath),
    'export function DataTable() { return <table data-density="compact" />; }\n',
    'utf8',
  );

  await finalizeExternalRuntimeDone({
    event: doneEvent('Updated the component source.'),
    runtimeLabel: 'Codex',
    workspacePath: workspace,
    agentRun,
    snapshots,
    canvasUrl: null,
    visualSnapshot: unavailableVisualSnapshot(),
    componentPack: null,
    selection: null,
    sawError: false,
  });

  expect(listProjectIndexJobs()).toEqual([]);
  const receipts = await readAgentRunReceipts(workspace, agentRun.runId);
  expect(receipts.some((receipt) => receipt.tool === 'project_index_reconcile')).toBe(false);
});

async function createWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'sd-0112-external-reindex-'));
  await mkdir(join(root, 'src', 'components'), { recursive: true });
  await mkdir(join(root, '.sber-designer', 'components'), { recursive: true });
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify(
      {
        scripts: { dev: 'vite --host 0.0.0.0' },
        dependencies: { react: '^19.0.0', vite: '^latest' },
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(root, 'DESIGN.md'),
    [
      '---',
      'name: Sidecar CRM',
      '---',
      '',
      '# Sidecar CRM',
      '',
      '## Overview',
      'Operational approval workspace.',
      '',
      '## Components',
      'Use DataTable for approval queues.',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    join(root, 'src', 'components', 'DataTable.tsx'),
    'export function DataTable() { return <table />; }\n',
    'utf8',
  );
  await writeFile(
    join(root, '.sber-designer', 'components', 'components-data-table.md'),
    ['## Description for AI', '', '**Intent:** Use DataTable for approval queues.', ''].join('\n'),
    'utf8',
  );
  return root;
}

async function waitForTerminalJobs(): Promise<void> {
  const jobs = listProjectIndexJobs();
  for (const job of jobs) {
    await waitForProjectIndexJob(job.id);
  }
}

async function waitForProjectIndexJob(id: string): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const job = getProjectIndexJob(id);
    if (!job || job.stage === 'complete' || job.stage === 'failed') return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for project index job ${id}`);
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

function unavailableVisualSnapshot() {
  return {
    status: 'unavailable' as const,
    bytes: null,
    path: null,
    message: 'test',
  };
}
