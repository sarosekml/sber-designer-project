import { mkdir, readFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'bun:test';

import { completeAgentRun, createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { recordDesignSourceEvidencePack } from '../services/api/src/agent/run-record/evidence';

test('initializes design-source evidence pack under the run directory', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'sd-design-source-evidence-'));
  await mkdir(join(workspace, '.sber-designer'), { recursive: true });
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    provider: 'opencode-runtime',
    model: 'opencode',
    projectName: 'Demo',
    workspacePath: workspace,
    userGoal: 'Create screen from Pixso',
  });

  await recordDesignSourceEvidencePack({
    workspacePath: workspace,
    runId: run.runId,
    intent: {
      source: { kind: 'pixso', input: 'selection' },
      target: {
        mode: 'new-screen',
        name: 'Pixso Payment',
        storyFilePath: 'src/stories/screens/2026-05-25/PixsoPayment.stories.tsx',
        implementationFilePath: 'src/screens/2026-05-25/PixsoPayment.tsx',
      },
      policies: { tokens: 'prefer-project-tokens', components: 'prefer-existing' },
    },
  });

  const runRoot = join(workspace, '.sber-designer', 'runs', run.runId);
  const sourceSummary = await readFile(
    join(runRoot, 'reference', 'design-source', 'source-summary.md'),
    'utf8',
  );
  const mappingReport = await readFile(
    join(runRoot, 'reference', 'design-source', 'mapping-report.md'),
    'utf8',
  );
  const manifest = JSON.parse(
    await readFile(join(runRoot, 'reference', 'design-source', 'manifest.json'), 'utf8'),
  );

  expect(sourceSummary).toContain('Source: pixso');
  expect(sourceSummary).toContain('Implementation file: src/screens/2026-05-25/PixsoPayment.tsx');
  expect(mappingReport).toContain('## Project Components Used');
  expect(manifest).toMatchObject({
    version: 1,
    runId: run.runId,
    source: { kind: 'pixso', input: 'selection' },
    files: {
      sourceSummary: 'reference/design-source/source-summary.md',
      mappingReport: 'reference/design-source/mapping-report.md',
    },
  });

  await completeAgentRun({
    workspacePath: workspace,
    runId: run.runId,
    status: 'complete',
    summary: 'Done',
  });
  const handoff = await readFile(join(runRoot, 'handoff.md'), 'utf8');
  expect(handoff).toContain('reference_evidence_pack');
  expect(handoff).toContain('Initialized design-source evidence pack');
  expect(handoff).toContain('reference/design-source/mapping-report.md');
});
