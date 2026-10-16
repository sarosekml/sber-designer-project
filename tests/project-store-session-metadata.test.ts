/**
 * Regression: creating a screen failed with a Zod `unrecognized_keys` error at
 * `assistant.sessions[N].metadata` because the web store had started writing
 * run-provenance keys (lastComponentReuse / lastRunMetrics /
 * lastContinuationContextPath) that the strict() persistence schema did not
 * know about. Any project save — including unrelated ones like adding a screen —
 * then hard-failed. Session-metadata provenance must be tolerated.
 */
import { expect, test } from 'bun:test';

import { ProjectSchema } from '../services/api/src/project-store';

function projectWithSessionMetadata(metadata: Record<string, unknown>) {
  return {
    version: 1 as const,
    name: 'ibp-ui-kit',
    workspacePath: '/tmp/ibp-ui-kit',
    assistant: {
      sessions: [
        {
          id: 'session-43',
          title: 'Describe Paper',
          primaryScreenId: 'screen-1',
          status: 'active' as const,
          messages: [],
          createdAt: '2026-06-24T18:53:05.205Z',
          updatedAt: '2026-06-24T18:53:05.205Z',
          metadata,
        },
      ],
    },
  };
}

test('accepts run-provenance metadata the web store now writes', () => {
  const result = ProjectSchema.safeParse(
    projectWithSessionMetadata({
      lastRunStatus: 'preflight_rejected',
      lastRunErrorCode: 'invalid_request_error',
      lastContinuationContextPath: '/tmp/continuation.json',
      lastComponentReuse: { reused: 3, total: 5 },
      lastRunMetrics: { startedAt: 1, completedAt: 2 },
    }),
  );
  expect(result.success).toBe(true);
});

test('tolerates additive provenance keys so future drift never blocks a save', () => {
  const result = ProjectSchema.safeParse(
    projectWithSessionMetadata({ someFutureRunProvenanceKey: 'value' }),
  );
  expect(result.success).toBe(true);
});

test('accepts nullable run provenance written by the web assistant store', () => {
  const result = ProjectSchema.safeParse(
    projectWithSessionMetadata({
      lastAttemptId: null,
      lastDebugLogPath: null,
      lastRunManifestPath: null,
      lastRunStatus: null,
      lastRunSummary: null,
      lastRunErrorCode: null,
      lastContinuationContextPath: null,
      lastBlockingRun: null,
      lastComponentReuse: null,
      lastRunMetrics: null,
    }),
  );
  expect(result.success).toBe(true);
});

test('strips malformed known run provenance instead of blocking unrelated saves', () => {
  const result = ProjectSchema.safeParse(
    projectWithSessionMetadata({
      lastAttemptId: '',
      lastDebugLogPath: 42,
      lastRunManifestPath: false,
      lastRunStatus: 'stuck',
      lastRunSummary: null,
      lastRunErrorCode: null,
      someFutureRunProvenanceKey: 'value',
    }),
  );
  expect(result.success).toBe(true);
  if (!result.success) return;

  const metadata = result.data.assistant.sessions[0]?.metadata as Record<string, unknown>;
  expect(metadata.lastAttemptId).toBeUndefined();
  expect(metadata.lastDebugLogPath).toBeUndefined();
  expect(metadata.lastRunManifestPath).toBeUndefined();
  expect(metadata.lastRunStatus).toBeUndefined();
  expect(metadata.lastRunSummary).toBeNull();
  expect(metadata.lastRunErrorCode).toBeNull();
  expect(metadata.someFutureRunProvenanceKey).toBe('value');
});
