import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { expect, test } from 'bun:test';

import { buildRunQualitySummary } from '../services/api/src/agent/run-record/quality';
import { RUNS_DATASET_PATH } from '../services/api/src/agent/run-record/dataset';
import { RUN_REVIEW_FILE } from '../services/api/src/agent/run-record/review';
import { completeAgentRun, createAgentRun } from '../services/api/src/agent/run-record/manifest';
import { recordToolReceiptSafely } from '../services/api/src/agent/run-record/receipts';
import { annotateProjectScreensWithHealth } from '../services/api/src/screen-health';
import {
  buildScreenPreservationInventory,
  compareScreenRedesignFidelity,
} from '../services/api/src/screen-redesign-fidelity';
import { agentRunsRouter } from '../services/api/src/routes/agent-runs';
import { patchState, resetState } from '../services/api/src/state-store';
import type { AgentToolReceipt } from '../services/api/src/agent/run-recorder';

test('0114 B6 final quality summary reuses receipts and reports repair, skips, and Jury', () => {
  const receipts: AgentToolReceipt[] = [
    receipt('validate_screen_craft', {
      status: 'findings',
      blocking: 0,
      shouldFix: 2,
      advisory: 1,
      categoryResults: {
        sourceIntegrity: { status: 'passed' },
        responsiveVisualSanity: { status: 'skipped' },
      },
    }),
    receipt('validate_design_screen', { status: 'compatible' }),
    receipt('automatic_craft_repair', { succeeded: true }),
    receipt('screen_redesign_fidelity', {
      redesignFidelity: {
        status: 'passed',
        changedComposition: true,
        missingSections: [],
        missingFacts: [],
        missingActions: [],
        missingStates: [],
        missingRoutes: [],
      },
    }),
  ];
  const summary = buildRunQualitySummary({
    terminalStatus: 'complete',
    diagnostics: {
      renderProof: {
        status: 'confirmed',
        attempt: 1,
        checkedAt: '2026-07-20T10:00:00.000Z',
        reason: 'Rendered.',
      },
      designJury: {
        status: 'passed',
        threshold: 8,
        rounds: 2,
        revisionAttempted: true,
        juryComposite: 8.4,
      },
    },
    receipts,
  });
  expect(summary).toMatchObject({
    terminalStatus: 'complete',
    repair: { attempted: true, attempts: 1, succeeded: true },
    remainingFindings: { blocking: 0, shouldFix: 2, advisory: 1 },
    designMode: { status: 'compatible' },
    render: { status: 'confirmed' },
    jury: { status: 'passed', rounds: 2, revisionAttempted: true },
    redesignFidelity: { status: 'passed', changedComposition: true },
  });
  expect(summary.skippedChecks).toContain('responsiveVisualSanity');
});

