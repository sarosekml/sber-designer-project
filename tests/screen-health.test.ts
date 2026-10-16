import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import type { ProjectScreen } from '@sber-designer/shared-types';

import { annotateProjectScreensWithHealth } from '../services/api/src/screen-health';

test('marks screens broken only from confirmed render failure evidence', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-health-'));
  const runId = 'run-2026-05-25T20-27-28-449-ebc02cb1';
  const runRoot = join(workspace, '.sber-designer', 'runs', runId);
  await mkdir(runRoot, { recursive: true });
  await writeFile(
    join(runRoot, 'run-manifest.json'),
    JSON.stringify(
      {
        version: 1,
        runId,
        route: 'chat',
        user: 'test-user',
        provider: 'mock',
        model: 'mock-model',
        projectName: 'IBP UI Kit',
        userGoal: 'Create Compliance Dashboard',
        workspacePath: workspace,
        createdAt: 1,
        updatedAt: 2,
        completedAt: 2,
        status: 'failed',
        activeScreen: null,
        assistantTaskIntent: { kind: 'new-screen' },
        summary: 'Element type is invalid: expected a string but got undefined.',
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(runRoot, 'timeline.jsonl'),
    [
      JSON.stringify({
        type: 'tool_receipt',
        runId,
        receiptId: 'receipt-a',
        tool: 'write_file',
        status: 'ok',
        changedFiles: [
          'src/stories/screens/Agent Tests/ComplianceDashboard.stories.tsx',
          'src/screens/Agent Tests/ComplianceDashboard.tsx',
        ],
        summary: 'Created generated screen files.',
        createdAt: 1,
      }),
      JSON.stringify({
        type: 'tool_receipt',
        runId,
        receiptId: 'receipt-render-failure',
        tool: 'runtime_render_health',
        status: 'error',
        changedFiles: ['src/screens/Agent Tests/ComplianceDashboard.tsx'],
        summary: 'Element type is invalid: expected a string but got undefined.',
        createdAt: 2,
      }),
      JSON.stringify({
        type: 'run_failed',
        runId,
        status: 'failed',
        summary: 'Element type is invalid: expected a string but got undefined.',
        createdAt: 3,
      }),
    ].join('\n') + '\n',
    'utf8',
  );

  const screens: ProjectScreen[] = [
    {
      id: 'screen-compliance',
      name: 'Compliance Dashboard',
      kind: 'story',
      storyId: 'screens-agent-tests-compliance-dashboard--default',
      filePath: 'src/stories/screens/Agent Tests/ComplianceDashboard.stories.tsx',
      implementationFilePath: 'src/screens/Agent Tests/ComplianceDashboard.tsx',
      folder: 'Agent Tests',
    },
    {
      id: 'screen-risk',
      name: 'Risk metrics',
      kind: 'story',
      storyId: 'screens-2026-05-29-risk-metrics--default',
      filePath: 'src/stories/screens/2026-05-29/RiskMetrics.stories.tsx',
      implementationFilePath: 'src/screens/2026-05-29/RiskMetrics.tsx',
      folder: '2026-05-29',
    },
  ];

  const annotated = await annotateProjectScreensWithHealth(workspace, screens);

  expect(annotated[0]?.health).toMatchObject({
    status: 'broken',
    source: 'validation',
  });
  expect(annotated[0]?.health?.reason).toContain('Element type is invalid');
  expect(annotated[1]?.health).toBeUndefined();
});

test('marks changed files needs-review when a failed run has no render failure evidence', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-health-'));
  const runId = 'run-failed-no-render-evidence';

  await writeRunManifest(workspace, runId, {
    status: 'failed',
    completedAt: 30,
    summary: 'External runtime produced no changes in allowed target files.',
  });
  await writeTimeline(workspace, runId, [
    {
      type: 'tool_receipt',
      tool: 'write_file',
      status: 'ok',
      changedFiles: ['src/screens/Dev-test/RiskMetrics.tsx'],
      summary: 'Edited implementation before failing.',
      createdAt: 29,
    },
  ]);

  const annotated = await annotateProjectScreensWithHealth(workspace, [
    {
      id: 'screen-risk',
      name: 'Risk-metrics',
      kind: 'story',
      storyId: 'screens-dev-test-risk-metrics--default',
      filePath: 'src/stories/screens/Dev-test/RiskMetrics.stories.tsx',
      implementationFilePath: 'src/screens/Dev-test/RiskMetrics.tsx',
    },
  ]);

  expect(annotated[0]?.health).toMatchObject({
    status: 'needs-review',
    source: 'validation',
  });
  expect(annotated[0]?.health?.reason).toContain('External runtime produced no changes');
});

