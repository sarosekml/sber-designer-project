import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProjectScreen, ProjectScreenHealth } from '@sber-designer/shared-types';

interface RunHealthEvidence {
  runId: string;
  status?: string | undefined;
  summary?: string | undefined;
  updatedAt: number;
  reviewedAt?: number;
  changedFiles: Set<string>;
  hasMutationEvidence: boolean;
  renderHealth?: RuntimeRenderHealthEvidence;
}

interface RuntimeRenderHealthEvidence {
  status: string;
  summary?: string | undefined;
  updatedAt: number;
}

interface RunManifestLike {
  runId?: unknown;
  status?: unknown;
  summary?: unknown;
  updatedAt?: unknown;
  completedAt?: unknown;
  activeScreen?: unknown;
}

const RUNS_ROOT = '.sber-designer/runs';

export async function annotateProjectScreensWithHealth(
  workspaceRoot: string,
  screens: ProjectScreen[],
): Promise<ProjectScreen[]> {
  if (!workspaceRoot || screens.length === 0) return screens;
  const runEvidence = await readRunHealthEvidence(workspaceRoot);
  if (runEvidence.length === 0) return screens;

  return screens.map((screen) => {
    const paths = screenComparablePaths(screen);
    const run = runEvidence.find((candidate) =>
      Array.from(paths).some((path) => candidate.changedFiles.has(path)),
    );
    if (!run) return screen;
    if (isManualHealthCurrent(screen.health, run)) return screen;
    const health = screenHealthFromRunEvidence(run);
    if (health === undefined) return screen;
    if (health === null) return withoutScreenHealth(screen);
    return { ...screen, health };
  });
}

function isManualHealthCurrent(
  health: ProjectScreenHealth | undefined,
  run: RunHealthEvidence,
): boolean {
  if (health?.source !== 'manual') return false;
  return (health.updatedAt ?? 0) >= Math.max(run.updatedAt, run.reviewedAt ?? 0);
}

function screenHealthFromRunEvidence(
  run: RunHealthEvidence,
): ProjectScreenHealth | null | undefined {
  // The machine terminal outcome remains immutable evidence, while the
  // explicit human review acknowledges the current screen result as ready.
  if (run.reviewedAt !== undefined) return null;
  if (run.renderHealth?.status === 'ok') return null;
  if (run.renderHealth?.status === 'error' || run.renderHealth?.status === 'failed') {
    return renderErrorHealth(run.renderHealth);
  }
  if (run.renderHealth?.status === 'warning' || run.renderHealth?.status === 'needs_review') {
    return renderNeedsReviewHealth(run.renderHealth);
  }
  if (run.renderHealth?.status === 'skipped') {
    return run.status === 'complete' || run.status === 'needs_review' || run.hasMutationEvidence
      ? renderNeedsReviewHealth(run.renderHealth)
      : undefined;
  }
  if (run.renderHealth?.status === 'unavailable') {
    return run.status === 'needs_review' || run.hasMutationEvidence
      ? renderNeedsReviewHealth(run.renderHealth)
      : undefined;
  }
  if (run.status === 'needs_review') {
    return run.hasMutationEvidence ? runNeedsReviewHealth(run) : undefined;
  }
  if (run.status === 'failed') {
    return run.hasMutationEvidence ? runNeedsReviewHealth(run) : undefined;
  }
  if (run.status === 'complete') {
    return run.hasMutationEvidence ? null : undefined;
  }
  return undefined;
}

function renderErrorHealth(renderHealth: RuntimeRenderHealthEvidence): ProjectScreenHealth {
  const summary = compactReason(renderHealth.summary);
  return {
    status: 'broken',
    source: 'validation',
    updatedAt: renderHealth.updatedAt,
    reason: summary ?? 'Canvas render verification failed. Open the assistant history for details.',
  };
}

function renderNeedsReviewHealth(renderHealth: RuntimeRenderHealthEvidence): ProjectScreenHealth {
  const summary = compactReason(renderHealth.summary);
  return {
    status: 'needs-review',
    source: 'validation',
    updatedAt: renderHealth.updatedAt,
    reason: summary ?? 'Canvas render verification could not prove this screen renders.',
  };
}

