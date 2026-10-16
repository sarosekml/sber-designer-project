import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { expect, test } from 'bun:test';
import {
  PREFERENCE_EVENTS_PATH,
  RUN_FEEDBACK_FILE,
} from '../services/api/src/agent/run-record/feedback';
import { RUNS_DATASET_PATH } from '../services/api/src/agent/run-record/dataset';
import { PROJECT_PREFERENCES_PATH } from '../services/api/src/project-preferences';
import { completeAgentRun, createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { agentRunsRouter } from '../services/api/src/routes/agent-runs';
import { patchState, resetState } from '../services/api/src/state-store';

test('0114 B5 run feedback persists, updates the dataset row, and emits B4 raw events', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-0114-run-feedback-'));
  resetState();
  patchState({ workspacePath });
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock',
    model: 'mock-model',
    workspacePath,
    activeScreen: {
      id: 'screen-feedback',
      name: 'Feedback screen',
      kind: 'page',
      filePath: 'src/screens/Feedback.tsx',
      implementationFilePath: 'src/screens/Feedback.tsx',
    },
  });
  await completeAgentRun({
    workspacePath,
    runId: run.runId,
    status: 'complete',
    metrics: { iterations: 1, inputTokens: 100, outputTokens: 20 },
  });
  const app = new Hono().route('/api/agent-runs', agentRunsRouter);

  const first = await saveFeedback(app, run.runId, {
    rating: 'up',
    reason: 'Good component reuse',
  });
  expect(first.status).toBe(200);
  expect(await first.json()).toMatchObject({
    feedback: {
      runId: run.runId,
      rating: 'up',
      reason: 'Good component reuse',
    },
  });

  const loaded = await app.request(`/api/agent-runs/${run.runId}/feedback`);
  expect(loaded.status).toBe(200);
  expect(await loaded.json()).toMatchObject({
    feedback: { rating: 'up', reason: 'Good component reuse' },
  });
  expect(
    JSON.parse(
      await readFile(
        join(workspacePath, '.sber-designer', 'runs', run.runId, RUN_FEEDBACK_FILE),
        'utf8',
      ),
    ),
  ).toMatchObject({ rating: 'up', reason: 'Good component reuse' });

  await saveFeedback(app, run.runId, { rating: 'up', reason: 'Good component reuse' });
  await saveFeedback(app, run.runId, { rating: 'down', reason: 'Spacing needs work' });

  const datasetRows = jsonLines(await readFile(join(workspacePath, RUNS_DATASET_PATH), 'utf8'));
  expect(datasetRows).toHaveLength(1);
  expect(datasetRows[0]).toMatchObject({
    run_id: run.runId,
    feedback: { rating: 'down', reason: 'Spacing needs work' },
  });
  const events = jsonLines(await readFile(join(workspacePath, PREFERENCE_EVENTS_PATH), 'utf8'));
  expect(events).toHaveLength(2);
  expect(events).toEqual([
    expect.objectContaining({
      type: 'run_feedback',
      run_id: run.runId,
      sentiment: 'accept',
      reason: 'Good component reuse',
      screen_id: 'screen-feedback',
    }),
    expect.objectContaining({
      type: 'run_feedback',
      run_id: run.runId,
      sentiment: 'reject',
      reason: 'Spacing needs work',
      screen_id: 'screen-feedback',
    }),
  ]);
  const preferences = await readFile(join(workspacePath, PROJECT_PREFERENCES_PATH), 'utf8');
  expect(preferences).toContain('### Avoid');
  expect(preferences).toContain('Spacing needs work');
  expect(preferences).not.toContain('Good component reuse');
});

test('0114 B5 feedback rejects running runs and oversized reasons', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-0114-run-feedback-guard-'));
  resetState();
  patchState({ workspacePath });
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    workspacePath,
  });
  const app = new Hono().route('/api/agent-runs', agentRunsRouter);

  const running = await saveFeedback(app, run.runId, { rating: 'down', reason: 'Not done' });
  expect(running.status).toBe(409);
  expect(await running.json()).toMatchObject({ error: 'run_not_terminal' });

  const oversized = await saveFeedback(app, run.runId, {
    rating: 'down',
    reason: 'x'.repeat(241),
  });
  expect(oversized.status).toBe(400);
  expect(await oversized.json()).toMatchObject({ error: 'invalid_input' });
});

function saveFeedback(app: Hono, runId: string, body: { rating: 'up' | 'down'; reason: string }) {
  return app.request(`/api/agent-runs/${runId}/feedback`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function jsonLines(contents: string): Array<Record<string, unknown>> {
  return contents
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}