test('0114 B6 needs_review can be marked reviewed without changing its outcome', async () => {
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-0114-run-review-'));
  const screenPath = 'src/screens/Reviewed.tsx';
  resetState();
  patchState({ workspacePath });
  const run = await createAgentRun({
    route: 'chat-stream',
    user: 'test-user',
    workspacePath,
    activeScreen: {
      id: 'screen-reviewed',
      name: 'Reviewed',
      kind: 'page',
      filePath: screenPath,
      implementationFilePath: screenPath,
    },
  });
  await recordToolReceiptSafely({
    workspacePath,
    runId: run.runId,
    tool: 'write_file',
    status: 'ok',
    changedFiles: [screenPath],
    summary: 'Updated screen.',
  });
  await completeAgentRun({
    workspacePath,
    runId: run.runId,
    status: 'needs_review',
    summary: 'Blocking craft finding remains.',
  });
  const screen = {
    id: 'screen-reviewed',
    name: 'Reviewed',
    kind: 'page' as const,
    filePath: screenPath,
    implementationFilePath: screenPath,
  };
  expect((await annotateProjectScreensWithHealth(workspacePath, [screen]))[0]?.health?.status).toBe(
    'needs-review',
  );
  const app = new Hono().route('/api/agent-runs', agentRunsRouter);
  const saved = await app.request(`/api/agent-runs/${run.runId}/review`, { method: 'POST' });
  expect(saved.status).toBe(200);
  const savedBody = await saved.json();
  expect(savedBody).toMatchObject({
    review: { version: 1, runId: run.runId, reviewer: 'anonymous' },
  });
  const loaded = await app.request(`/api/agent-runs/${run.runId}/review`);
  expect(await loaded.json()).toEqual(savedBody);
  const manifest = JSON.parse(
    await readFile(
      join(workspacePath, '.sber-designer', 'runs', run.runId, 'run-manifest.json'),
      'utf8',
    ),
  ) as { status: string };
  expect(manifest.status).toBe('needs_review');
  const review = JSON.parse(
    await readFile(
      join(workspacePath, '.sber-designer', 'runs', run.runId, RUN_REVIEW_FILE),
      'utf8',
    ),
  ) as { reviewedAt: string };
  expect(review.reviewedAt).toBeString();
  const dataset = (await readFile(join(workspacePath, RUNS_DATASET_PATH), 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  expect(dataset).toHaveLength(1);
  expect(dataset[0]).toMatchObject({
    run_id: run.runId,
    status: 'needs_review',
    review: { reviewer: 'anonymous' },
  });
  expect(
    (await annotateProjectScreensWithHealth(workspacePath, [screen]))[0]?.health,
  ).toBeUndefined();
});

test('0114 B7 redesign fidelity requires changed composition and preserves the screen contract', () => {
  const before = buildScreenPreservationInventory(
    `
      export function Payment() {
        if (loading) return <div>Loading payment</div>;
        return <main className="flex column">
          <h1>Payment details</h1>
          <section><h2>Recipient</h2><p>Acme LLC</p><p>₽12,500</p></section>
          <a href="/payments">Back to payments</a>
          <button aria-label="Approve payment">Approve</button>
        </main>;
      }
    `,
    'src/Payment.tsx',
  );
  const after = buildScreenPreservationInventory(
    `
      export function Payment() {
        if (loading) return <div>Loading payment</div>;
        return <div className="grid layout">
          <header><h1>Payment details</h1></header>
          <aside><h2>Recipient</h2><p>Acme LLC</p><p>₽12,500</p></aside>
          <footer><a href="/payments">Back to payments</a>
          <button aria-label="Approve payment">Approve</button></footer>
        </div>;
      }
    `,
    'src/Payment.tsx',
  );
  expect(compareScreenRedesignFidelity(before, after)).toEqual({
    status: 'passed',
    changedComposition: true,
    missingSections: [],
    missingFacts: [],
    missingActions: [],
    missingStates: [],
    missingRoutes: [],
  });
  const lossy = buildScreenPreservationInventory(
    '<main className="grid"><h1>Payment details</h1></main>',
    'src/Payment.tsx',
  );
  expect(compareScreenRedesignFidelity(before, lossy)).toMatchObject({
    status: 'failed',
    changedComposition: true,
    missingSections: ['Recipient'],
    missingRoutes: ['/payments'],
  });
});

test('0114 B7 redesign fidelity accepts expanded labels and split contextual labels', () => {
  const before = buildScreenPreservationInventory(
    `
      <main className="flex column">
        <section title="Основные параметры"><span>Сумма</span></section>
        <section title="Банковские реквизиты">
          <span>Банк пл.</span><span>БИК пл.</span><span>Счёт пл.</span>
          <span>Банк пол.</span><span>БИК пол.</span><span>Счёт пол.</span>
        </section>
      </main>
    `,
    'src/Payment.tsx',
  );
  const after = buildScreenPreservationInventory(
    `
      <main className="grid layout">
        <aside title="Основные параметры"><span>Сумма платежа</span></aside>
        <section title="Банковские реквизиты">
          <h3>Плательщик</h3><span>Банк</span><span>БИК</span><span>Счёт</span>
          <h3>Получатель</h3><span>Банк</span><span>БИК</span><span>Счёт</span>
        </section>
      </main>
    `,
    'src/Payment.tsx',
  );
  expect(compareScreenRedesignFidelity(before, after)).toMatchObject({
    status: 'passed',
    changedComposition: true,
    missingFacts: [],
  });
});

function receipt(tool: string, metadata: Record<string, unknown>): AgentToolReceipt {
  return {
    version: 1,
    runId: 'run-quality',
    receiptId: `${tool}-receipt`,
    tool,
    status: 'ok',
    changedFiles: [],
    summary: null,
    metadata,
    createdAt: Date.now(),
  };
}
