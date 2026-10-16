import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'bun:test';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = join(TEST_DIR, 'fixtures', '0080-eval');

test('D12.11 eval runner builds a deterministic fixture matrix and scorecard', async () => {
  const mod = await import('./eval/run-eval').catch((err) => ({
    loadError: err instanceof Error ? err.message : String(err),
  }));

  expect('loadError' in mod ? mod.loadError : '').toBe('');

  const { buildEvalBatchPlan, createDryRunRecords, summarizeEvalRecords } =
    mod as typeof import('./eval/run-eval');

  const plan = await buildEvalBatchPlan({
    fixtureRoot: FIXTURE_ROOT,
    fixtures: ['ibp-ui-kit/dcm-draft-deal'],
    models: ['ds3pro-floor', 'api-current'],
    profiles: ['react-storybook', 'html-css'],
    apiUrl: 'http://127.0.0.1:8787',
  });

  expect(plan.cells).toHaveLength(4);
  expect(plan.cells[0]).toMatchObject({
    fixture: 'ibp-ui-kit/dcm-draft-deal',
    model: 'ds3pro-floor',
    profile: 'react-storybook',
    apiUrl: 'http://127.0.0.1:8787',
    approvePermissions: false,
  });
  expect(plan.cells[0]?.brief).toContain('# Page: DcmDraftDealPage');
  expect(plan.cells[0]?.expectedComponentRoles).toEqual(
    expect.arrayContaining(['breadcrumbs', 'primary-action', 'data-table']),
  );

  const records = createDryRunRecords(plan, {
    batchId: 'batch-0107',
    timestamp: '2026-07-02T00:00:00.000Z',
  });

  expect(records).toHaveLength(4);
  expect(records[0]).toMatchObject({
    batchId: 'batch-0107',
    fixture: 'ibp-ui-kit/dcm-draft-deal',
    status: 'planned',
    metrics: {
      componentReuseScore: null,
      craftBlockingCount: null,
      designScreenCompatible: null,
      languageFactFidelityScore: null,
      jury_composite: null,
      promptTokens: null,
      completionTokens: null,
    },
  });

  const scorecard = summarizeEvalRecords(records, {
    generatedAt: '2026-07-02T00:00:01.000Z',
  });

  expect(scorecard).toMatchObject({
    generatedAt: '2026-07-02T00:00:01.000Z',
    totals: {
      cells: 4,
      completed: 0,
      failed: 0,
      planned: 4,
    },
  });
  expect(scorecard.byProfile).toEqual({
    'html-css': { cells: 2, completed: 0, failed: 0, planned: 2 },
    'react-storybook': { cells: 2, completed: 0, failed: 0, planned: 2 },
  });
  expect(scorecard.averages.languageFactFidelityScore).toBeNull();
  expect(scorecard.averages.jury_composite).toBeNull();

  const scored = summarizeEvalRecords(
    records.map((record, index) => ({
      ...record,
      status: 'completed' as const,
      metrics: {
        ...record.metrics,
        languageFactFidelityScore: index % 2 === 0 ? 1 : 0.75,
        jury_composite: index % 2 === 0 ? 9 : 7.5,
      },
    })),
    { generatedAt: '2026-07-02T00:00:02.000Z' },
  );
  expect(scored.averages.languageFactFidelityScore).toBe(0.875);
  expect(scored.averages.jury_composite).toBe(8.25);
});

