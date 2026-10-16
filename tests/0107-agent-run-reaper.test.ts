import { mkdir, mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import {
  appendRuntimeEventLog,
  runtimeEventLogPath,
} from '../services/api/src/agent-runtimes/event-log';
import {
  createAgentRun,
  discoverAgentRunWorkspaces,
  readRunManifest,
  reapExpiredAgentRunArtifacts,
  reapOrphanedAgentRuns,
  resolveRunsRetentionDays,
  writeRunManifest,
} from '../services/api/src/agent/run-recorder';

test('run-record reaper fails stale running manifests without fresh runtime events', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-run-reaper-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const now = 1_800_000;
  const stale = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'codex-runtime',
    model: 'default',
    workspacePath: workspace,
  });
  await writeRunManifest(workspace, {
    ...stale,
    createdAt: 0,
    updatedAt: 0,
  });

  const fresh = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'codex-runtime',
    model: 'default',
    workspacePath: workspace,
  });
  await appendRuntimeEventLog({
    workspacePath: workspace,
    runId: fresh.runId,
    runtime: 'Codex',
    event: { type: 'text-delta', iteration: 1, delta: 'still working' },
  });

  const result = await reapOrphanedAgentRuns(workspace, {
    now,
    runTimeoutMs: 60_000,
    eventQuietMs: 60_000,
  });

  const staleManifest = await readRunManifest(workspace, stale.runId);
  const freshManifest = await readRunManifest(workspace, fresh.runId);

  expect(result.reaped).toEqual([
    {
      runId: stale.runId,
      reason: 'orphaned',
      manifestPath: `.sber-designer/runs/${stale.runId}/run-manifest.json`,
      eventLogPath: runtimeEventLogPath(stale.runId),
    },
  ]);
  expect(staleManifest?.status).toBe('failed');
  expect(staleManifest?.diagnostics?.errorCode).toBe('orphaned');
  expect(freshManifest?.status).toBe('running');
});

test('run-record retention deletes expired completed artifacts but keeps running runs', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-agent-run-retention-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const now = 30 * 24 * 60 * 60 * 1000;

  const expired = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'default',
    workspacePath: workspace,
  });
  await writeRunManifest(workspace, {
    ...expired,
    createdAt: 0,
    updatedAt: 0,
    completedAt: 0,
    status: 'complete',
  });

  const fresh = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'default',
    workspacePath: workspace,
  });
  await writeRunManifest(workspace, {
    ...fresh,
    createdAt: now - 2 * 24 * 60 * 60 * 1000,
    updatedAt: now - 2 * 24 * 60 * 60 * 1000,
    completedAt: now - 2 * 24 * 60 * 60 * 1000,
    status: 'complete',
  });

  const oldRunning = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'default',
    workspacePath: workspace,
  });
  await writeRunManifest(workspace, {
    ...oldRunning,
    createdAt: 0,
    updatedAt: 0,
    status: 'running',
  });

  const result = await reapExpiredAgentRunArtifacts(workspace, {
    now,
    retentionDays: 7,
  });

  expect(result).toEqual({
    scanned: 3,
    deleted: [
      {
        runId: expired.runId,
        reason: 'retention_expired',
        rootPath: `.sber-designer/runs/${expired.runId}`,
      },
    ],
    skippedRunning: [oldRunning.runId],
  });
  await expect(stat(join(workspace, '.sber-designer/runs', expired.runId))).rejects.toThrow();
  expect((await stat(join(workspace, '.sber-designer/runs', fresh.runId))).isDirectory()).toBe(
    true,
  );
  expect((await stat(join(workspace, '.sber-designer/runs', oldRunning.runId))).isDirectory()).toBe(
    true,
  );
});

test('runs retention env parser defaults to off unless configured', () => {
  expect(resolveRunsRetentionDays(undefined)).toBeNull();
  expect(resolveRunsRetentionDays('14', 'local')).toBeNull();
  expect(resolveRunsRetentionDays('', 'server')).toBeNull();
  expect(resolveRunsRetentionDays('0', 'server')).toBeNull();
  expect(resolveRunsRetentionDays('off', 'server')).toBeNull();
  expect(resolveRunsRetentionDays('14', 'server')).toBe(14);
  expect(() => resolveRunsRetentionDays('-1', 'server')).toThrow(
    'SBER_DESIGNER_RUNS_RETENTION_DAYS must be a positive integer, 0, or off.',
  );
});

test('server reaper discovers run roots across every managed user workspace', async () => {
  const originalRoot = process.env.SBER_DESIGNER_PROJECTS_ROOT;
  const originalMode = process.env.SBER_DESIGNER_DEPLOYMENT_MODE;
  const root = await mkdtemp(join(tmpdir(), 'sd-agent-run-workspaces-'));
  const first = join(root, 'user-a', 'project-one');
  const second = join(root, 'user-b', 'project-two');
  const withoutRuns = join(root, 'user-b', 'project-without-runs');
  await Promise.all([
    mkdir(join(first, '.sber-designer', 'runs'), { recursive: true }),
    mkdir(join(second, '.sber-designer', 'runs'), { recursive: true }),
    mkdir(withoutRuns, { recursive: true }),
  ]);
  process.env.SBER_DESIGNER_PROJECTS_ROOT = root;
  process.env.SBER_DESIGNER_DEPLOYMENT_MODE = 'server';

  try {
    const discovered = await discoverAgentRunWorkspaces();
    expect(discovered.some((path) => path.endsWith('/user-a/project-one'))).toBe(true);
    expect(discovered.some((path) => path.endsWith('/user-b/project-two'))).toBe(true);
    expect(discovered.some((path) => path.endsWith('/user-b/project-without-runs'))).toBe(false);
  } finally {
    if (originalRoot === undefined) delete process.env.SBER_DESIGNER_PROJECTS_ROOT;
    else process.env.SBER_DESIGNER_PROJECTS_ROOT = originalRoot;
    if (originalMode === undefined) delete process.env.SBER_DESIGNER_DEPLOYMENT_MODE;
    else process.env.SBER_DESIGNER_DEPLOYMENT_MODE = originalMode;
  }
});
