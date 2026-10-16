import type { Dirent } from 'node:fs';
import { readdir, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseDeploymentMode } from '@sber-designer/shared-types';
import { resolveInside } from '@sber-designer/ast-bridge';
import { listStateWorkspacePaths } from '../../state-store';
import { configuredProjectsRoot, isPathInside } from '../../user-storage';
import { completeAgentRun } from './manifest';
import { RUNS_ROOT, agentRunManifestPath, readRunManifest, requireRunId, runRoot } from './store';

const DEFAULT_RUN_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_EVENT_QUIET_MS = 15 * 60 * 1000;
const DEFAULT_REAPER_INTERVAL_MS = 5 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ReapOrphanedAgentRunsOptions {
  now?: number;
  runTimeoutMs?: number;
  eventQuietMs?: number;
}

export interface ReapedAgentRun {
  runId: string;
  reason: 'runtime_timeout' | 'orphaned';
  manifestPath: string;
  eventLogPath: string;
}

export interface ReapOrphanedAgentRunsResult {
  scanned: number;
  reaped: ReapedAgentRun[];
}

export interface ReapExpiredAgentRunsOptions {
  now?: number;
  retentionDays?: number | null;
}

export interface DeletedAgentRunArtifact {
  runId: string;
  reason: 'retention_expired';
  rootPath: string;
}

export interface ReapExpiredAgentRunsResult {
  scanned: number;
  deleted: DeletedAgentRunArtifact[];
  skippedRunning: string[];
}

export function resolveRunsRetentionDays(
  value = process.env.SBER_DESIGNER_RUNS_RETENTION_DAYS,
  deploymentMode = parseDeploymentMode(process.env.SBER_DESIGNER_DEPLOYMENT_MODE),
): number | null {
  if (deploymentMode === 'local') return null;
  const raw = value?.trim();
  if (!raw || raw === '0' || raw.toLowerCase() === 'off' || raw.toLowerCase() === 'false') {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('SBER_DESIGNER_RUNS_RETENTION_DAYS must be a positive integer, 0, or off.');
  }
  return parsed;
}

export async function reapOrphanedAgentRuns(
  workspacePath: string | null | undefined,
  options: ReapOrphanedAgentRunsOptions = {},
): Promise<ReapOrphanedAgentRunsResult> {
  if (!workspacePath) return { scanned: 0, reaped: [] };
  const now = options.now ?? Date.now();
  const runTimeoutMs = options.runTimeoutMs ?? DEFAULT_RUN_TIMEOUT_MS;
  const eventQuietMs = options.eventQuietMs ?? DEFAULT_EVENT_QUIET_MS;
  const runIds = await listRunIds(workspacePath);
  const reaped: ReapedAgentRun[] = [];
  let scanned = 0;
  for (const runId of runIds) {
    const manifest = await readRunManifest(workspacePath, runId);
    if (!manifest || manifest.status !== 'running') continue;
    scanned += 1;
    const ageMs = now - Math.max(manifest.updatedAt, manifest.createdAt);
    if (ageMs < runTimeoutMs) continue;
    const eventLogPath = runtimeEventLogPathForRun(runId);
    const eventFreshness = await runtimeEventLogFreshnessMs(workspacePath, runId, now);
    if (eventFreshness !== null && eventFreshness < eventQuietMs) continue;
    const reason = eventFreshness === null ? 'orphaned' : 'runtime_timeout';
    await completeAgentRun({
      workspacePath,
      runId,
      status: 'failed',
      summary:
        reason === 'orphaned'
          ? 'Agent run was left running without runtime events and was marked orphaned by the run-record reaper.'
          : 'Agent run stopped producing runtime events before completion and was marked failed by the run-record reaper.',
      diagnostics: {
        errorCode: reason,
        finishReason: 'timeout',
        runManifestPath: agentRunManifestPath(runId),
      },
    });
    reaped.push({
      runId,
      reason,
      manifestPath: agentRunManifestPath(runId).split('\\').join('/'),
      eventLogPath,
    });
  }
  return { scanned, reaped };
}

export async function reapExpiredAgentRunArtifacts(
  workspacePath: string | null | undefined,
  options: ReapExpiredAgentRunsOptions = {},
): Promise<ReapExpiredAgentRunsResult> {
  const retentionDays =
    options.retentionDays === undefined ? resolveRunsRetentionDays() : options.retentionDays;
  if (!workspacePath || retentionDays === null) {
    return { scanned: 0, deleted: [], skippedRunning: [] };
  }

  const now = options.now ?? Date.now();
  const cutoff = now - retentionDays * MS_PER_DAY;
  const runIds = await listRunIds(workspacePath);
  const deleted: DeletedAgentRunArtifact[] = [];
  const skippedRunning: string[] = [];
  let scanned = 0;

  for (const runId of runIds) {
    scanned += 1;
    const manifest = await readRunManifest(workspacePath, runId);
    if (manifest?.status === 'running') {
      skippedRunning.push(runId);
      continue;
    }

    const lastTouchedAt = await runArtifactTimestamp(workspacePath, runId);
    if (lastTouchedAt === null || lastTouchedAt >= cutoff) continue;

    await rm(runRoot(workspacePath, runId), { recursive: true, force: true });
    deleted.push({
      runId,
      reason: 'retention_expired',
      rootPath: join(RUNS_ROOT, requireRunId(runId)).split('\\').join('/'),
    });
  }

  return { scanned, deleted, skippedRunning };
}