test('0114 B1 eval score uses the latest valid successful jury receipt', async () => {
  const { latestValidJuryComposite, metricsFromChatResponse, metricsFromRunReceipts } =
    await import('./eval/run-eval');

  expect(
    latestValidJuryComposite([
      {
        tool: 'jury_round',
        status: 'ok',
        createdAt: 10,
        metadata: { juryComposite: 6.4 },
      },
      {
        tool: 'jury_round',
        status: 'error',
        createdAt: 30,
        metadata: { juryComposite: 10 },
      },
      {
        tool: 'jury_round',
        status: 'ok',
        createdAt: 20,
        metadata: { designJury: { composite: 8.7 } },
      },
    ]),
  ).toBe(8.7);

  expect(metricsFromChatResponse({}).jury_composite).toBeNull();
  expect(
    metricsFromChatResponse({ diagnostics: { designJury: { juryComposite: 9.2 } } }).jury_composite,
  ).toBe(9.2);
  expect(metricsFromChatResponse({ jury_composite: 11 }).jury_composite).toBeNull();
  expect(
    metricsFromChatResponse({
      componentReuse: { score: { earned: 4, total: 5, label: '4/5' } },
      qualitySummary: { remainingFindings: { blocking: 2 } },
    }),
  ).toMatchObject({
    componentReuseScore: 0.8,
    craftBlockingCount: 2,
  });
  expect(
    metricsFromRunReceipts([
      {
        tool: 'validate_screen_craft',
        status: 'ok',
        createdAt: 10,
        metadata: {
          blocking: 1,
          componentReuse: { score: { earned: 3, total: 4, label: '3/4' } },
        },
      },
      {
        tool: 'jury_round',
        status: 'ok',
        createdAt: 20,
        metadata: {
          juryComposite: 8.2,
          designJury: {
            roles: [
              { role: 'layout_hierarchy', score: 7 },
              { role: 'brief_fit', score: 9 },
            ],
          },
        },
      },
      {
        tool: 'validate_screen_craft',
        status: 'ok',
        createdAt: 30,
        metadata: {
          blocking: 0,
          componentReuse: { score: { earned: 4, total: 4, label: '4/4' } },
        },
      },
    ]),
  ).toMatchObject({
    componentReuseScore: 1,
    craftBlockingCount: 0,
    languageFactFidelityScore: 0.9,
    jury_composite: 8.2,
  });
});

test('0114 B5 eval stream request carries project context and explicit Jury opt-in', async () => {
  const { buildEvalBatchPlan, evalAuthHeaders, evalStreamRequestForCell, parseEvalArgs } =
    await import('./eval/run-eval');
  const plan = await buildEvalBatchPlan({
    fixtureRoot: FIXTURE_ROOT,
    fixtures: ['ibp-ui-kit/dcm-draft-deal'],
    models: ['openai/gpt-eval'],
    profiles: ['react-storybook'],
    approvePermissions: true,
  });

  expect(evalStreamRequestForCell(plan.cells[0]!, 'batch-live')).toMatchObject({
    provider: 'openai',
    model: 'gpt-eval',
    generation: { critique: true },
    editorContext: {
      canvasView: 'screen',
      projectName: 'ibp-ui-kit',
      workspacePath: '/Users/dev/Work Dev/ibp-ui-kit',
    },
  });
  expect(parseEvalArgs(['--approve-permissions']).approvePermissions).toBe(true);
  expect(evalAuthHeaders('eval-user')).toEqual({ 'x-sber-designer-user': 'eval-user' });
});

test('0114 B5 eval stream parser resolves permissions and retains the final done event', async () => {
  const { consumeEvalEventStream, metricsFromChatResponse } = await import('./eval/run-eval');
  const encoder = new TextEncoder();
  const chunks = [
    'data: {"type":"run-started","runId":"run-',
    'eval-1"}\n\n',
    'data: {"type":"permission-request","request":{"id":"permission-1"}}\r\n\r\n',
    'data: not-json\n\n',
    'data: {"type":"done","runStatus":"needs_review","usage":{"inputTokens":120,"outputTokens":30},"finalResponse":{"text":"done"}}',
  ];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  const permissionIds: string[] = [];

  const result = await consumeEvalEventStream(stream, async (requestId) => {
    permissionIds.push(requestId);
  });

  expect(permissionIds).toEqual(['permission-1']);
  expect(result).toMatchObject({
    runId: 'run-eval-1',
    error: null,
    permissionRequests: 1,
    done: { type: 'done', runStatus: 'needs_review' },
  });
  expect(metricsFromChatResponse(result.done)).toMatchObject({
    promptTokens: 120,
    completionTokens: 30,
  });
});

test('0114 B5 eval stream parser exposes a rejection without inventing done', async () => {
  const { consumeEvalEventStream } = await import('./eval/run-eval');
  const stream = new Response(
    'data: {"type":"run-rejected","runId":"run-rejected-1","reason":"active run conflict"}\n\n',
  ).body!;

  const result = await consumeEvalEventStream(stream, async () => undefined);

  expect(result).toEqual({
    runId: 'run-rejected-1',
    done: null,
    error: 'active run conflict',
    permissionRequests: 0,
  });
});
