import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { createInterface } from 'node:readline';
import { Hono } from 'hono';
import { resolveInside } from '@sber-designer/ast-bridge';
import type {
  AssistantSessionMode,
  DatedValue,
  ProjectScreen,
  ScreenGenerationInfo,
  ScreenGenerationRunEntry,
  ScreenRunAttachmentMeta,
} from '@sber-designer/shared-types';

import { RUNS_DATASET_PATH } from '../agent/run-record/dataset';
import { getAgentRunCoordinator } from '../agent/run-coordinator';
import { getProject, isProjectLoaded, loadProjectForWorkspace } from '../project-store';
import { getState } from '../state-store';

type Attribution = ScreenGenerationRunEntry['attribution'];

interface DatasetRowLike {
  run_id?: unknown;
  started_at?: unknown;
  completed_at?: unknown;
  status?: unknown;
  route?: unknown;
  provider?: unknown;
  model?: unknown;
  runtime_kind?: unknown;
  screen_id?: unknown;
  screen_ids?: unknown;
  screen_attribution?: unknown;
  session_mode?: unknown;
  cost_usd?: unknown;
  token_usage?: unknown;
  attachments?: unknown;
  logs?: unknown;
}

interface DatasetCacheEntry {
  mtimeMs: number;
  size: number;
  rows: DatasetRowLike[];
}

const datasetCache = new Map<string, DatasetCacheEntry>();

export const screenInfoRouter = new Hono().get('/:screenId/generation-info', async (c) => {
  const workspacePath = getState().workspacePath;
  if (!workspacePath) {
    return c.json(
      { error: 'no_workspace', detail: 'No active workspace. Connect a project first.' },
      400,
    );
  }
  const project = isProjectLoaded(workspacePath)
    ? getProject(workspacePath)
    : await loadProjectForWorkspace(workspacePath);
  const screenId = c.req.param('screenId');
  const screen = project.screens.find((candidate) => candidate.id === screenId);
  if (!screen) {
    return c.json(
      { error: 'screen_not_found', detail: `Screen "${screenId}" was not found.` },
      404,
    );
  }
  const limit = boundedLimit(c.req.query('limit'));
  return c.json(await buildScreenGenerationInfo({ workspacePath, screen, limit }));
});

export async function buildScreenGenerationInfo(input: {
  workspacePath: string;
  screen: ProjectScreen;
  limit?: number;
}): Promise<ScreenGenerationInfo> {
  const rows = (await readDatasetRows(input.workspacePath)).filter((row) =>
    rowMatchesScreen(row, input.screen.id),
  );
  const runs = (
    await Promise.all(rows.map((row) => datasetRowToRun(input.workspacePath, input.screen.id, row)))
  )
    .filter((run): run is ScreenGenerationRunEntry => run !== null)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const dates = await resolveScreenDates(input.workspacePath, input.screen, runs);
  const active = getAgentRunCoordinator()
    .activeRuns()
    .find((run) => run.screenId === input.screen.id);
  const costValues = runs
    .map((run) => run.costUsd)
    .filter((value): value is number => value !== undefined);
  const totals: ScreenGenerationInfo['totals'] = {
    runs: runs.length,
    inputTokens: sumKnown(runs.map((run) => run.inputTokens)),
    outputTokens: sumKnown(runs.map((run) => run.outputTokens)),
    totalTokens: sumKnown(runs.map((run) => run.totalTokens)),
    ...(costValues.length > 0 ? { costUsd: sum(costValues) } : {}),
    runsWithoutTokenData: runs.filter(
      (run) => run.inputTokens === null && run.outputTokens === null && run.totalTokens === null,
    ).length,
  };
  return {
    screen: {
      id: input.screen.id,
      name: input.screen.name,
      kind: input.screen.kind,
      ...(input.screen.surface === 'modal' ? { surface: input.screen.surface } : {}),
      ...(input.screen.folder ? { folder: input.screen.folder } : {}),
      ...(input.screen.filePath ? { filePath: input.screen.filePath } : {}),
      ...(input.screen.implementationFilePath
        ? { implementationFilePath: input.screen.implementationFilePath }
        : {}),
      ...dates,
    },
    totals,
    runs: runs.slice(0, input.limit ?? 100),
    ...(active
      ? {
          activeRun: {
            runId: active.runId ?? active.clientRunId,
            startedAt: active.startedAt,
            provider: active.provider,
            model: active.model,
            sessionMode: active.sessionMode ?? 'design',
          },
        }
      : {}),
  };
}

