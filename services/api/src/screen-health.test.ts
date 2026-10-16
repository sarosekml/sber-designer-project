import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import type { ProjectScreen } from '@sber-designer/shared-types';

import { annotateProjectScreensWithHealth } from './screen-health';

test('complete run with unavailable render health marks changed screen as needs-review', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-health-'));
  const runRoot = join(workspace, '.sber-designer', 'runs', 'run-1');
  await mkdir(join(runRoot, 'receipts'), { recursive: true });
  await writeFile(
    join(runRoot, 'run-manifest.json'),
    JSON.stringify({
      runId: 'run-1',
      status: 'complete',
      summary: 'Completed 14 agent turns.',
      updatedAt: 1780775279425,
      activeScreen: {
        id: 'screen-1',
        name: 'DCM2',
        storyId: 'screens-2026-06-06-dcm2--default',
        filePath: 'src/stories/screens/2026-06-06/DCM2.stories.tsx',
        implementationFilePath: 'src/screens/2026-06-06/DCM2.tsx',
      },
    }),
    'utf8',
  );
  await writeFile(
    join(runRoot, 'timeline.jsonl'),
    `${JSON.stringify({
      type: 'tool_receipt',
      tool: 'apply_patch',
      status: 'ok',
      changedFiles: ['src/screens/2026-06-06/DCM2.tsx'],
      summary: 'Updated screen implementation.',
      createdAt: 1780775279410,
    })}\n${JSON.stringify({
      type: 'tool_receipt',
      tool: 'runtime_render_health',
      status: 'skipped',
      changedFiles: [
        'src/screens/2026-06-06/DCM2.tsx',
        'src/stories/screens/2026-06-06/DCM2.stories.tsx',
      ],
      summary: 'Storybook story is not ready for render health: Storybook index returned HTTP 404.',
      createdAt: 1780775279421,
      metadata: {
        health: {
          status: 'unavailable',
          reason:
            'Storybook story is not ready for render health: Storybook index returned HTTP 404.',
          weakEvidence: true,
        },
      },
    })}\n`,
    'utf8',
  );

  const screens: ProjectScreen[] = [
    {
      id: 'screen-1',
      name: 'DCM2',
      kind: 'story',
      storyId: 'screens-2026-06-06-dcm2--default',
      filePath: 'src/stories/screens/2026-06-06/DCM2.stories.tsx',
      implementationFilePath: 'src/screens/2026-06-06/DCM2.tsx',
    },
  ];

  const annotated = await annotateProjectScreensWithHealth(workspace, screens);
  const screen = annotated[0];

  expect(screen).toBeDefined();
  expect(screen?.health).toEqual({
    status: 'needs-review',
    source: 'validation',
    updatedAt: 1780775279421,
    reason: 'Storybook story is not ready for render health: Storybook index returned HTTP 404.',
  });
});

test('complete plan-only run with unavailable render health leaves screen health unchanged', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-health-plan-'));
  const runRoot = join(workspace, '.sber-designer', 'runs', 'run-plan');
  await mkdir(join(runRoot, 'receipts'), { recursive: true });
  await writeFile(
    join(runRoot, 'run-manifest.json'),
    JSON.stringify({
      runId: 'run-plan',
      status: 'complete',
      summary: 'Plan completed without file edits.',
      updatedAt: 1780775279425,
      activeScreen: {
        id: 'screen-1',
        name: 'DCM2',
        storyId: 'screens-2026-06-06-dcm2--default',
        filePath: 'src/stories/screens/2026-06-06/DCM2.stories.tsx',
        implementationFilePath: 'src/screens/2026-06-06/DCM2.tsx',
      },
    }),
    'utf8',
  );
  await writeFile(
    join(runRoot, 'timeline.jsonl'),
    `${JSON.stringify({
      type: 'tool_receipt',
      tool: 'runtime_render_health',
      status: 'skipped',
      changedFiles: [
        'src/screens/2026-06-06/DCM2.tsx',
        'src/stories/screens/2026-06-06/DCM2.stories.tsx',
      ],
      summary: 'Plan mode did not produce renderable changes.',
      createdAt: 1780775279421,
      metadata: {
        health: {
          status: 'unavailable',
          reason: 'Plan mode did not produce renderable changes.',
          weakEvidence: true,
        },
      },
    })}\n`,
    'utf8',
  );

  const screens: ProjectScreen[] = [
    {
      id: 'screen-1',
      name: 'DCM2',
      kind: 'story',
      storyId: 'screens-2026-06-06-dcm2--default',
      filePath: 'src/stories/screens/2026-06-06/DCM2.stories.tsx',
      implementationFilePath: 'src/screens/2026-06-06/DCM2.tsx',
    },
  ];

  const annotated = await annotateProjectScreensWithHealth(workspace, screens);
  const screen = annotated[0];

  expect(screen).toBeDefined();
  expect(screen?.health).toBeUndefined();
});

test('reviewed needs-review run makes its screen ready without rewriting the run outcome', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-screen-health-reviewed-'));
  const runId = 'run-reviewed';
  const runRoot = join(workspace, '.sber-designer', 'runs', runId);
  const screenPath = 'src/screens/Reviewed.tsx';
  await mkdir(join(runRoot, 'receipts'), { recursive: true });
  await writeFile(
    join(runRoot, 'run-manifest.json'),
    JSON.stringify({
      version: 1,
      runId,
      status: 'needs_review',
      summary: 'One finding remains for human review.',
      updatedAt: 1_780_775_279_425,
      completedAt: 1_780_775_279_425,
      activeScreen: {
        id: 'screen-reviewed',
        name: 'Reviewed',
        kind: 'page',
        filePath: screenPath,
        implementationFilePath: screenPath,
      },
    }),
    'utf8',
  );
  await writeFile(
    join(runRoot, 'timeline.jsonl'),
    `${JSON.stringify({
      type: 'tool_receipt',
      tool: 'write_file',
      status: 'ok',
      changedFiles: [screenPath],
      summary: 'Updated screen.',
      createdAt: 1_780_775_279_410,
    })}\n`,
    'utf8',
  );

  const screens: ProjectScreen[] = [
    {
      id: 'screen-reviewed',
      name: 'Reviewed',
      kind: 'page',
      filePath: screenPath,
      implementationFilePath: screenPath,
    },
  ];
  const beforeReview = await annotateProjectScreensWithHealth(workspace, screens);
  expect(beforeReview[0]?.health?.status).toBe('needs-review');

  await writeFile(
    join(runRoot, 'review.json'),
    JSON.stringify({
      version: 1,
      runId,
      reviewer: ['local', 'dev'].join('-'),
      reviewedAt: '2026-07-20T15:07:32.000Z',
    }),
    'utf8',
  );

  const afterReview = await annotateProjectScreensWithHealth(workspace, beforeReview);
  expect(afterReview[0]?.health).toBeUndefined();
});