test('clears stale failed-run health when a newer render-ok run changed the same screen', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-health-'));
  const failedRun = 'run-old-failed';
  const okRun = 'run-new-ok';

  await writeRunManifest(workspace, failedRun, {
    status: 'failed',
    completedAt: 10,
    summary: 'Old failure.',
  });
  await writeTimeline(workspace, failedRun, [
    {
      type: 'tool_receipt',
      tool: 'write_file',
      status: 'ok',
      changedFiles: ['src/screens/Dev-test/RiskMetrics.tsx'],
      summary: 'Updated screen.',
    },
  ]);

  await writeRunManifest(workspace, okRun, {
    status: 'complete',
    completedAt: 20,
    summary: 'New render-ok run.',
  });
  await writeTimeline(workspace, okRun, [
    {
      type: 'tool_receipt',
      tool: 'runtime_render_health',
      status: 'ok',
      changedFiles: ['src/screens/Dev-test/RiskMetrics.tsx'],
      summary: 'Canvas rendered a screen root without runtime error evidence.',
    },
  ]);

  const annotated = await annotateProjectScreensWithHealth(workspace, [
    {
      id: 'screen-risk',
      name: 'Risk-metrics',
      kind: 'story',
      storyId: 'screens-dev-test-risk-metrics--default',
      filePath: 'src/stories/screens/Dev-test/RiskMetrics.stories.tsx',
      implementationFilePath: 'src/screens/Dev-test/RiskMetrics.tsx',
      health: {
        status: 'broken',
        reason: 'Old persisted failure.',
        source: 'failed-run',
      },
    },
  ]);

  expect(annotated[0]?.health).toBeUndefined();
});

test('clears stale failed-run health when a newer complete run lacks render evidence', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-health-'));
  const failedRun = 'run-old-failed';
  const completeRun = 'run-new-complete-no-render';

  await writeRunManifest(workspace, failedRun, {
    status: 'failed',
    completedAt: 10,
    summary: 'Old failure.',
  });
  await writeTimeline(workspace, failedRun, [
    {
      type: 'tool_receipt',
      tool: 'write_file',
      status: 'ok',
      changedFiles: ['src/screens/Dev-test/RiskMetrics.tsx'],
      summary: 'Updated screen.',
      createdAt: 9,
    },
  ]);

  await writeRunManifest(workspace, completeRun, {
    status: 'complete',
    completedAt: 20,
    summary: 'Completed 6 agent turns.',
  });
  await writeTimeline(workspace, completeRun, [
    {
      type: 'tool_receipt',
      tool: 'apply_patch',
      status: 'ok',
      changedFiles: ['src/screens/Dev-test/RiskMetrics.tsx'],
      summary: 'Applied 1 AST operation.',
      createdAt: 19,
    },
    {
      type: 'run_completed',
      runId: completeRun,
      status: 'complete',
      summary: 'Completed 6 agent turns.',
      createdAt: 20,
    },
  ]);

  const annotated = await annotateProjectScreensWithHealth(workspace, [
    {
      id: 'screen-risk',
      name: 'Risk-metrics',
      kind: 'story',
      storyId: 'screens-dev-test-risk-metrics--default',
      filePath: 'src/stories/screens/Dev-test/RiskMetrics.stories.tsx',
      implementationFilePath: 'src/screens/Dev-test/RiskMetrics.tsx',
      health: {
        status: 'broken',
        reason: 'Old persisted failure.',
        source: 'failed-run',
      },
    },
  ]);

  expect(annotated[0]?.health).toBeUndefined();
});

