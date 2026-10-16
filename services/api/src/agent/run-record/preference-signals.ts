/**
 * Deterministic B4 preference signals derived from consecutive source states.
 * The artifact stores hashes and structural features only, never source text.
 */
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { resolveInside } from '@sber-designer/ast-bridge';

import { ensureProjectPreferencesDerived, PREFERENCE_EVENTS_PATH } from '../../project-preferences';
import { readWorkspaceFile } from '../../safe-fs';
import type { AgentRunManifest, AgentToolReceipt } from './types';
import { RUNS_ROOT, runRoot, writeJson } from './store';

export const RUN_SOURCE_PREFERENCE_SNAPSHOT_FILE = 'source-preference-snapshot.json';

type DensityDirection = 'denser' | 'more-spacious';
type SourceChangeCategory = 'colors' | 'density' | 'copy' | 'other';

interface SourceFeatureDigest {
  digest: string;
  count: number;
}

export interface SourcePreferenceFeatures {
  colors: SourceFeatureDigest;
  copy: SourceFeatureDigest;
  density: Record<string, number[]>;
}

export interface RunSourcePreferenceSnapshot {
  version: 1;
  run_id: string;
  completed_at: number;
  screen_id: string;
  screen_name: string | null;
  target_path: string;
  source_sha256: string;
  features: SourcePreferenceFeatures;
}

interface StoredSnapshot extends RunSourcePreferenceSnapshot {
  mtimeMs: number;
}

interface PreferenceTarget {
  screenId: string;
  screenName: string | null;
  path: string;
}

interface AutomaticPreferenceCandidate {
  kind: 'prefer';
  text: string;
  basis: 'density-decreased' | 'density-increased';
}

interface AutomaticPreferenceEvent {
  version: 1;
  event_id: string;
  type: 'follow_up_edit' | 'source_revert';
  created_at: string;
  run_id: string;
  previous_run_id: string;
  reverted_run_id: string | null;
  reverted_to_run_id: string | null;
  screen_id: string;
  screen_name: string | null;
  target_path: string;
  before_sha256: string;
  after_sha256: string;
  changed_categories: SourceChangeCategory[];
  preference: AutomaticPreferenceCandidate | null;
}

const eventAppendQueues = new Map<string, Promise<boolean>>();

/**
 * Runs after terminal finalization. Failed/cancelled runs and source changes
 * without a matching run receipt are preserved as evidence but never learned.
 */
export async function recordAutomaticProjectPreferenceSignal(input: {
  workspacePath: string;
  manifest: AgentRunManifest;
  receipts: AgentToolReceipt[];
}): Promise<void> {
  if (input.manifest.status !== 'complete' && input.manifest.status !== 'needs_review') return;
  const taskKind = await sourcePreferenceTaskKind(input.workspacePath, input.manifest);
  if (
    taskKind !== 'screen-generation' &&
    taskKind !== 'image-to-screen' &&
    taskKind !== 'screen-edit' &&
    taskKind !== 'screen-redesign'
  ) {
    return;
  }
  const target = preferenceTarget(input.manifest);
  if (!target) return;
  const normalizedTargetPath = normalizePath(target.path);
  if (!receiptsChangedTarget(input.receipts, normalizedTargetPath)) return;

  const existingSnapshot = await readCurrentSnapshot(input.workspacePath, input.manifest.runId);
  const source = existingSnapshot
    ? null
    : await readWorkspaceFile(input.workspacePath, target.path).catch(() => null);
  if (!existingSnapshot && source === null) return;
  const snapshot: RunSourcePreferenceSnapshot =
    existingSnapshot ??
    ({
      version: 1,
      run_id: input.manifest.runId,
      completed_at: input.manifest.completedAt ?? input.manifest.updatedAt,
      screen_id: target.screenId,
      screen_name: target.screenName,
      target_path: normalizedTargetPath,
      source_sha256: sha256(source as string),
      features: sourcePreferenceFeatures(source as string),
    } satisfies RunSourcePreferenceSnapshot);
  const history = await readPreferenceSnapshotHistory(input.workspacePath, snapshot);
  const previous = history.at(-1) ?? null;

  if (!existingSnapshot) {
    await writeJson(
      resolveInside(
        runRoot(input.workspacePath, input.manifest.runId),
        RUN_SOURCE_PREFERENCE_SNAPSHOT_FILE,
      ),
      snapshot,
    );
  }

  if (
    !previous ||
    previous.source_sha256 === snapshot.source_sha256 ||
    (taskKind !== 'screen-edit' && taskKind !== 'screen-redesign')
  ) {
    return;
  }

  const revertedTo = [...history]
    .slice(0, -1)
    .reverse()
    .find((candidate) => candidate.source_sha256 === snapshot.source_sha256);
  const delta = compareSourcePreferenceFeatures(previous.features, snapshot.features);
  const type = revertedTo ? 'source_revert' : 'follow_up_edit';
  const event: AutomaticPreferenceEvent = {
    version: 1,
    event_id: `source-preference-${input.manifest.runId}`,
    type,
    created_at: new Date(snapshot.completed_at).toISOString(),
    run_id: input.manifest.runId,
    previous_run_id: previous.run_id,
    reverted_run_id: revertedTo ? previous.run_id : null,
    reverted_to_run_id: revertedTo?.run_id ?? null,
    screen_id: snapshot.screen_id,
    screen_name: snapshot.screen_name,
    target_path: snapshot.target_path,
    before_sha256: previous.source_sha256,
    after_sha256: snapshot.source_sha256,
    changed_categories: delta.categories,
    preference: densityPreferenceCandidate(delta.densityDirection),
  };
  const appended = await appendPreferenceEventOnce(input.workspacePath, event);
  if (appended) {
    await ensureProjectPreferencesDerived(input.workspacePath).catch(() => undefined);
  }
}

