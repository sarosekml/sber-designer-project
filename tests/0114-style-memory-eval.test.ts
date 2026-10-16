import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { runStyleMemoryEval } from './eval/run-style-memory-eval';

test('0114 B4 deterministic eval feeds two density corrections into the third run context', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'sd-0114-style-memory-output-'));
  const result = await runStyleMemoryEval({
    outputDir,
    createdAt: '2026-07-18T20:00:00.000Z',
  });

  expect(result.record).toMatchObject({
    version: 1,
    id: '0114-style-memory-2026-07-18T20-00-00-000Z',
    status: 'passed',
    expectedRule: 'Use denser screen layouts.',
    checks: {
      twoDensityFollowUpEvents: true,
      mediumPreferenceDerived: true,
      apiGenerationPromptContainsRule: true,
      cliGenerationPromptContainsRule: true,
      cliStableDigestChanged: true,
    },
    evidence: {
      rawEventCount: 2,
      derivedConfidence: 'medium',
    },
  });
  expect(result.record.baselineRunIds).toHaveLength(2);
  expect(result.record.followUpRunIds).toHaveLength(2);
  expect(result.scorecard.totals).toEqual({ scenarios: 1, passed: 1, failed: 0 });

  const persistedRecord = JSON.parse(
    (await readFile(result.recordsPath, 'utf8')).trim(),
  ) as typeof result.record;
  const persistedScorecard = JSON.parse(
    await readFile(result.scorecardPath, 'utf8'),
  ) as typeof result.scorecard;
  expect(persistedRecord.status).toBe('passed');
  expect(persistedScorecard.checks.mediumPreferenceDerived).toBe(true);
});
