import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, test } from 'bun:test';
import { DESIGN_INDEX_PATHS } from '../packages/design-indexer/src';
import { RUNS_DATASET_PATH } from '../services/api/src/agent/run-record/dataset';
import { completeAgentRun, createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { recordToolReceipt } from '../services/api/src/agent/run-record/receipts';

test('0114 B5 completion appends one normalized dataset row with quality and token metrics', async () => {
  const workspace = await datasetWorkspace();
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'mock-api',
    model: 'mock-model',
    runtimeKind: 'api',
    projectName: 'Dataset project',
    workspacePath: workspace,
    activeScreen: {
      id: 'screen-dashboard',
      name: 'Dashboard',
      kind: 'story',
      storyId: 'screens-dashboard--default',
      filePath: 'src/stories/Dashboard.stories.tsx',
      implementationFilePath: 'src/screens/Dashboard.tsx',
    },
  });

  await recordToolReceipt({
    workspacePath: workspace,
    runId: run.runId,
    tool: 'validate_screen_craft',
    status: 'ok',
    changedFiles: ['src/screens/Dashboard.tsx'],
    metadata: {
      status: 'findings',
      blocking: 0,
      shouldFix: 2,
      advisory: 1,
      categoryResults: {
        sourceIntegrity: { status: 'passed' },
        designSystemFit: { status: 'findings' },
        designModeCompatibility: { status: 'passed' },
      },
      componentReuse: {
        expected: ['Button', 'Table', 'Badge'],
        used: ['Button', 'Table'],
        missing: ['Badge'],
        exact: ['Button', 'Table'],
        score: { earned: 2.5, total: 3, label: '2.5/3' },
      },
    },
  });
  await recordToolReceipt({
    workspacePath: workspace,
    runId: run.runId,
    tool: 'jury_round',
    status: 'ok',
    changedFiles: ['src/screens/Dashboard.tsx'],
    metadata: { juryComposite: 8.6 },
  });

  await completeAgentRun({
    workspacePath: workspace,
    runId: run.runId,
    status: 'needs_review',
    summary: 'Screen is valid but needs a visual review.',
    metrics: { iterations: 2, inputTokens: 1_000, outputTokens: 200 },
    diagnostics: {
      designJury: {
        status: 'passed',
        threshold: 8,
        rounds: 1,
        revisionAttempted: false,
        juryComposite: 8.6,
      },
      renderProof: {
        status: 'pending',
        attempt: 1,
        checkedAt: '2026-07-18T00:00:00.000Z',
        reason: 'Browser evidence pending.',
      },
    },
  });
  await completeAgentRun({
    workspacePath: workspace,
    runId: run.runId,
    status: 'needs_review',
    summary: 'Repeated finalization must not duplicate the dataset row.',
  });

  const rows = await datasetRows(workspace);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    version: 1,
    run_id: run.runId,
    status: 'needs_review',
    route: 'chat-stream',
    provider: 'mock-api',
    model: 'mock-model',
    runtime_kind: 'api',
    project_name: 'Dataset project',
    profile: 'react-storybook',
    screen_id: 'screen-dashboard',
    screen_name: 'Dashboard',
    gates: {
      craft: 'findings',
      render: 'pending',
      source_integrity: 'passed',
      design_system_fit: 'findings',
      design_mode_compatibility: 'passed',
    },
    reuse: {
      ratio: 0.8333,
      earned: 2.5,
      total: 3,
      label: '2.5/3',
      expected: 3,
      used: 2,
      missing: 1,
    },
    craft_blocking: 0,
    jury_composite: 8.6,
    token_usage: { total: 1_200, input: 1_000, output: 200, iterations: 2 },
  });
  expect(Date.parse(rows[0]!.started_at as string)).not.toBeNaN();
  expect(Date.parse(rows[0]!.completed_at as string)).not.toBeNaN();
});

test('0114 B5 dataset keeps unavailable quality and partial token fields null', async () => {
  const workspace = await datasetWorkspace();
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'external-cli',
    model: 'unknown',
    runtimeKind: 'cli',
    workspacePath: workspace,
  });

  await completeAgentRun({
    workspacePath: workspace,
    runId: run.runId,
    status: 'complete',
    metrics: { iterations: 1, inputTokens: 700 },
  });

  expect((await datasetRows(workspace))[0]).toMatchObject({
    craft_blocking: null,
    jury_composite: null,
    reuse: null,
    token_usage: { total: null, input: 700, output: null, iterations: 1 },
  });
});

async function datasetWorkspace(): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0114-runs-dataset-'));
  const profilePath = join(workspace, DESIGN_INDEX_PATHS.projectProfile);
  await mkdir(dirname(profilePath), { recursive: true });
  await writeFile(
    profilePath,
    JSON.stringify({
      kind: 'react-storybook',
      screenUnit: {
        sourceGlob: 'src/screens/**/*.tsx',
        storyRequired: true,
        rootMarker: 'data-sd-screen-root',
      },
      componentModel: 'react-index',
      renderProbe: 'storybook',
    }),
  );
  return workspace;
}

async function datasetRows(workspace: string): Promise<Array<Record<string, unknown>>> {
  return (await readFile(join(workspace, RUNS_DATASET_PATH), 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}