export function sourcePreferenceFeatures(source: string): SourcePreferenceFeatures {
  const density = densityFeatures(source);
  return {
    colors: featureDigest(colorTokens(source)),
    copy: featureDigest(copyFragments(source)),
    density,
  };
}

export function compareSourcePreferenceFeatures(
  before: SourcePreferenceFeatures,
  after: SourcePreferenceFeatures,
): { categories: SourceChangeCategory[]; densityDirection: DensityDirection | null } {
  const categories: SourceChangeCategory[] = [];
  if (before.colors.digest !== after.colors.digest) categories.push('colors');
  if (JSON.stringify(before.density) !== JSON.stringify(after.density)) categories.push('density');
  if (before.copy.digest !== after.copy.digest) categories.push('copy');
  if (categories.length === 0) categories.push('other');
  return { categories, densityDirection: densityDirection(before.density, after.density) };
}

function preferenceTarget(manifest: AgentRunManifest): PreferenceTarget | null {
  const intent = manifest.assistantTaskIntent;
  if (intent?.kind === 'create-screen-from-story' || intent?.kind === 'fill-generated-screen') {
    const path = intent.targetImplementationFilePath ?? intent.targetStoryFilePath;
    return {
      screenId: intent.targetScreenId,
      screenName: intent.targetName,
      path,
    };
  }
  const active = manifest.activeScreen;
  const path = active?.implementationFilePath ?? active?.filePath;
  if (!active || !path) return null;
  return { screenId: active.id, screenName: active.name ?? null, path };
}

async function sourcePreferenceTaskKind(
  workspacePath: string,
  manifest: AgentRunManifest,
): Promise<string | null> {
  if (manifest.assistantTaskIntent?.kind === 'edit-current-screen') return 'screen-edit';
  if (
    manifest.assistantTaskIntent?.kind === 'create-screen-from-story' ||
    manifest.assistantTaskIntent?.kind === 'fill-generated-screen'
  ) {
    return 'screen-generation';
  }
  try {
    const componentPack = JSON.parse(
      await readFile(
        resolveInside(runRoot(workspacePath, manifest.runId), 'component-pack.json'),
        'utf8',
      ),
    ) as { taskKind?: unknown };
    return typeof componentPack.taskKind === 'string' ? componentPack.taskKind : null;
  } catch {
    return null;
  }
}

function receiptsChangedTarget(receipts: AgentToolReceipt[], targetPath: string): boolean {
  return receipts.some((receipt) =>
    receipt.changedFiles.some((path) => normalizePath(path) === targetPath),
  );
}

async function readPreferenceSnapshotHistory(
  workspacePath: string,
  current: RunSourcePreferenceSnapshot,
): Promise<StoredSnapshot[]> {
  const root = resolveInside(workspacePath, RUNS_ROOT);
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const snapshots: StoredSnapshot[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === current.run_id) continue;
    const path = resolveInside(root, join(entry.name, RUN_SOURCE_PREFERENCE_SNAPSHOT_FILE));
    try {
      const [value, info] = await Promise.all([
        readFile(path, 'utf8').then((source) => JSON.parse(source) as unknown),
        stat(path),
      ]);
      const snapshot = parseStoredSnapshot(value, info.mtimeMs);
      if (
        snapshot &&
        snapshot.screen_id === current.screen_id &&
        snapshot.target_path === current.target_path
      ) {
        snapshots.push(snapshot);
      }
    } catch {
      // Missing or malformed historical evidence is ignored; the current
      // snapshot still establishes a baseline for the next run.
    }
  }
  return snapshots.sort(
    (left, right) =>
      left.completed_at - right.completed_at ||
      left.mtimeMs - right.mtimeMs ||
      left.run_id.localeCompare(right.run_id),
  );
}