export function startAgentRunReaper(
  input: {
    intervalMs?: number;
    runTimeoutMs?: number;
    eventQuietMs?: number;
    retentionDays?: number | null;
    getWorkspacePath?: () => string | null | undefined;
    getWorkspacePaths?: () =>
      | readonly (string | null | undefined)[]
      | Promise<readonly (string | null | undefined)[]>;
    onError?: (err: unknown) => void;
  } = {},
): () => void {
  const intervalMs = input.intervalMs ?? DEFAULT_REAPER_INTERVAL_MS;
  const retentionDays =
    input.retentionDays === undefined ? resolveRunsRetentionDays() : input.retentionDays;
  let running = false;
  const sweep = async () => {
    if (running) return;
    running = true;
    try {
      const workspacePaths = await resolveReaperWorkspacePaths(input);
      for (const workspacePath of workspacePaths) {
        await reapOrphanedAgentRuns(workspacePath, {
          ...(input.runTimeoutMs !== undefined ? { runTimeoutMs: input.runTimeoutMs } : {}),
          ...(input.eventQuietMs !== undefined ? { eventQuietMs: input.eventQuietMs } : {}),
        });
        if (retentionDays !== null) {
          await reapExpiredAgentRunArtifacts(workspacePath, { retentionDays });
        }
      }
    } catch (err) {
      input.onError?.(err);
    } finally {
      running = false;
    }
  };
  void sweep();
  const timer = setInterval(() => void sweep(), intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

export async function discoverAgentRunWorkspaces(): Promise<string[]> {
  const workspaces = new Set(
    listStateWorkspacePaths().map((workspacePath) => resolve(workspacePath)),
  );
  const projectsRoot = configuredProjectsRoot();
  if (!projectsRoot) return Array.from(workspaces).sort();

  let userEntries: Dirent[];
  try {
    userEntries = (await readdir(projectsRoot, { withFileTypes: true })) as Dirent[];
  } catch {
    return Array.from(workspaces).sort();
  }

  for (const userEntry of userEntries) {
    if (!userEntry.isDirectory() || userEntry.name.startsWith('.')) continue;
    const userRoot = join(projectsRoot, userEntry.name);
    let projectEntries: Dirent[];
    try {
      projectEntries = (await readdir(userRoot, { withFileTypes: true })) as Dirent[];
    } catch {
      continue;
    }
    for (const projectEntry of projectEntries) {
      if (!projectEntry.isDirectory() || projectEntry.name.startsWith('.')) continue;
      const workspacePath = resolve(userRoot, projectEntry.name);
      if (!isPathInside(projectsRoot, workspacePath)) continue;
      const hasRunsRoot = await stat(join(workspacePath, RUNS_ROOT))
        .then((entry) => entry.isDirectory())
        .catch(() => false);
      if (hasRunsRoot) workspaces.add(workspacePath);
    }
  }
  return Array.from(workspaces).sort();
}

async function resolveReaperWorkspacePaths(input: {
  getWorkspacePath?: () => string | null | undefined;
  getWorkspacePaths?: () =>
    | readonly (string | null | undefined)[]
    | Promise<readonly (string | null | undefined)[]>;
}): Promise<string[]> {
  const candidates = input.getWorkspacePaths
    ? await input.getWorkspacePaths()
    : input.getWorkspacePath
      ? [input.getWorkspacePath()]
      : await discoverAgentRunWorkspaces();
  return Array.from(
    new Set(
      candidates.flatMap((workspacePath) =>
        workspacePath?.trim() ? [resolve(workspacePath)] : [],
      ),
    ),
  );
}

async function listRunIds(workspacePath: string): Promise<string[]> {
  const runsRoot = resolveInside(workspacePath, RUNS_ROOT);
  let entries: Dirent[];
  try {
    entries = (await readdir(runsRoot, { withFileTypes: true })) as Dirent[];
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    if (!entry.isDirectory()) return [];
    try {
      return [requireRunId(String(entry.name))];
    } catch {
      return [];
    }
  });
}

async function runArtifactTimestamp(workspacePath: string, runId: string): Promise<number | null> {
  const manifest = await readRunManifest(workspacePath, runId);
  if (manifest) {
    return Math.max(manifest.updatedAt, manifest.createdAt, manifest.completedAt ?? 0);
  }
  try {
    const info = await stat(runRoot(workspacePath, runId));
    return info.mtimeMs;
  } catch {
    return null;
  }
}

async function runtimeEventLogFreshnessMs(
  workspacePath: string,
  runId: string,
  now: number,
): Promise<number | null> {
  try {
    const info = await stat(resolveInside(workspacePath, runtimeEventLogPathForRun(runId)));
    return now - info.mtimeMs;
  } catch {
    return null;
  }
}

function runtimeEventLogPathForRun(runId: string): string {
  return join(RUNS_ROOT, requireRunId(runId), 'external-runtime/events.jsonl')
    .split('\\')
    .join('/');
}
