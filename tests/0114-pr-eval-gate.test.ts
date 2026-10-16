import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from 'bun:test';

import { parsePrEvalGateArgs, prEvalGateExitCode, runPrEvalGate } from './eval/run-pr-release-gate';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SCORECARD_FIXTURES = join(TEST_DIR, 'fixtures', '0114-eval-release-gate');

test('0114 B5 PR gate ignores changes outside protected prompt and craft paths', async () => {
  const result = await runPrEvalGate({
    changedFiles: ['docs/README.md', 'apps/web/src/components/ui/button.tsx'],
    generatedAt: '2026-07-18T16:00:00.000Z',
  });

  expect(result.report).toMatchObject({
    status: 'not_required',
    entries: [],
    summary: { matchedEntries: 0, passed: 0, regressions: 0, blocked: 0 },
  });
  expect(prEvalGateExitCode(result.report.status)).toBe(0);
});

test('0114 B5 shipped active gate requires a current scorecard for protected changes', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'sd-0114-pr-gate-active-'));
  const result = await runPrEvalGate({
    changedFiles: ['packages/agent-kit/kit/skills/product-screen-generation/SKILL.md'],
    outputDir,
    generatedAt: '2026-07-18T16:10:00.000Z',
  });

  expect(result.report).toMatchObject({
    status: 'blocked',
    entries: [
      {
        id: 'screen-generation-main',
        status: 'blocked',
        matchedFiles: ['packages/agent-kit/kit/skills/product-screen-generation/SKILL.md'],
        baselineScorecard: 'tests/eval/baselines/screen-generation-main/v1/scorecard.json',
      },
    ],
  });
  expect(result.report.entries[0]?.detail).toContain('must be added or updated in this PR');
  expect(prEvalGateExitCode(result.report.status)).toBe(2);
  expect(await readFile(result.markdownPath, 'utf8')).toContain('**Status: BLOCKED**');
});

test('0114 B5 PR gate executes every active comparator and propagates regression', async () => {
  const passing = await activeGateWorkspace('current-pass-scorecard.json');
  const stale = await runPrEvalGate({
    workspaceRoot: passing.workspace,
    changedFiles: ['services/api/src/prompt-builder.ts'],
    outputDir: join(passing.workspace, 'stale-output'),
  });
  expect(stale.report).toMatchObject({ status: 'blocked', entries: [{ status: 'blocked' }] });
  expect(stale.report.entries[0]?.detail).toContain('must be added or updated in this PR');

  const passed = await runPrEvalGate({
    workspaceRoot: passing.workspace,
    changedFiles: [
      'services/api/src/prompt-builder.ts',
      'tests/eval/candidates/screen-generation-main/scorecard.json',
    ],
    outputDir: passing.output,
    generatedAt: '2026-07-18T16:20:00.000Z',
  });
  expect(passed.report).toMatchObject({
    status: 'passed',
    entries: [
      {
        id: 'screen-generation-main',
        status: 'passed',
        evalDiffJson: 'entries/screen-generation-main/eval-diff.json',
        evalDiffMarkdown: 'entries/screen-generation-main/eval-diff.md',
      },
    ],
  });

  const regressing = await activeGateWorkspace('current-regression-scorecard.json');
  const regression = await runPrEvalGate({
    workspaceRoot: regressing.workspace,
    changedFiles: [
      'services/api/src/prompt-builder.ts',
      'tests/eval/candidates/screen-generation-main/scorecard.json',
    ],
    outputDir: regressing.output,
  });
  expect(regression.report).toMatchObject({
    status: 'regression',
    summary: { regressions: 1 },
  });
  expect(regression.report.entries[0]?.detail).toContain('languageFactFidelityScore');
  expect(prEvalGateExitCode(regression.report.status)).toBe(1);
});

test('0114 B5 PR gate blocks an active entry when its current scorecard is absent', async () => {
  const fixture = await activeGateWorkspace(null);
  const result = await runPrEvalGate({
    workspaceRoot: fixture.workspace,
    changedFiles: [
      'packages/agent-kit/kit/knowledge/craft/layout-spacing.md',
      'tests/eval/candidates/screen-generation-main/scorecard.json',
    ],
    outputDir: fixture.output,
  });

  expect(result.report).toMatchObject({
    status: 'blocked',
    entries: [
      {
        status: 'blocked',
        currentScorecard: 'tests/eval/candidates/screen-generation-main/scorecard.json',
      },
    ],
  });
  expect(result.report.entries[0]?.detail).toContain(
    'tests/eval/candidates/screen-generation-main/scorecard.json',
  );
  expect(
    parsePrEvalGateArgs(['--changed-files', '/tmp/changed.txt', '--output', '/tmp/eval-gate']),
  ).toEqual({ changedFilesPath: '/tmp/changed.txt', outputDir: '/tmp/eval-gate' });
});

test('0114 B5 CI evaluates the full pull-request diff and always publishes gate evidence', async () => {
  const workflow = await readFile(join(TEST_DIR, '..', '.github', 'workflows', 'ci.yml'), 'utf8');

  expect(workflow).toContain('eval-release-gate:');
  expect(workflow).toContain('fetch-depth: 0');
  expect(workflow).toContain('git diff --name-only "$BASE_SHA" "$HEAD_SHA"');
  expect(workflow).toContain('bun run eval:pr-gate');
  expect(workflow).toContain('if: always()');
  expect(workflow).toContain('pr-eval-release-gate-${{ github.event.pull_request.number }}');
});

async function activeGateWorkspace(currentFixture: string | null): Promise<{
  workspace: string;
  output: string;
}> {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-0114-active-pr-gate-'));
  const output = join(workspace, 'out');
  const baselinePath = join(
    workspace,
    'tests',
    'eval',
    'baselines',
    'screen-generation-main',
    'v1',
    'scorecard.json',
  );
  const currentPath = join(
    workspace,
    'tests',
    'eval',
    'candidates',
    'screen-generation-main',
    'scorecard.json',
  );
  await mkdir(dirname(baselinePath), { recursive: true });
  await mkdir(dirname(currentPath), { recursive: true });
  await copyFile(join(SCORECARD_FIXTURES, 'baseline-scorecard.json'), baselinePath);
  if (currentFixture) {
    await copyFile(join(SCORECARD_FIXTURES, currentFixture), currentPath);
  }
  await writeFile(
    join(workspace, 'tests', 'eval', 'baselines', 'manifest.json'),
    `${JSON.stringify(
      {
        version: 1,
        entries: [
          {
            id: 'screen-generation-main',
            description: 'Test active gate.',
            status: 'active',
            baselineScorecard: 'tests/eval/baselines/screen-generation-main/v1/scorecard.json',
            currentScorecard: 'tests/eval/candidates/screen-generation-main/scorecard.json',
            appliesTo: [
              'packages/agent-kit/kit/knowledge/craft/**',
              'services/api/src/prompt-builder.ts',
            ],
            thresholds: {
              maxFidelityDrop: 0.02,
              maxReuseDrop: 0.05,
              maxCraftIncrease: 0,
            },
          },
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  return { workspace, output };
}