async function readCurrentSnapshot(
  workspacePath: string,
  runId: string,
): Promise<RunSourcePreferenceSnapshot | null> {
  const path = resolveInside(runRoot(workspacePath, runId), RUN_SOURCE_PREFERENCE_SNAPSHOT_FILE);
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as unknown;
    const snapshot = parseStoredSnapshot(value, 0);
    if (!snapshot || snapshot.run_id !== runId) return null;
    return snapshot;
  } catch {
    return null;
  }
}

function parseStoredSnapshot(value: unknown, mtimeMs: number): StoredSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const snapshot = value as Partial<RunSourcePreferenceSnapshot>;
  if (
    snapshot.version !== 1 ||
    typeof snapshot.run_id !== 'string' ||
    typeof snapshot.completed_at !== 'number' ||
    typeof snapshot.screen_id !== 'string' ||
    typeof snapshot.target_path !== 'string' ||
    typeof snapshot.source_sha256 !== 'string' ||
    !isSourcePreferenceFeatures(snapshot.features)
  ) {
    return null;
  }
  return {
    version: 1,
    run_id: snapshot.run_id,
    completed_at: snapshot.completed_at,
    screen_id: snapshot.screen_id,
    screen_name: typeof snapshot.screen_name === 'string' ? snapshot.screen_name : null,
    target_path: normalizePath(snapshot.target_path),
    source_sha256: snapshot.source_sha256,
    features: snapshot.features,
    mtimeMs,
  };
}

function isSourcePreferenceFeatures(value: unknown): value is SourcePreferenceFeatures {
  if (!value || typeof value !== 'object') return false;
  const features = value as Partial<SourcePreferenceFeatures>;
  return (
    isFeatureDigest(features.colors) &&
    isFeatureDigest(features.copy) &&
    Boolean(features.density) &&
    typeof features.density === 'object' &&
    Object.values(features.density).every(
      (samples) => Array.isArray(samples) && samples.every((sample) => typeof sample === 'number'),
    )
  );
}

function isFeatureDigest(value: unknown): value is SourceFeatureDigest {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as SourceFeatureDigest).digest === 'string' &&
    typeof (value as SourceFeatureDigest).count === 'number'
  );
}

function densityFeatures(source: string): Record<string, number[]> {
  const features = new Map<string, number[]>();
  for (const classList of classAttributeValues(source)) {
    for (const rawToken of classList.split(/\s+/u)) {
      const token = rawToken.split(':').at(-1) ?? rawToken;
      const match = token.match(
        /^(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|h|min-h|max-h|leading)-(?:([0-9]+(?:\.[0-9]+)?)|\[([0-9]+(?:\.[0-9]+)?)(px|rem|em)?\])$/u,
      );
      if (!match) continue;
      addDensitySample(features, `tw:${match[1]}`, Number(match[2] ?? match[3]));
    }
  }

  for (const match of source.matchAll(
    /\b(padding(?:-?(?:top|right|bottom|left|inline|block))?|margin(?:-?(?:top|right|bottom|left|inline|block))?|gap|row-?gap|column-?gap|height|min-?height|max-?height|line-?height)\s*:\s*['"]?(-?[0-9]+(?:\.[0-9]+)?)\s*(px|rem|em)?/giu,
  )) {
    const value = Number(match[2]);
    const rawProperty = match[1];
    if (!rawProperty || !Number.isFinite(value) || value < 0) continue;
    const property = rawProperty
      .replace(/[A-Z]/gu, (character) => `-${character.toLowerCase()}`)
      .toLowerCase();
    addDensitySample(features, `css:${property}:${(match[3] ?? 'unitless').toLowerCase()}`, value);
  }

  return Object.fromEntries(
    [...features.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, values]) => [key, values.sort((left, right) => left - right)]),
  );
}

function addDensitySample(target: Map<string, number[]>, key: string, value: number): void {
  if (!Number.isFinite(value)) return;
  target.set(key, [...(target.get(key) ?? []), value]);
}