export function clearScreenInfoDatasetCache(): void {
  datasetCache.clear();
}

async function readDatasetRows(workspacePath: string): Promise<DatasetRowLike[]> {
  const path = resolveInside(workspacePath, RUNS_DATASET_PATH);
  const fileStat = await stat(path).catch(() => null);
  if (!fileStat?.isFile()) return [];
  const cached = datasetCache.get(path);
  if (cached && cached.mtimeMs === fileStat.mtimeMs && cached.size === fileStat.size) {
    return cached.rows;
  }
  const rows: DatasetRowLike[] = [];
  const lines = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        rows.push(parsed as DatasetRowLike);
      }
    } catch {
      // Keep the append-only dataset readable even if one historical line is malformed.
    }
  }
  datasetCache.set(path, { mtimeMs: fileStat.mtimeMs, size: fileStat.size, rows });
  return rows;
}

function rowMatchesScreen(row: DatasetRowLike, screenId: string): boolean {
  return stringArray(row.screen_ids).includes(screenId) || row.screen_id === screenId;
}

async function datasetRowToRun(
  workspacePath: string,
  screenId: string,
  row: DatasetRowLike,
): Promise<ScreenGenerationRunEntry | null> {
  const runId = stringValue(row.run_id);
  const startedAt = isoValue(row.started_at);
  const completedAt = isoValue(row.completed_at);
  const status = terminalStatus(row.status);
  if (!runId || !startedAt || !completedAt || !status) return null;
  const tokenUsage = objectValue(row.token_usage);
  const logs = objectValue(row.logs);
  const runDir = stringValue(logs?.run_dir) ?? `.sber-designer/runs/${runId}`;
  const available = await runDirectoryAvailable(workspacePath, runDir);
  const datasetInputTokens = nonnegativeInteger(tokenUsage?.input);
  const datasetOutputTokens = nonnegativeInteger(tokenUsage?.output);
  const datasetTotalTokens = nonnegativeInteger(tokenUsage?.total);
  const datasetCostUsd = nonnegativeNumber(row.cost_usd);
  const manifestMetrics =
    datasetInputTokens === null ||
    datasetOutputTokens === null ||
    datasetTotalTokens === null ||
    datasetCostUsd === null
      ? await readLiveRunManifestMetrics(workspacePath, runDir)
      : null;
  const costUsd = datasetCostUsd ?? nonnegativeNumber(manifestMetrics?.costUsd);
  return {
    runId,
    startedAt,
    completedAt,
    status,
    route: runRoute(row.route),
    sessionMode: sessionMode(row.session_mode),
    provider: nullableString(row.provider),
    model: nullableString(row.model),
    runtimeKind: runtimeKind(row.runtime_kind),
    inputTokens: datasetInputTokens ?? nonnegativeInteger(manifestMetrics?.inputTokens),
    outputTokens: datasetOutputTokens ?? nonnegativeInteger(manifestMetrics?.outputTokens),
    totalTokens: datasetTotalTokens ?? nonnegativeInteger(manifestMetrics?.totalTokens),
    ...(costUsd !== null ? { costUsd } : {}),
    attribution: rowAttribution(row, screenId),
    logs: {
      runDir,
      ...(stringValue(logs?.attempt_log) ? { attemptLog: stringValue(logs?.attempt_log)! } : {}),
      ...(stringValue(logs?.debug_log) ? { debugLog: stringValue(logs?.debug_log)! } : {}),
      available,
    },
    attachments: attachments(row.attachments),
  };
}

async function readLiveRunManifestMetrics(
  workspacePath: string,
  runDir: string,
): Promise<Record<string, unknown> | null> {
  if (isAbsolute(runDir)) return null;
  try {
    const manifestPath = resolveInside(
      workspacePath,
      `${runDir.replace(/[\\/]+$/u, '')}/run-manifest.json`,
    );
    const manifest = objectValue(JSON.parse(await readFile(manifestPath, 'utf8')));
    return objectValue(manifest?.metrics);
  } catch {
    return null;
  }
}