function runNeedsReviewHealth(run: RunHealthEvidence): ProjectScreenHealth {
  const summary = compactReason(run.summary);
  return {
    status: 'needs-review',
    source: 'validation',
    updatedAt: run.updatedAt,
    reason:
      summary ??
      'Agent changed this screen, but final render validation did not complete. Continue the run or verify the canvas.',
  };
}

async function readRunHealthEvidence(workspaceRoot: string): Promise<RunHealthEvidence[]> {
  const root = join(workspaceRoot, RUNS_ROOT);
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const runs: RunHealthEvidence[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const runRoot = join(root, entry.name);
    const manifest = await readJson<RunManifestLike>(join(runRoot, 'run-manifest.json'));
    if (!manifest) continue;
    const runId = typeof manifest.runId === 'string' ? manifest.runId : entry.name;
    const updatedAt = timestampFromManifest(manifest);
    const reviewedAt = reviewTimestamp(
      await readJson<unknown>(join(runRoot, 'review.json')),
      runId,
    );
    const activeScreenFiles = new Set<string>();
    const changedFiles = new Set<string>();
    const mutationFiles = new Set<string>();
    collectActiveScreenPaths(manifest.activeScreen, activeScreenFiles);
    let summary = typeof manifest.summary === 'string' ? manifest.summary : undefined;
    let renderHealth: RuntimeRenderHealthEvidence | undefined;
    const timeline = await readTimeline(runRoot);
    for (const event of timeline) {
      for (const filePath of readChangedFiles(event)) {
        changedFiles.add(normalizeWorkspacePath(filePath));
        if (isMutationEvidence(event)) mutationFiles.add(normalizeWorkspacePath(filePath));
      }
      if (!summary && isRecord(event) && typeof event.summary === 'string') {
        summary = event.summary;
      }
      renderHealth = newestRenderHealth(renderHealth, readRuntimeRenderHealth(event, updatedAt));
    }
    for (const receipt of await readReceipts(runRoot)) {
      for (const filePath of readChangedFiles(receipt)) {
        changedFiles.add(normalizeWorkspacePath(filePath));
        if (isMutationEvidence(receipt)) mutationFiles.add(normalizeWorkspacePath(filePath));
      }
      renderHealth = newestRenderHealth(renderHealth, readRuntimeRenderHealth(receipt, updatedAt));
    }
    const comparableFiles = new Set([...activeScreenFiles, ...changedFiles]);
    if (comparableFiles.size === 0) continue;
    runs.push({
      runId,
      status: typeof manifest.status === 'string' ? manifest.status : undefined,
      summary,
      updatedAt,
      ...(reviewedAt !== undefined ? { reviewedAt } : {}),
      changedFiles: comparableFiles,
      hasMutationEvidence: mutationFiles.size > 0,
      ...(renderHealth ? { renderHealth } : {}),
    });
  }
  runs.sort((a, b) => b.updatedAt - a.updatedAt);
  return runs;
}

async function readTimeline(runRoot: string): Promise<unknown[]> {
  const raw = await readFile(join(runRoot, 'timeline.jsonl'), 'utf8').catch(() => '');
  if (!raw.trim()) return [];
  return raw
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as unknown;
      } catch {
        return null;
      }
    })
    .filter((event): event is unknown => event !== null);
}

async function readReceipts(runRoot: string): Promise<unknown[]> {
  const receiptsRoot = join(runRoot, 'receipts');
  const entries = await readdir(receiptsRoot, { withFileTypes: true }).catch(() => []);
  const receipts: unknown[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const receipt = await readJson<unknown>(join(receiptsRoot, entry.name));
    if (receipt) receipts.push(receipt);
  }
  return receipts;
}

function newestRenderHealth(
  current: RuntimeRenderHealthEvidence | undefined,
  candidate: RuntimeRenderHealthEvidence | undefined,
): RuntimeRenderHealthEvidence | undefined {
  if (!candidate) return current;
  if (!current || candidate.updatedAt >= current.updatedAt) return candidate;
  return current;
}