function densityDirection(
  before: Record<string, number[]>,
  after: Record<string, number[]>,
): DensityDirection | null {
  const ratios: number[] = [];
  for (const key of Object.keys(before)) {
    const beforeSamples = before[key];
    const afterSamples = after[key];
    if (!beforeSamples || !afterSamples) continue;
    const beforeMedian = median(beforeSamples);
    const afterMedian = median(afterSamples);
    if (beforeMedian <= 0 || afterMedian <= 0) continue;
    const ratio = afterMedian / beforeMedian;
    if (ratio <= 0.9 || ratio >= 1.1) ratios.push(ratio);
  }
  if (ratios.length === 0) return null;
  const decreased = ratios.filter((ratio) => ratio < 1).length;
  const increased = ratios.filter((ratio) => ratio > 1).length;
  const directionRatio = median(ratios);
  if (decreased / ratios.length >= 0.6 && directionRatio <= 0.85) return 'denser';
  if (increased / ratios.length >= 0.6 && directionRatio >= 1.15) return 'more-spacious';
  return null;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function densityPreferenceCandidate(
  direction: DensityDirection | null,
): AutomaticPreferenceCandidate | null {
  if (direction === 'denser') {
    return { kind: 'prefer', text: 'Use denser screen layouts.', basis: 'density-decreased' };
  }
  if (direction === 'more-spacious') {
    return {
      kind: 'prefer',
      text: 'Use more spacious screen layouts.',
      basis: 'density-increased',
    };
  }
  return null;
}

function colorTokens(source: string): string[] {
  const tokens = new Set<string>();
  for (const match of source.matchAll(
    /#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\([^)]*\)|var\(--[a-z0-9_-]+\)/giu,
  )) {
    tokens.add(match[0].toLowerCase());
  }
  for (const classList of classAttributeValues(source)) {
    for (const rawToken of classList.split(/\s+/u)) {
      const token = rawToken.split(':').at(-1) ?? rawToken;
      if (!/^(?:bg|text|border|ring|fill|stroke|from|via|to)-[a-z]/u.test(token)) continue;
      if (
        /^text-(?:xs|sm|base|lg|xl|[2-9]xl|left|center|right|justify|wrap|nowrap|ellipsis)$/u.test(
          token,
        )
      )
        continue;
      tokens.add(token.toLowerCase());
    }
  }
  return [...tokens];
}

function copyFragments(source: string): string[] {
  const fragments = new Set<string>();
  for (const match of source.matchAll(/>([^<>{}]+)</gu)) {
    const value = normalizeFragment(match[1] ?? '');
    if (value) fragments.add(value);
  }
  for (const match of source.matchAll(
    /\b(?:aria-label|label|placeholder|title)\s*=\s*(?:"([^"]+)"|'([^']+)')/giu,
  )) {
    const value = normalizeFragment(match[1] ?? match[2] ?? '');
    if (value) fragments.add(value);
  }
  return [...fragments];
}

function classAttributeValues(source: string): string[] {
  const values: string[] = [];
  for (const match of source.matchAll(
    /\bclass(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`\s*\})/giu,
  )) {
    values.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  return values;
}

function normalizeFragment(value: string): string | null {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  return /[\p{L}\p{N}]/u.test(normalized) ? normalized : null;
}

function featureDigest(values: string[]): SourceFeatureDigest {
  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right),
  );
  return { digest: sha256(JSON.stringify(normalized)), count: normalized.length };
}

async function appendPreferenceEventOnce(
  workspacePath: string,
  event: AutomaticPreferenceEvent,
): Promise<boolean> {
  const path = resolveInside(workspacePath, PREFERENCE_EVENTS_PATH);
  const previous = eventAppendQueues.get(path) ?? Promise.resolve(false);
  const pending = previous
    .catch(() => false)
    .then(async () => {
      const current = await readFile(path, 'utf8').catch(() => '');
      if (hasEventId(current, event.event_id)) return false;
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, `${JSON.stringify(event)}\n`, 'utf8');
      return true;
    });
  eventAppendQueues.set(path, pending);
  try {
    return await pending;
  } finally {
    if (eventAppendQueues.get(path) === pending) eventAppendQueues.delete(path);
  }
}

function hasEventId(source: string, eventId: string): boolean {
  return source.split(/\r?\n/u).some((line) => {
    if (!line.trim()) return false;
    try {
      return (JSON.parse(line) as { event_id?: unknown }).event_id === eventId;
    } catch {
      return false;
    }
  });
}

function normalizePath(path: string): string {
  return path.replace(/\\/gu, '/').replace(/^\.\//u, '');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