async function resolveScreenDates(
  workspacePath: string,
  screen: ProjectScreen,
  runs: readonly ScreenGenerationRunEntry[],
): Promise<{ createdAt: DatedValue | null; updatedAt: DatedValue | null }> {
  const screenPath = screen.implementationFilePath ?? screen.filePath;
  const fileStat = screenPath ? await statWorkspaceFile(workspacePath, screenPath) : null;
  const runStarts = runs.map((run) => Date.parse(run.startedAt)).filter(Number.isFinite);
  const runCompletions = runs.map((run) => Date.parse(run.completedAt)).filter(Number.isFinite);
  const fileCreated = fileStat
    ? fileStat.birthtimeMs > 0
      ? fileStat.birthtimeMs
      : fileStat.mtimeMs
    : null;
  const estimatedCreated = runStarts.length > 0 ? Math.min(...runStarts) : fileCreated;
  const updatedCandidates = [...runCompletions, ...(fileStat?.mtimeMs ? [fileStat.mtimeMs] : [])];
  const estimatedUpdated =
    updatedCandidates.length > 0 ? Math.max(...updatedCandidates) : estimatedCreated;
  return {
    createdAt:
      screen.createdAt !== undefined
        ? { value: screen.createdAt, source: 'recorded' }
        : estimatedCreated !== null
          ? { value: estimatedCreated, source: 'estimated' }
          : null,
    updatedAt:
      screen.updatedAt !== undefined
        ? { value: screen.updatedAt, source: 'recorded' }
        : estimatedUpdated !== null
          ? { value: estimatedUpdated, source: 'estimated' }
          : null,
  };
}

async function statWorkspaceFile(workspacePath: string, filePath: string) {
  try {
    return await stat(resolveInside(workspacePath, filePath));
  } catch {
    return null;
  }
}

async function runDirectoryAvailable(workspacePath: string, runDir: string): Promise<boolean> {
  if (isAbsolute(runDir)) return false;
  try {
    return (await stat(resolveInside(workspacePath, runDir))).isDirectory();
  } catch {
    return false;
  }
}

function rowAttribution(row: DatasetRowLike, screenId: string): Attribution {
  const value = objectValue(row.screen_attribution)?.[screenId];
  if (value === 'active-screen' || value === 'receipt' || value === 'changed-files') return value;
  return row.screen_id === screenId ? 'active-screen' : 'receipt';
}

function attachments(value: unknown): ScreenRunAttachmentMeta[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = objectValue(item);
    const kind = record?.kind === 'text' ? 'text' : record?.kind === 'image' ? 'image' : null;
    const name = stringValue(record?.name);
    const mimeType = stringValue(record?.mime_type);
    const sha256 = stringValue(record?.sha256);
    const size = nonnegativeInteger(record?.size);
    if (!kind || !name || !mimeType || !sha256 || size === null) return [];
    const documentKind = documentKindValue(record?.document_kind);
    return [{ kind, name, mimeType, size, sha256, ...(documentKind ? { documentKind } : {}) }];
  });
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function nullableString(value: unknown): string | null {
  return value === null ? null : stringValue(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function nonnegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function nonnegativeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function isoValue(value: unknown): string | null {
  const text = stringValue(value);
  return text && Number.isFinite(Date.parse(text)) ? text : null;
}

function terminalStatus(value: unknown): ScreenGenerationRunEntry['status'] | null {
  return value === 'complete' ||
    value === 'failed' ||
    value === 'needs_review' ||
    value === 'cancelled'
    ? value
    : null;
}

function runRoute(value: unknown): ScreenGenerationRunEntry['route'] {
  return value === 'chat' || value === 'chat-stream' || value === 'manual' ? value : 'manual';
}

function sessionMode(value: unknown): AssistantSessionMode {
  return value === 'ask' || value === 'plan' || value === 'design' ? value : 'design';
}

function runtimeKind(value: unknown): ScreenGenerationRunEntry['runtimeKind'] {
  return value === 'api' || value === 'cli' ? value : null;
}

function documentKindValue(value: unknown): ScreenRunAttachmentMeta['documentKind'] | undefined {
  return value === 'html' ||
    value === 'css' ||
    value === 'markdown' ||
    value === 'json' ||
    value === 'yaml' ||
    value === 'plain'
    ? value
    : undefined;
}

function boundedLimit(value: string | undefined): number {
  const parsed = value ? Number(value) : 100;
  return Number.isInteger(parsed) ? Math.min(500, Math.max(1, parsed)) : 100;
}

function sumKnown(values: readonly (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length > 0 ? sum(known) : null;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