test('assigns needs-review state for skipped render-health evidence', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-health-'));
  const runId = 'run-render-health-skipped';

  await writeRunManifest(workspace, runId, {
    status: 'complete',
    completedAt: 50,
    summary: 'Completed with unavailable verifier.',
  });
  await writeTimeline(workspace, runId, [
    {
      type: 'tool_receipt',
      tool: 'runtime_render_health',
      status: 'skipped',
      changedFiles: ['src/screens/Dev-test/RiskMetrics.tsx'],
      summary: 'SBER_DESIGNER_CHROME_DEBUGGING_URL is not configured.',
      createdAt: 50,
    },
  ]);

  const annotated = await annotateProjectScreensWithHealth(workspace, [
    {
      id: 'screen-risk',
      name: 'Risk-metrics',
      kind: 'story',
      storyId: 'screens-dev-test-risk-metrics--default',
      filePath: 'src/stories/screens/Dev-test/RiskMetrics.stories.tsx',
      implementationFilePath: 'src/screens/Dev-test/RiskMetrics.tsx',
    },
  ]);

  expect(annotated[0]?.health).toEqual({
    status: 'needs-review',
    reason: 'SBER_DESIGNER_CHROME_DEBUGGING_URL is not configured.',
    source: 'validation',
    updatedAt: 50,
  });
});

test('assigns broken state for root-missing render-health evidence', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-health-'));
  const runId = 'run-render-health-warning';

  await writeRunManifest(workspace, runId, {
    status: 'complete',
    completedAt: 55,
    summary: 'Completed with a static Storybook fallback warning.',
  });
  await writeTimeline(workspace, runId, [
    {
      type: 'tool_receipt',
      tool: 'runtime_render_health',
      status: 'skipped',
      changedFiles: ['src/screens/Dev-test/RiskMetrics.tsx'],
      summary: 'No data-sd-screen-root was found, but Storybook returned non-empty content.',
      metadata: {
        health: {
          status: 'failed',
          reasonCode: 'screen_root_missing',
          reason: 'No data-sd-screen-root was found, but Storybook returned non-empty content.',
        },
      },
      createdAt: 55,
    },
  ]);

  const annotated = await annotateProjectScreensWithHealth(workspace, [
    {
      id: 'screen-risk',
      name: 'Risk-metrics',
      kind: 'story',
      storyId: 'screens-dev-test-risk-metrics--default',
      filePath: 'src/stories/screens/Dev-test/RiskMetrics.stories.tsx',
      implementationFilePath: 'src/screens/Dev-test/RiskMetrics.tsx',
      health: {
        status: 'broken',
        reason: 'Old persisted failure.',
        source: 'failed-run',
      },
    },
  ]);

  expect(annotated[0]?.health).toEqual({
    status: 'broken',
    reason: 'No data-sd-screen-root was found, but Storybook returned non-empty content.',
    source: 'validation',
    updatedAt: 55,
  });
});

