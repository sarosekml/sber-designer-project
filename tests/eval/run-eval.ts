import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE_ROOT = join(SCRIPT_DIR, '..', 'fixtures', '0080-eval');

export interface BuildEvalBatchPlanInput {
  fixtureRoot?: string;
  fixtures?: string[];
  models?: string[];
  profiles?: string[];
  apiUrl?: string;
  workspacePath?: string | null;
  maxIterations?: number;
  approvePermissions?: boolean;
}

export interface EvalBatchPlan {
  fixtureRoot: string;
  apiUrl: string;
  cells: EvalBatchCell[];
}

export interface EvalBatchCell {
  id: string;
  fixture: string;
  model: string;
  profile: string;
  apiUrl: string;
  briefPath: string;
  expectedPath: string;
  brief: string;
  expectedComponentRoles: string[];
  expectedComponents: Array<{ role: string; anyOf: string[] }>;
  projectWorkspacePath: string | null;
  maxIterations: number;
  approvePermissions: boolean;
}

export interface CreateDryRunRecordsOptions {
  batchId?: string;
  timestamp?: string;
}

export type EvalRecordStatus = 'planned' | 'completed' | 'failed';

export interface EvalMetrics {
  componentReuseScore: number | null;
  craftBlockingCount: number | null;
  designScreenCompatible: boolean | null;
  /** Normalized 0..1 evaluator score for brief language and business-fact retention. */
  languageFactFidelityScore: number | null;
  /** Final Design Jury score on a 0..10 scale; null when Jury did not run. */
  jury_composite: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
}

export interface EvalRecord {
  id: string;
  batchId: string;
  createdAt: string;
  fixture: string;
  model: string;
  profile: string;
  status: EvalRecordStatus;
  expectedComponentRoles: string[];
  metrics: EvalMetrics;
  runId?: string | null;
  runStatus?: 'complete' | 'failed' | 'needs_review' | 'cancelled' | null;
  durationMs?: number;
  error?: string;
}

export interface EvalScorecard {
  generatedAt: string;
  totals: EvalStatusCounts;
  byProfile: Record<string, EvalStatusCounts>;
  byModel: Record<string, EvalStatusCounts>;
  byFixture: Record<string, EvalStatusCounts>;
  averages: {
    componentReuseScore: number | null;
    craftBlockingCount: number | null;
    languageFactFidelityScore: number | null;
    jury_composite: number | null;
    promptTokens: number | null;
    completionTokens: number | null;
  };
}

export interface EvalStatusCounts {
  cells: number;
  completed: number;
  failed: number;
  planned: number;
}

export interface SummarizeEvalRecordsOptions {
  generatedAt?: string;
}

export interface RunEvalBatchInput extends BuildEvalBatchPlanInput {
  batchId?: string;
  outputDir?: string;
  dryRun?: boolean;
}

export interface RunEvalBatchResult {
  plan: EvalBatchPlan;
  records: EvalRecord[];
  scorecard: EvalScorecard;
  outputDir: string;
  recordsPath: string;
  scorecardPath: string;
}

type EvalFixtureManifest = {
  expected?: Array<{ role?: unknown; anyOf?: unknown }>;
  project?: unknown;
};

export async function buildEvalBatchPlan(
  input: BuildEvalBatchPlanInput = {},
): Promise<EvalBatchPlan> {
  const fixtureRoot = input.fixtureRoot ?? DEFAULT_FIXTURE_ROOT;
  const fixtures = input.fixtures?.length
    ? input.fixtures
    : await discoverEvalFixtures(fixtureRoot);
  const models = normalizeList(input.models, ['ds3pro-floor', 'api-current']);
  const profiles = normalizeList(input.profiles, ['react-storybook', 'html-css']);
  const apiUrl = (input.apiUrl ?? process.env.SD_EVAL_API_URL ?? 'http://127.0.0.1:8787').replace(
    /\/+$/u,
    '',
  );
  const maxIterations = Math.max(1, Math.floor(input.maxIterations ?? 8));
  const cells: EvalBatchCell[] = [];

  for (const fixture of fixtures) {
    const fixtureDir = resolveFixtureDir(fixtureRoot, fixture);
    const briefPath = join(fixtureDir, 'brief.md');
    const expectedPath = join(fixtureDir, 'expected-components.json');
    const [brief, expectedRaw] = await Promise.all([
      readFile(briefPath, 'utf8'),
      readFile(expectedPath, 'utf8'),
    ]);
    const expected = JSON.parse(expectedRaw) as EvalFixtureManifest;
    const expectedComponents = normalizeExpectedComponents(expected);
    const fixtureId = fixtureName(fixtureRoot, fixtureDir);
    const projectWorkspacePath =
      input.workspacePath ?? (typeof expected.project === 'string' ? expected.project : null);

    for (const model of models) {
      for (const profile of profiles) {
        cells.push({
          id: slug([fixtureId, model, profile]),
          fixture: fixtureId,
          model,
          profile,
          apiUrl,
          briefPath,
          expectedPath,
          brief,
          expectedComponents,
          expectedComponentRoles: expectedComponents.map((entry) => entry.role).sort(),
          projectWorkspacePath,
          maxIterations,
          approvePermissions: input.approvePermissions === true,
        });
      }
    }
  }

  return { fixtureRoot, apiUrl, cells };
}

