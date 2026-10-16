import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, test } from 'bun:test';

import {
  runContinuationContextPath,
  updateRunContinuationContextSnapshotOnComplete,
  writeRunContinuationContextSnapshot,
} from './continuation-context';

const workspaces: string[] = [];

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function makeWorkspace(runId: string): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-continuation-'));
  workspaces.push(workspace);
  await mkdir(join(workspace, runContinuationContextPath(runId), '..'), { recursive: true });
  return workspace;
}

test('completion context preserves skipped render-health receipts', async () => {
  const runId = 'run-2026-06-06T19-08-38-700-66d5873c';
  const workspacePath = await makeWorkspace(runId);

  await writeRunContinuationContextSnapshot({
    workspacePath,
    runId,
    sessionId: 'assistant-screen-dcm2',
    screenId: 'screen-dcm2',
    messages: [{ role: 'user', content: 'Generate DCM2' }],
  });

  const snapshot = await updateRunContinuationContextSnapshotOnComplete({
    workspacePath,
    runId,
    status: 'needs_review',
    summary: 'Render not verified.',
    receipts: [
      {
        tool: 'runtime_render_health',
        status: 'skipped',
        summary: 'Storybook index returned HTTP 404.',
        changedFiles: ['src/screens/2026-06-06/DCM2.tsx'],
      },
    ],
  });

  expect(snapshot?.runStatus).toBe('needs_review');
  expect(snapshot?.lastToolCalls).toEqual([
    {
      name: 'runtime_render_health',
      status: 'skipped',
      summary: 'Storybook index returned HTTP 404.',
    },
  ]);
});