test('assigns needs-review state for unproven runtime-root evidence', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-health-'));
  const runId = 'run-render-health-root-unproven';

  await writeRunManifest(workspace, runId, {
    status: 'needs_review',
    completedAt: 56,
    summary: 'Screen updated — runtime proof pending.',
  });
  await writeTimeline(workspace, runId, [
    {
      type: 'tool_receipt',
      tool: 'runtime_render_health',
      status: 'skipped',
      changedFiles: ['src/screens/Dev-test/RiskMetrics.tsx'],
      summary:
        'Runtime screen root was not proven because HTTP Storybook fallback cannot execute preview JavaScript.',
      metadata: {
        health: {
          status: 'warning',
          reasonCode: 'runtime_root_unproven',
          reason:
            'Runtime screen root was not proven because HTTP Storybook fallback cannot execute preview JavaScript.',
          weakEvidence: true,
        },
      },
      createdAt: 56,
    },
  ]);

  const annotated = await annotateProjectScreensWithHealth(workspace, [
    {
      id: 'screen-risk',
      name: 'Risk-metrics',
      kind: 'story',
      storyId: 'screens-dev-test-risk-metrics--default',
      filePath: 'src/stories/screens/Dev-test/RiskMetrics.stories.tsx',
      implementationFilePath: 'src/screens/Dev-test/RiskMetrics.tsx',
      health: {
        status: 'broken',
        reason: 'Old persisted failure.',
        source: 'failed-run',
      },
    },
  ]);

  expect(annotated[0]?.health).toEqual({
    status: 'needs-review',
    reason:
      'Runtime screen root was not proven because HTTP Storybook fallback cannot execute preview JavaScript.',
    source: 'validation',
    updatedAt: 56,
  });
});

test('closed-contour skipped verifier fixture does not mark the screen broken', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-health-'));
  const fixtureRoot = join(import.meta.dir, 'fixtures', 'agent-runs', '2026-06-03-closed-contour');
  const runId = 'run-2026-06-03T13-31-40-463-d99b2678';
  const runRoot = join(workspace, '.sber-designer', 'runs', runId);
  await mkdir(runRoot, { recursive: true });
  const { readFile } = await import('node:fs/promises');
  await writeFile(
    join(runRoot, 'run-manifest.json'),
    await readFile(join(fixtureRoot, 'run-manifest.failed-no-target-change.json'), 'utf8'),
    'utf8',
  );
  await writeFile(
    join(runRoot, 'timeline.jsonl'),
    await readFile(join(fixtureRoot, 'timeline.failed-no-target-change.jsonl'), 'utf8'),
    'utf8',
  );

  const annotated = await annotateProjectScreensWithHealth(workspace, [
    {
      id: 'screen-administration',
      name: 'Administration-deepseek-md',
      kind: 'story',
      storyId: 'screens-2026-06-01-administration-deepseek-md--default',
      filePath: 'src/stories/screens/2026-06-01/AdministrationDeepseekMd.stories.tsx',
      implementationFilePath: 'src/screens/2026-06-01/AdministrationDeepseekMd.tsx',
      folder: 'Dev-test',
    },
  ]);

  expect(annotated[0]?.health).toBeUndefined();
});

test('does not mark a screen broken for a failed preflight run with no mutation evidence', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-health-'));
  const runId = 'run-image-preflight-failed';

  await writeRunManifest(workspace, runId, {
    status: 'failed',
    completedAt: 30,
    summary: 'Model is not marked as supporting image input.',
    activeScreen: {
      filePath: 'src/stories/screens/2026-05-31/AdministrationFromImg.stories.tsx',
      implementationFilePath: 'src/screens/2026-05-31/AdministrationFromImg.tsx',
    },
  });
  await writeTimeline(workspace, runId, [
    {
      type: 'run_completed',
      runId,
      status: 'failed',
      summary: 'Model is not marked as supporting image input.',
      createdAt: 30,
    },
  ]);

  const annotated = await annotateProjectScreensWithHealth(workspace, [
    {
      id: 'screen-from-image',
      name: 'Administration from image',
      kind: 'story',
      storyId: 'screens-2026-05-31-administration-from-img--default',
      filePath: 'src/stories/screens/2026-05-31/AdministrationFromImg.stories.tsx',
      implementationFilePath: 'src/screens/2026-05-31/AdministrationFromImg.tsx',
    },
  ]);

  expect(annotated[0]?.health).toBeUndefined();
});