export function createDryRunRecords(
  plan: EvalBatchPlan,
  options: CreateDryRunRecordsOptions = {},
): EvalRecord[] {
  const batchId = options.batchId ?? `eval-${new Date().toISOString().replace(/[:.]/gu, '-')}`;
  const createdAt = options.timestamp ?? new Date().toISOString();

  return plan.cells.map((cell) => ({
    id: `${batchId}:${cell.id}`,
    batchId,
    createdAt,
    fixture: cell.fixture,
    model: cell.model,
    profile: cell.profile,
    status: 'planned',
    expectedComponentRoles: cell.expectedComponentRoles,
    metrics: emptyMetrics(),
  }));
}

export function summarizeEvalRecords(
  records: EvalRecord[],
  options: SummarizeEvalRecordsOptions = {},
): EvalScorecard {
  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    totals: countStatuses(records),
    byProfile: groupCounts(records, (record) => record.profile),
    byModel: groupCounts(records, (record) => record.model),
    byFixture: groupCounts(records, (record) => record.fixture),
    averages: {
      componentReuseScore: averageMetric(records, 'componentReuseScore'),
      craftBlockingCount: averageMetric(records, 'craftBlockingCount'),
      languageFactFidelityScore: averageMetric(records, 'languageFactFidelityScore'),
      jury_composite: averageMetric(records, 'jury_composite'),
      promptTokens: averageMetric(records, 'promptTokens'),
      completionTokens: averageMetric(records, 'completionTokens'),
    },
  };
}

export async function runEvalBatch(input: RunEvalBatchInput = {}): Promise<RunEvalBatchResult> {
  const batchId = input.batchId ?? `eval-${new Date().toISOString().replace(/[:.]/gu, '-')}`;
  const plan = await buildEvalBatchPlan(input);
  const outputDir = input.outputDir ?? join(SCRIPT_DIR, 'out', batchId);
  const records = input.dryRun
    ? createDryRunRecords(plan, { batchId })
    : await runEvalCells(plan, batchId);
  const scorecard = summarizeEvalRecords(records);

  await mkdir(outputDir, { recursive: true });
  const recordsPath = join(outputDir, 'records.jsonl');
  const scorecardPath = join(outputDir, 'scorecard.json');
  await writeFile(recordsPath, records.map((record) => JSON.stringify(record)).join('\n') + '\n');
  await writeFile(scorecardPath, JSON.stringify(scorecard, null, 2) + '\n');

  return { plan, records, scorecard, outputDir, recordsPath, scorecardPath };
}

export function parseEvalArgs(args: string[]): RunEvalBatchInput {
  const input: RunEvalBatchInput = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = () => {
      i += 1;
      if (i >= args.length) throw new Error(`${arg} requires a value`);
      return args[i]!;
    };

    if (arg === '--fixture-root') input.fixtureRoot = next();
    else if (arg === '--fixture') input.fixtures = appendList(input.fixtures, next());
    else if (arg === '--model') input.models = appendList(input.models, next());
    else if (arg === '--profile') input.profiles = appendList(input.profiles, next());
    else if (arg === '--api-url') input.apiUrl = next();
    else if (arg === '--workspace') input.workspacePath = next();
    else if (arg === '--output') input.outputDir = next();
    else if (arg === '--batch-id') input.batchId = next();
    else if (arg === '--max-iterations') input.maxIterations = Number(next());
    else if (arg === '--approve-permissions') input.approvePermissions = true;
    else if (arg === '--dry-run') input.dryRun = true;
    else if (arg === '--help' || arg === '-h') {
      throw new Error(usage());
    } else {
      throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
    }
  }

  return input;
}

