import { expect, test } from 'bun:test';

import { createAgentRunCoordinator } from '../services/api/src/agent/run-coordinator';

const limits = {
  maxTotalRuns: 2,
  maxApiRuns: 1,
  maxCliRuns: 2,
  sameScreenPolicy: 'reject' as const,
  sameFilePolicy: 'reject' as const,
};

test('rejects a second active run on the same screen', () => {
  const coordinator = createAgentRunCoordinator(limits);
  const first = coordinator.acquire({
    clientRunId: 'client-a',
    sessionId: 'session-a',
    screenId: 'screen-a',
    provider: 'providerA',
    model: 'text-model',
    displayName: 'Ada Lovelace',
    runtimeKind: 'api',
    targetPaths: ['src/screens/A.tsx'],
  });

  expect(first.ok).toBe(true);
  const second = coordinator.acquire({
    clientRunId: 'client-b',
    sessionId: 'session-b',
    screenId: 'screen-a',
    provider: 'providerA',
    model: 'text-model',
    runtimeKind: 'api',
    targetPaths: ['src/screens/B.tsx'],
  });

  expect(second.ok).toBe(false);
  if (!second.ok) {
    expect(second.code).toBe('same_screen_active');
    expect(second.activeRuns).toHaveLength(1);
    expect(second.blockingRun).toMatchObject({
      clientRunId: 'client-a',
      sessionId: 'session-a',
      screenId: 'screen-a',
      displayName: 'Ada Lovelace',
      status: 'running',
    });
  }
});

test('rejects overlapping file targets across different screens', () => {
  const coordinator = createAgentRunCoordinator({ ...limits, maxApiRuns: 2 });
  const first = coordinator.acquire({
    clientRunId: 'client-a',
    sessionId: 'session-a',
    screenId: 'screen-a',
    provider: 'providerA',
    model: 'text-model',
    runtimeKind: 'api',
    targetPaths: ['./src/screens/Shared.tsx'],
  });

  expect(first.ok).toBe(true);
  const second = coordinator.acquire({
    clientRunId: 'client-b',
    sessionId: 'session-b',
    screenId: 'screen-b',
    provider: 'providerA',
    model: 'text-model',
    runtimeKind: 'api',
    targetPaths: ['src/screens/Shared.tsx'],
  });

  expect(second.ok).toBe(false);
  if (!second.ok) expect(second.code).toBe('same_file_active');
});

test('rejects screen runs while a workspace-wide run is active', () => {
  const coordinator = createAgentRunCoordinator({ ...limits, maxApiRuns: 2 });
  const first = coordinator.acquire({
    clientRunId: 'client-workspace',
    sessionId: 'session-workspace',
    screenId: 'global',
    provider: 'providerA',
    model: 'text-model',
    runtimeKind: 'api',
    targetPaths: [],
  });

  expect(first.ok).toBe(true);
  const second = coordinator.acquire({
    clientRunId: 'client-b',
    sessionId: 'session-b',
    screenId: 'screen-b',
    provider: 'providerA',
    model: 'text-model',
    runtimeKind: 'api',
    targetPaths: ['src/screens/B.tsx'],
  });

  expect(second.ok).toBe(false);
  if (!second.ok) expect(second.code).toBe('same_file_active');
});

test('rejects workspace-wide runs while screen runs are active', () => {
  const coordinator = createAgentRunCoordinator({ ...limits, maxApiRuns: 2 });
  const first = coordinator.acquire({
    clientRunId: 'client-a',
    sessionId: 'session-a',
    screenId: 'screen-a',
    provider: 'providerA',
    model: 'text-model',
    runtimeKind: 'api',
    targetPaths: ['src/screens/A.tsx'],
  });

  expect(first.ok).toBe(true);
  const second = coordinator.acquire({
    clientRunId: 'client-workspace',
    sessionId: 'session-workspace',
    screenId: 'global',
    provider: 'providerA',
    model: 'text-model',
    runtimeKind: 'api',
    targetPaths: [],
  });

  expect(second.ok).toBe(false);
  if (!second.ok) expect(second.code).toBe('same_file_active');
});

test('keeps queue policy conservative until run queueing is implemented', () => {
  const coordinator = createAgentRunCoordinator({
    ...limits,
    maxApiRuns: 2,
    sameScreenPolicy: 'queue',
    sameFilePolicy: 'queue',
  });
  const first = coordinator.acquire({
    clientRunId: 'client-a',
    sessionId: 'session-a',
    screenId: 'screen-a',
    provider: 'providerA',
    model: 'text-model',
    runtimeKind: 'api',
    targetPaths: ['src/screens/A.tsx'],
  });

  expect(first.ok).toBe(true);
  const second = coordinator.acquire({
    clientRunId: 'client-b',
    sessionId: 'session-b',
    screenId: 'screen-a',
    provider: 'providerA',
    model: 'text-model',
    runtimeKind: 'api',
    targetPaths: ['src/screens/B.tsx'],
  });

  expect(second.ok).toBe(false);
  if (!second.ok) expect(second.code).toBe('same_screen_active');
});

test('tracks active runs and removes them on release', () => {
  const coordinator = createAgentRunCoordinator({ ...limits, maxApiRuns: 2 });
  const result = coordinator.acquire({
    clientRunId: 'client-a',
    sessionId: 'session-a',
    screenId: 'screen-a',
    provider: 'providerA',
    model: 'text-model',
    runtimeKind: 'api',
  });

  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('expected lease');
  coordinator.attachRun(result.lease.leaseId, {
    runId: 'run-a',
    runManifestPath: '.sber-designer/runs/run-a/run-manifest.json',
  });

  expect(coordinator.activeRuns()).toEqual([
    expect.objectContaining({
      clientRunId: 'client-a',
      runId: 'run-a',
      status: 'running',
      runManifestPath: '.sber-designer/runs/run-a/run-manifest.json',
    }),
  ]);

  coordinator.release(result.lease.leaseId);
  expect(coordinator.activeRuns()).toEqual([]);
});

test('cancels an active run by run id or client run id', () => {
  const coordinator = createAgentRunCoordinator(limits);
  const result = coordinator.acquire({
    clientRunId: 'client-a',
    sessionId: 'session-a',
    screenId: 'screen-a',
    provider: 'codex',
    model: 'selected-model',
    runtimeKind: 'cli',
  });

  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('expected lease');
  coordinator.attachRun(result.lease.leaseId, { runId: 'run-a' });
  expect(coordinator.cancel('run-a')).toBe(true);
  expect(result.lease.controller.signal.aborted).toBe(true);
  expect(coordinator.activeRuns()[0]).toMatchObject({ status: 'stopping' });
});