test('keeps a newer manual screen health override over run evidence', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-health-'));
  const runId = 'run-new-failed';

  await writeRunManifest(workspace, runId, {
    status: 'failed',
    completedAt: 20,
    summary: 'Runtime failure.',
  });
  await writeTimeline(workspace, runId, [
    {
      type: 'tool_receipt',
      tool: 'write_file',
      status: 'ok',
      changedFiles: ['src/screens/Dev-test/RiskMetrics.tsx'],
      createdAt: 19,
    },
  ]);

  const annotated = await annotateProjectScreensWithHealth(workspace, [
    {
      id: 'screen-risk',
      name: 'Risk-metrics',
      kind: 'story',
      storyId: 'screens-dev-test-risk-metrics--default',
      filePath: 'src/stories/screens/Dev-test/RiskMetrics.stories.tsx',
      implementationFilePath: 'src/screens/Dev-test/RiskMetrics.tsx',
      health: {
        status: 'ok',
        reason: 'Reviewed manually.',
        source: 'manual',
        updatedAt: 30,
      },
    },
  ]);

  expect(annotated[0]?.health).toMatchObject({
    status: 'ok',
    source: 'manual',
    reason: 'Reviewed manually.',
  });
});

test('lets newer run evidence replace a stale manual screen health override', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-health-'));
  const runId = 'run-new-failed';

  await writeRunManifest(workspace, runId, {
    status: 'failed',
    completedAt: 40,
    summary: 'Runtime failure.',
  });
  await writeTimeline(workspace, runId, [
    {
      type: 'tool_receipt',
      tool: 'runtime_render_health',
      status: 'error',
      changedFiles: ['src/screens/Dev-test/RiskMetrics.tsx'],
      summary: 'Cannot find module ./MissingWidget',
      createdAt: 39,
    },
  ]);

  const annotated = await annotateProjectScreensWithHealth(workspace, [
    {
      id: 'screen-risk',
      name: 'Risk-metrics',
      kind: 'story',
      storyId: 'screens-dev-test-risk-metrics--default',
      filePath: 'src/stories/screens/Dev-test/RiskMetrics.stories.tsx',
      implementationFilePath: 'src/screens/Dev-test/RiskMetrics.tsx',
      health: {
        status: 'ok',
        reason: 'Reviewed manually.',
        source: 'manual',
        updatedAt: 30,
      },
    },
  ]);

  expect(annotated[0]?.health).toMatchObject({
    status: 'broken',
    source: 'validation',
  });
});

async function writeRunManifest(workspace: string, runId: string, patch: Record<string, unknown>) {
  const runRoot = join(workspace, '.sber-designer', 'runs', runId);
  await mkdir(runRoot, { recursive: true });
  await writeFile(
    join(runRoot, 'run-manifest.json'),
    JSON.stringify(
      {
        version: 1,
        runId,
        route: 'chat-stream',
        user: 'test-user',
        provider: 'mock',
        model: 'mock-model',
        projectName: 'IBP UI Kit',
        userGoal: 'test',
        workspacePath: workspace,
        createdAt: 1,
        updatedAt: patch.completedAt ?? 1,
        activeScreen: {
          id: 'screen-risk',
          name: 'Risk-metrics',
          kind: 'story',
          storyId: 'screens-dev-test-risk-metrics--default',
          filePath: 'src/stories/screens/Dev-test/RiskMetrics.stories.tsx',
          implementationFilePath: 'src/screens/Dev-test/RiskMetrics.tsx',
        },
        assistantTaskIntent: null,
        ...patch,
      },
      null,
      2,
    ),
    'utf8',
  );
}

async function writeTimeline(workspace: string, runId: string, events: unknown[]) {
  await writeFile(
    join(workspace, '.sber-designer', 'runs', runId, 'timeline.jsonl'),
    events.map((event) => JSON.stringify(event)).join('\n') + '\n',
    'utf8',
  );
}
