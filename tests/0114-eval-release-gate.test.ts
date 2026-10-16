import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from 'bun:test';

import {
  compareEvalScorecards,
  evalReleaseGateExitCode,
  parseEvalReleaseGateArgs,
  runEvalReleaseGate,
} from './eval/run-release-gate';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = join(TEST_DIR, 'fixtures', '0114-eval-release-gate');
const BASELINE_PATH = join(FIXTURE_ROOT, 'baseline-scorecard.json');

test('0114 B5 release gate passes a complete matrix within regression budgets', async () => {
  const report = compareEvalScorecards({
    baseline: await readJson(BASELINE_PATH),
    current: await readJson(join(FIXTURE_ROOT, 'current-pass-scorecard.json')),
    generatedAt: '2026-07-18T14:00:00.000Z',
  });

  expect(report).toMatchObject({
    status: 'passed',
    coverage: { status: 'passed', differences: [] },
    metrics: {
      languageFactFidelityScore: { delta: -0.01, status: 'passed' },
      componentReuseScore: { delta: -0.03, status: 'passed' },
      craftBlockingCount: { delta: 0, status: 'passed' },
    },
    summary: { regressions: [], insufficientData: [] },
  });
  expect(evalReleaseGateExitCode(report.status)).toBe(0);
});

test('0114 B5 release gate reports every proven quality regression', async () => {
  const report = compareEvalScorecards({
    baseline: await readJson(BASELINE_PATH),
    current: await readJson(join(FIXTURE_ROOT, 'current-regression-scorecard.json')),
  });

  expect(report.status).toBe('regression');
  expect(report.summary.regressions.sort()).toEqual(
    ['componentReuseScore', 'craftBlockingCount', 'languageFactFidelityScore'].sort(),
  );
  expect(report.metrics.languageFactFidelityScore).toMatchObject({
    delta: -0.06,
    allowedRegression: 0.02,
    status: 'regression',
  });
  expect(report.metrics.componentReuseScore.status).toBe('regression');
  expect(report.metrics.craftBlockingCount.status).toBe('regression');
  expect(evalReleaseGateExitCode(report.status)).toBe(1);
});

test('0114 B5 release gate blocks incomplete or unmeasured scorecards separately', async () => {
  const report = compareEvalScorecards({
    baseline: await readJson(BASELINE_PATH),
    current: await readJson(join(FIXTURE_ROOT, 'current-blocked-scorecard.json')),
  });

  expect(report).toMatchObject({
    status: 'blocked',
    coverage: { status: 'blocked' },
    summary: { regressions: [], insufficientData: ['languageFactFidelityScore'] },
    metrics: { languageFactFidelityScore: { status: 'insufficient_data' } },
  });
  expect(report.coverage.differences[0]).toContain('Current scorecard is incomplete');
  expect(evalReleaseGateExitCode(report.status)).toBe(2);
});

test('0114 B5 release gate writes JSON and PR-ready Markdown diff', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'sd-0114-release-gate-'));
  const result = await runEvalReleaseGate({
    baselinePath: BASELINE_PATH,
    currentPath: join(FIXTURE_ROOT, 'current-pass-scorecard.json'),
    outputDir,
    generatedAt: '2026-07-18T15:00:00.000Z',
  });
  const markdown = await readFile(result.markdownPath, 'utf8');
  const json = JSON.parse(await readFile(result.jsonPath, 'utf8')) as { status: string };

  expect(json.status).toBe('passed');
  expect(markdown).toContain('**Status: PASSED**');
  expect(markdown).toContain('| Language/fact fidelity | 0.9 | 0.89 | -0.01 | 0.02 | passed |');
  expect(
    parseEvalReleaseGateArgs([
      '--baseline',
      BASELINE_PATH,
      '--current',
      result.report.currentPath,
      '--max-reuse-drop',
      '0.03',
    ]),
  ).toMatchObject({ thresholds: { maxReuseDrop: 0.03 } });
});

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}