async function runEvalCells(plan: EvalBatchPlan, batchId: string): Promise<EvalRecord[]> {
  const records: EvalRecord[] = [];
  for (const cell of plan.cells) {
    records.push(await runEvalCell(cell, batchId));
  }
  return records;
}

async function runEvalCell(cell: EvalBatchCell, batchId: string): Promise<EvalRecord> {
  const started = Date.now();
  const base = {
    id: `${batchId}:${cell.id}`,
    batchId,
    createdAt: new Date().toISOString(),
    fixture: cell.fixture,
    model: cell.model,
    profile: cell.profile,
    expectedComponentRoles: cell.expectedComponentRoles,
  };

  try {
    const response = await fetch(`${cell.apiUrl}/api/chat/stream`, {
      method: 'POST',
      headers: {
        ...evalAuthHeaders(),
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify(evalStreamRequestForCell(cell, batchId)),
    });
    if (!response.ok || !response.body) {
      const body = await response.json().catch(() => ({}));
      return {
        ...base,
        status: 'failed',
        durationMs: Date.now() - started,
        metrics: emptyMetrics(),
        error: errorMessageFromBody(body, `HTTP ${response.status}`),
      };
    }

    const streamResult = await consumeEvalEventStream(response.body, async (requestId) => {
      await resolveEvalPermission(
        cell.apiUrl,
        requestId,
        cell.approvePermissions ? 'allow' : 'deny',
      );
    });
    const runId = streamResult.runId;
    if (!streamResult.done) {
      return {
        ...base,
        status: 'failed',
        durationMs: Date.now() - started,
        metrics: emptyMetrics(),
        runId,
        error: streamResult.error ?? 'Chat stream closed before the final done event.',
      };
    }

    const runStatus = streamRunStatus(streamResult.done);
    const permissionDenied = streamResult.permissionRequests > 0 && !cell.approvePermissions;
    const stoppedAfterPermissionDeny =
      nestedValue(streamResult.done, ['stoppedAfterPermissionDeny']) === true;
    if (
      streamResult.error ||
      permissionDenied ||
      stoppedAfterPermissionDeny ||
      runStatus === 'failed' ||
      runStatus === 'cancelled'
    ) {
      return {
        ...base,
        status: 'failed',
        durationMs: Date.now() - started,
        metrics: metricsFromChatResponse(streamResult.done),
        runId,
        runStatus,
        error:
          streamResult.error ??
          (permissionDenied
            ? 'Eval tool permission was denied. Re-run with --approve-permissions to allow project writes.'
            : `Agent run finished with status ${runStatus ?? 'failed'}.`),
      };
    }

    const responseMetrics = metricsFromChatResponse(streamResult.done);
    const receiptMetrics =
      cell.projectWorkspacePath && runId
        ? await evalMetricsFromRunReceipts(cell.projectWorkspacePath, runId)
        : emptyMetrics();

    return {
      ...base,
      status: 'completed',
      durationMs: Date.now() - started,
      metrics: {
        componentReuseScore:
          responseMetrics.componentReuseScore ?? receiptMetrics.componentReuseScore,
        craftBlockingCount: responseMetrics.craftBlockingCount ?? receiptMetrics.craftBlockingCount,
        designScreenCompatible:
          responseMetrics.designScreenCompatible ?? receiptMetrics.designScreenCompatible,
        languageFactFidelityScore:
          responseMetrics.languageFactFidelityScore ?? receiptMetrics.languageFactFidelityScore,
        jury_composite: responseMetrics.jury_composite ?? receiptMetrics.jury_composite,
        promptTokens: responseMetrics.promptTokens,
        completionTokens: responseMetrics.completionTokens,
      },
      runId,
      runStatus,
    };
  } catch (err) {
    return {
      ...base,
      status: 'failed',
      durationMs: Date.now() - started,
      metrics: emptyMetrics(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function evalStreamRequestForCell(
  cell: EvalBatchCell,
  batchId: string,
): Record<string, unknown> {
  const modelTarget = splitModelTarget(cell.model);
  const streamId = slug([batchId, cell.id]);
  return {
    ...modelTarget,
    maxIterations: cell.maxIterations,
    generation: { critique: true },
    clientRunId: streamId,
    sessionId: `session-${streamId}`,
    editorContext: {
      mode: 'interact',
      canvasView: 'screen',
      projectName: cell.fixture.split('/')[0] ?? 'eval-fixture',
      workspacePath: cell.projectWorkspacePath,
    },
    messages: [
      {
        role: 'user',
        content: [
          cell.brief,
          '',
          'Eval profile:',
          `- projectProfile: ${cell.profile}`,
          `- fixture: ${cell.fixture}`,
          `- expected component roles: ${cell.expectedComponentRoles.join(', ') || 'none'}`,
        ].join('\n'),
      },
    ],
  };
}

export interface EvalEventStreamResult {
  runId: string | null;
  done: Record<string, unknown> | null;
  error: string | null;
  permissionRequests: number;
}

export async function consumeEvalEventStream(
  stream: ReadableStream<Uint8Array>,
  onPermissionRequest: (requestId: string) => Promise<void>,
): Promise<EvalEventStreamResult> {
  let runId: string | null = null;
  let done: Record<string, unknown> | null = null;
  let error: string | null = null;
  let permissionRequests = 0;

  for await (const event of readEvalSseEvents(stream)) {
    if (!event || typeof event !== 'object') continue;
    const record = event as Record<string, unknown>;
    const type = stringValue(record.type);
    runId = stringValue(record.runId) ?? runId;
    if (type === 'permission-request') {
      const requestId = stringValue(nestedValue(record, ['request', 'id']));
      if (!requestId) {
        error = 'Chat stream emitted a permission request without an id.';
        continue;
      }
      permissionRequests += 1;
      await onPermissionRequest(requestId);
    } else if (type === 'done') {
      done = record;
    } else if (type === 'error' || type === 'run-rejected') {
      error =
        stringValue(record.message) ?? stringValue(record.reason) ?? `Chat stream emitted ${type}.`;
    }
  }

  return { runId, done, error, permissionRequests };
}

export async function* readEvalSseEvents(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finished = false;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        finished = true;
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(chunk.value, { stream: true });
      while (true) {
        const boundary = sseFrameBoundary(buffer);
        if (!boundary) break;
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary.length);
        const event = parseEvalSseFrame(frame);
        if (event !== null) yield event;
      }
    }
    const tail = parseEvalSseFrame(buffer);
    if (tail !== null) yield tail;
  } finally {
    if (!finished) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function parseEvalSseFrame(frame: string): unknown | null {
  const data = frame
    .split(/\r?\n/gu)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n');
  if (!data) return null;
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
}

function sseFrameBoundary(buffer: string): { index: number; length: number } | null {
  const match = /\r?\n\r?\n/u.exec(buffer);
  return match ? { index: match.index, length: match[0].length } : null;
}

async function resolveEvalPermission(
  apiUrl: string,
  requestId: string,
  decision: 'allow' | 'deny',
): Promise<void> {
  const response = await fetch(
    `${apiUrl}/api/chat/stream/permission/${encodeURIComponent(requestId)}`,
    {
      method: 'POST',
      headers: { ...evalAuthHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ decision }),
    },
  );
  if (response.ok) return;
  const body = await response.json().catch(() => ({}));
  throw new Error(errorMessageFromBody(body, `Permission HTTP ${response.status}`));
}

/** Local dev auth is explicit; server/password deployments may ignore this header. */
export function evalAuthHeaders(
  user = process.env.SD_EVAL_USER ?? 'local-dev',
): Record<string, string> {
  return { 'x-sber-designer-user': user };
}

function streamRunStatus(done: Record<string, unknown>): EvalRecord['runStatus'] {
  const status = stringValue(done.runStatus);
  return status === 'complete' ||
    status === 'failed' ||
    status === 'needs_review' ||
    status === 'cancelled'
    ? status
    : null;
}

export function metricsFromChatResponse(body: unknown): EvalMetrics {
  const embeddedReceipts = nestedValue(body, ['receipts']);
  return {
    componentReuseScore:
      componentReuseRatioValue(nestedValue(body, ['componentReuse', 'score'])) ??
      numberValue(
        nestedValue(body, ['componentReuse', 'score']),
        nestedValue(body, ['componentReuse', 'componentReuseScore']),
        nestedValue(body, ['componentReuseScore']),
        nestedValue(body, ['finalResponse', 'componentReuseScore']),
      ),
    craftBlockingCount: numberValue(
      nestedValue(body, ['screenReadiness', 'craft', 'findings', 'blocking']),
      nestedValue(body, ['screenReadiness', 'findings', 'blocking']),
      nestedValue(body, ['qualitySummary', 'remainingFindings', 'blocking']),
      nestedValue(body, ['craftBlockingCount']),
      nestedValue(body, ['finalResponse', 'craftBlockingCount']),
    ),
    designScreenCompatible: booleanValue(
      nestedValue(body, ['validateDesignScreen', 'compatible']),
      nestedValue(body, ['designScreen', 'compatible']),
      nestedValue(body, ['screenReadiness', 'status']) === 'compatible',
      nestedValue(body, ['finalResponse', 'designScreenCompatible']),
    ),
    languageFactFidelityScore: normalizedScoreValue(
      nestedValue(body, ['languageFactFidelity', 'score']),
      nestedValue(body, ['fidelity', 'languageFactScore']),
      nestedValue(body, ['languageFactFidelityScore']),
      nestedValue(body, ['finalResponse', 'languageFactFidelityScore']),
    ),
    jury_composite:
      juryScoreValue(
        nestedValue(body, ['jury_composite']),
        nestedValue(body, ['juryComposite']),
        nestedValue(body, ['designJury', 'juryComposite']),
        nestedValue(body, ['diagnostics', 'designJury', 'juryComposite']),
        nestedValue(body, ['finalResponse', 'jury_composite']),
        nestedValue(body, ['finalResponse', 'juryComposite']),
      ) ?? latestValidJuryComposite(Array.isArray(embeddedReceipts) ? embeddedReceipts : []),
    promptTokens: numberValue(
      nestedValue(body, ['usage', 'promptTokens']),
      nestedValue(body, ['usage', 'prompt_tokens']),
      nestedValue(body, ['usage', 'inputTokens']),
      nestedValue(body, ['tokenUsage', 'promptTokens']),
      nestedValue(body, ['finalResponse', 'usage', 'promptTokens']),
      nestedValue(body, ['finalResponse', 'usage', 'inputTokens']),
    ),
    completionTokens: numberValue(
      nestedValue(body, ['usage', 'completionTokens']),
      nestedValue(body, ['usage', 'completion_tokens']),
      nestedValue(body, ['usage', 'outputTokens']),
      nestedValue(body, ['tokenUsage', 'completionTokens']),
      nestedValue(body, ['finalResponse', 'usage', 'completionTokens']),
      nestedValue(body, ['finalResponse', 'usage', 'outputTokens']),
    ),
  };
}

/**
 * Derive scorecard metrics from persisted machine receipts when the final SSE
 * envelope contains only presentation summaries.
 *
 * - component reuse is the latest craft earned/total ratio;
 * - craft blocking is the latest craft blocking count;
 * - language/fact fidelity is the latest successful Jury brief-fit role,
 *   normalized from 0..10 to 0..1.
 */
export function metricsFromRunReceipts(receipts: readonly unknown[]): EvalMetrics {
  const ordered = receipts
    .map((receipt, index) => ({ receipt, index }))
    .filter((entry): entry is { receipt: Record<string, unknown>; index: number } =>
      Boolean(entry.receipt && typeof entry.receipt === 'object'),
    )
    .sort((a, b) => {
      const createdAtDiff =
        (numberValue(a.receipt.createdAt) ?? 0) - (numberValue(b.receipt.createdAt) ?? 0);
      return createdAtDiff || a.index - b.index;
    });
  const metrics = emptyMetrics();

  for (const { receipt } of ordered) {
    if (receipt.status !== 'ok') continue;
    if (receipt.tool === 'validate_screen_craft') {
      metrics.componentReuseScore =
        componentReuseRatioValue(nestedValue(receipt, ['metadata', 'componentReuse', 'score'])) ??
        metrics.componentReuseScore;
      metrics.craftBlockingCount =
        numberValue(nestedValue(receipt, ['metadata', 'blocking'])) ?? metrics.craftBlockingCount;
    } else if (receipt.tool === 'validate_design_screen') {
      const status = stringValue(nestedValue(receipt, ['metadata', 'status']));
      if (status === 'compatible') metrics.designScreenCompatible = true;
      else if (status === 'needs-review' || status === 'unsupported') {
        metrics.designScreenCompatible = false;
      }
    } else if (receipt.tool === 'jury_round') {
      metrics.jury_composite =
        juryScoreValue(
          nestedValue(receipt, ['metadata', 'juryComposite']),
          nestedValue(receipt, ['metadata', 'designJury', 'composite']),
        ) ?? metrics.jury_composite;
      metrics.languageFactFidelityScore =
        juryBriefFitScore(nestedValue(receipt, ['metadata', 'designJury', 'roles'])) ??
        metrics.languageFactFidelityScore;
    }
  }

  return metrics;
}

/** Returns the newest usable score and ignores failed or malformed Jury receipts. */
export function latestValidJuryComposite(receipts: readonly unknown[]): number | null {
  const ordered = receipts
    .map((receipt, index) => ({ receipt, index }))
    .filter((entry): entry is { receipt: Record<string, unknown>; index: number } =>
      Boolean(entry.receipt && typeof entry.receipt === 'object'),
    )
    .sort((a, b) => {
      const createdAtDiff =
        (numberValue(a.receipt.createdAt) ?? 0) - (numberValue(b.receipt.createdAt) ?? 0);
      return createdAtDiff || a.index - b.index;
    });
  let latest: number | null = null;
  for (const { receipt } of ordered) {
    if (receipt.tool !== 'jury_round' || receipt.status !== 'ok') continue;
    const score = juryScoreValue(
      nestedValue(receipt, ['metadata', 'juryComposite']),
      nestedValue(receipt, ['metadata', 'designJury', 'composite']),
    );
    if (score !== null) latest = score;
  }
  return latest;
}

async function evalMetricsFromRunReceipts(
  workspacePath: string,
  runId: string,
): Promise<EvalMetrics> {
  if (!/^[A-Za-z0-9._-]+$/u.test(runId)) return emptyMetrics();
  const receiptsRoot = join(workspacePath, '.sber-designer', 'runs', runId, 'receipts');
  try {
    const files = (await readdir(receiptsRoot)).filter((file) => file.endsWith('.json')).sort();
    const receipts = await Promise.all(
      files.map(async (file) => {
        try {
          return JSON.parse(await readFile(join(receiptsRoot, file), 'utf8')) as unknown;
        } catch {
          return null;
        }
      }),
    );
    return metricsFromRunReceipts(receipts);
  } catch {
    return emptyMetrics();
  }
}

function componentReuseRatioValue(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const earned = numberValue(record.earned);
  const total = numberValue(record.total);
  if (earned === null || total === null || total <= 0 || earned < 0 || earned > total) return null;
  return roundMetric(earned / total);
}

function juryBriefFitScore(value: unknown): number | null {
  if (!Array.isArray(value)) return null;
  let latest: number | null = null;
  for (const role of value) {
    if (!role || typeof role !== 'object') continue;
    const record = role as Record<string, unknown>;
    const roleName = stringValue(record.role)
      ?.replace(/[-\s]+/gu, '_')
      .toLowerCase();
    if (roleName !== 'brief_fit') continue;
    latest = normalizedScoreValue(
      typeof record.score === 'number' ? record.score / 10 : record.score,
    );
  }
  return latest;
}

async function discoverEvalFixtures(root: string): Promise<string[]> {
  const found: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    const names = new Set(entries.map((entry) => entry.name));
    if (names.has('brief.md') && names.has('expected-components.json')) {
      found.push(fixtureName(root, dir));
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) await walk(join(dir, entry.name));
    }
  }

  await walk(root);
  return found.sort();
}

function resolveFixtureDir(root: string, fixture: string): string {
  return isAbsolute(fixture) ? fixture : join(root, fixture);
}

function fixtureName(root: string, fixtureDir: string): string {
  return relative(root, fixtureDir).replace(/\\/gu, '/');
}

function normalizeExpectedComponents(
  expected: EvalFixtureManifest,
): Array<{ role: string; anyOf: string[] }> {
  return (expected.expected ?? [])
    .map((entry) => ({
      role: typeof entry.role === 'string' ? entry.role : '',
      anyOf: Array.isArray(entry.anyOf)
        ? entry.anyOf.filter((value): value is string => typeof value === 'string')
        : [],
    }))
    .filter((entry) => entry.role.length > 0)
    .sort((a, b) => a.role.localeCompare(b.role));
}

function normalizeList(values: string[] | undefined, fallback: string[]): string[] {
  const normalized = values?.flatMap(splitList).filter(Boolean) ?? [];
  return [...new Set(normalized.length > 0 ? normalized : fallback)];
}

function appendList(existing: string[] | undefined, value: string): string[] {
  return [...(existing ?? []), ...splitList(value)];
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitModelTarget(model: string): { provider?: string; model: string } {
  const slash = model.indexOf('/');
  if (slash <= 0 || slash >= model.length - 1) return { model };
  return {
    provider: model.slice(0, slash),
    model: model.slice(slash + 1),
  };
}

function emptyMetrics(): EvalMetrics {
  return {
    componentReuseScore: null,
    craftBlockingCount: null,
    designScreenCompatible: null,
    languageFactFidelityScore: null,
    jury_composite: null,
    promptTokens: null,
    completionTokens: null,
  };
}

function countStatuses(records: EvalRecord[]): EvalStatusCounts {
  return records.reduce<EvalStatusCounts>(
    (counts, record) => {
      counts.cells += 1;
      counts[record.status] += 1;
      return counts;
    },
    { cells: 0, completed: 0, failed: 0, planned: 0 },
  );
}

function groupCounts(
  records: EvalRecord[],
  getKey: (record: EvalRecord) => string,
): Record<string, EvalStatusCounts> {
  const grouped = new Map<string, EvalRecord[]>();
  for (const record of records) {
    const key = getKey(record);
    grouped.set(key, [...(grouped.get(key) ?? []), record]);
  }
  return Object.fromEntries(
    [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, countStatuses(value)]),
  );
}

function averageMetric(records: EvalRecord[], metric: keyof EvalMetrics): number | null {
  const values = records
    .map((record) => record.metrics[metric])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}

function nestedValue(value: unknown, path: string[]): unknown {
  let current = value;
  for (const segment of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function numberValue(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function booleanValue(...values: unknown[]): boolean | null {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
  }
  return null;
}

function normalizedScoreValue(...values: unknown[]): number | null {
  const score = numberValue(...values);
  return score !== null && score >= 0 && score <= 1 ? score : null;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

function juryScoreValue(...values: unknown[]): number | null {
  const score = numberValue(...values);
  return score !== null && score >= 0 && score <= 10 ? score : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function errorMessageFromBody(body: unknown, fallback: string): string {
  return (
    stringValue(nestedValue(body, ['detail'])) ??
    stringValue(nestedValue(body, ['error'])) ??
    fallback
  );
}

function slug(parts: string[]): string {
  return parts
    .join('--')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
}

function usage(): string {
  return [
    'Usage: bun run tests/eval/run-eval.ts [options]',
    '',
    'Options:',
    '  --dry-run                  Write planned records without calling /api/chat/stream',
    '  --approve-permissions       Allow requested project writes during the eval run',
    '  --api-url <url>            Chat API root, default SD_EVAL_API_URL or http://127.0.0.1:8787',
    '  --fixture-root <path>      Fixture root, default tests/fixtures/0080-eval',
    '  --fixture <id[,id]>        Fixture ids relative to fixture root',
    '  --model <id[,id]>          Model ids; provider/model splits provider automatically',
    '  --profile <id[,id]>        Project profiles, e.g. react-storybook,html-css',
    '  --workspace <path>         Workspace sent to stream and used to read run receipts',
    '  --output <path>            Output directory for records.jsonl and scorecard.json',
    '  --batch-id <id>            Stable batch id for output and record ids',
  ].join('\n');
}

if (import.meta.main) {
  try {
    const result = await runEvalBatch(parseEvalArgs(process.argv.slice(2)));
    console.log(`eval records: ${result.recordsPath}`);
    console.log(`eval scorecard: ${result.scorecardPath}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}