function readRuntimeRenderHealth(
  value: unknown,
  fallbackUpdatedAt: number,
): RuntimeRenderHealthEvidence | undefined {
  if (!isRecord(value) || value.tool !== 'runtime_render_health') return undefined;
  const status = normalizeRenderHealthStatus(value);
  if (!status) return undefined;
  return {
    status,
    summary: readRenderHealthSummary(value),
    updatedAt: typeof value.createdAt === 'number' ? value.createdAt : fallbackUpdatedAt,
  };
}

function isMutationEvidence(value: unknown): boolean {
  if (!isRecord(value) || typeof value.tool !== 'string') return false;
  return (
    value.tool === 'write_file' ||
    value.tool === 'apply_patch' ||
    value.tool === 'screen_create' ||
    value.tool === 'screen_update' ||
    value.tool === 'screen_remove' ||
    value.tool === 'flow_add_edge' ||
    value.tool === 'flow_remove_edge'
  );
}

function normalizeRenderHealthStatus(value: Record<string, unknown>): string | undefined {
  const metadata = value.metadata;
  if (isRecord(metadata)) {
    const health = metadata.health;
    if (isRecord(health) && typeof health.status === 'string') {
      if (health.status === 'failed') return 'error';
      return health.status;
    }
  }
  return typeof value.status === 'string' ? value.status : undefined;
}

function readRenderHealthSummary(value: Record<string, unknown>): string | undefined {
  if (typeof value.summary === 'string') return value.summary;
  const metadata = value.metadata;
  if (!isRecord(metadata)) return undefined;
  const health = metadata.health;
  if (!isRecord(health) || typeof health.reason !== 'string') return undefined;
  return health.reason;
}

function readChangedFiles(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.changedFiles)) return [];
  return value.changedFiles.filter((filePath): filePath is string => typeof filePath === 'string');
}

function collectActiveScreenPaths(activeScreen: unknown, changedFiles: Set<string>): void {
  if (!isRecord(activeScreen)) return;
  for (const key of ['filePath', 'implementationFilePath'] as const) {
    const value = activeScreen[key];
    if (typeof value === 'string') changedFiles.add(normalizeWorkspacePath(value));
  }
}

function screenComparablePaths(screen: ProjectScreen): Set<string> {
  const paths = new Set<string>();
  for (const path of [screen.filePath, screen.implementationFilePath]) {
    if (!path) continue;
    const normalized = normalizeWorkspacePath(path);
    paths.add(normalized);
    const derived = derivePeerScreenPath(normalized);
    if (derived) paths.add(derived);
  }
  return paths;
}

function withoutScreenHealth(screen: ProjectScreen): ProjectScreen {
  const { health: _health, ...rest } = screen;
  return rest;
}

function derivePeerScreenPath(path: string): string | null {
  const storyMatch = path.match(/^src\/stories\/screens\/(.+)\/([^/]+)\.stories\.[cm]?[tj]sx?$/u);
  if (storyMatch) {
    return `src/screens/${storyMatch[1]}/${storyMatch[2]}.tsx`;
  }
  const implementationMatch = path.match(/^src\/screens\/(.+)\/([^/]+)\.[cm]?[tj]sx?$/u);
  if (implementationMatch) {
    return `src/stories/screens/${implementationMatch[1]}/${implementationMatch[2]}.stories.tsx`;
  }
  return null;
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

function timestampFromManifest(manifest: RunManifestLike): number {
  const completedAt = typeof manifest.completedAt === 'number' ? manifest.completedAt : null;
  const updatedAt = typeof manifest.updatedAt === 'number' ? manifest.updatedAt : null;
  return completedAt ?? updatedAt ?? Date.now();
}

function reviewTimestamp(value: unknown, runId: string): number | undefined {
  if (!isRecord(value) || value.version !== 1 || value.runId !== runId) return undefined;
  if (typeof value.reviewedAt !== 'string') return undefined;
  const timestamp = Date.parse(value.reviewedAt);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function compactReason(value: string | undefined): string | undefined {
  const trimmed = value?.replace(/\s+/gu, ' ').trim();
  if (!trimmed) return undefined;
  return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed;
}

function normalizeWorkspacePath(path: string): string {
  return path.replace(/\\/gu, '/').replace(/^\.\//u, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
