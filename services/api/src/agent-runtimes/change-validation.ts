import { posix } from 'node:path';

import { readWorkspaceFile } from '../safe-fs';
import type { CanvasRuntimeHealth } from './render-health';
import {
  byteLength,
  changeKind,
  classifySourceDiff,
  formatPathList,
  highestSourceRisk,
  lineCount,
} from './change-validation-diff';

export type RuntimeTargetChangeKind = 'created' | 'modified' | 'deleted';
export type RuntimeSourceDiffRisk = 'none' | 'low_signal' | 'substantial';
export type RuntimeScreenshotDiffStatus = 'changed' | 'unchanged' | 'unavailable';
export type RuntimeVisibleAcceptanceStatus = 'accepted' | 'failed';
export type RuntimeStoryIdentityStatus = 'unchanged' | 'changed' | 'unavailable';
export type RuntimeStoryImplementationInvariantStatus = 'ok' | 'broken' | 'unavailable';

export interface RuntimeTargetSnapshot {
  path: string;
  before: string | null;
  beforeBytes: number;
  beforeLines: number;
}

export interface RuntimeTargetChange {
  path: string;
  kind: RuntimeTargetChangeKind;
  beforeBytes: number;
  afterBytes: number;
  beforeLines: number;
  afterLines: number;
  changedLineCount: number;
  changedCharacterCount: number;
  sourceRisk: RuntimeSourceDiffRisk;
  sourceRiskReasons: string[];
}

export interface RuntimeTargetChangeSummary {
  targetFiles: string[];
  changedFiles: string[];
  unchangedFiles: string[];
  missingFiles: string[];
  changedTargets: RuntimeTargetChange[];
}

export interface RuntimeExistingTargetState {
  status: 'non_empty' | 'empty' | 'missing';
  reason: string;
  files: string[];
}

export interface RuntimeScreenshotDiff {
  status: RuntimeScreenshotDiffStatus;
  changedByteRatio: number | null;
  threshold: number;
  beforeBytes: number;
  afterBytes: number;
  reason: string;
}

export interface RuntimeVisibleAcceptance {
  status: RuntimeVisibleAcceptanceStatus;
  reason: string;
  sourceRisk: RuntimeSourceDiffRisk;
  changedFiles: string[];
  visualDiff?: RuntimeScreenshotDiff;
}

export interface RuntimeStoryIdentityTarget {
  storyId?: string | null;
  filePath?: string | null;
  implementationFilePath?: string | null;
}

export interface RuntimeStoryIdentityCheck {
  status: RuntimeStoryIdentityStatus;
  reason: string;
  expectedStoryId?: string;
  storyFilePath?: string;
  title?: string;
  exportNames: string[];
  actualStoryIds: string[];
}

export interface RuntimeStoryImplementationInvariant {
  status: RuntimeStoryImplementationInvariantStatus;
  reasonCode:
    | 'no_story_target'
    | 'story_file_missing'
    | 'impl_file_missing'
    | 'story_component_missing'
    | 'story_import_missing'
    | 'impl_export_missing'
    | 'verified';
  reason: string;
  storyFilePath?: string;
  implementationFilePath?: string;
  componentName?: string;
  importedName?: string;
  implExports: string[];
}

export async function snapshotRuntimeTargetFiles(
  workspacePath: string,
  paths: string[],
): Promise<RuntimeTargetSnapshot[]> {
  const normalizedPaths = normalizeRuntimeTargetPaths(paths);
  const snapshots: RuntimeTargetSnapshot[] = [];
  for (const path of normalizedPaths) {
    const before = await readWorkspaceFile(workspacePath, path).catch(() => null);
    snapshots.push({
      path,
      before,
      beforeBytes: byteLength(before),
      beforeLines: lineCount(before),
    });
  }
  return snapshots;
}

export async function summarizeRuntimeTargetChanges(
  workspacePath: string,
  snapshots: RuntimeTargetSnapshot[],
): Promise<RuntimeTargetChangeSummary> {
  const changedTargets: RuntimeTargetChange[] = [];
  const unchangedFiles: string[] = [];
  const missingFiles: string[] = [];

  for (const snapshot of snapshots) {
    const after = await readWorkspaceFile(workspacePath, snapshot.path).catch(() => null);
    if (snapshot.before === after) {
      unchangedFiles.push(snapshot.path);
      if (after === null) missingFiles.push(snapshot.path);
      continue;
    }

    const sourceSignal = classifySourceDiff(snapshot.before, after);
    changedTargets.push({
      path: snapshot.path,
      kind: changeKind(snapshot.before, after),
      beforeBytes: snapshot.beforeBytes,
      afterBytes: byteLength(after),
      beforeLines: snapshot.beforeLines,
      afterLines: lineCount(after),
      changedLineCount: sourceSignal.changedLineCount,
      changedCharacterCount: sourceSignal.changedCharacterCount,
      sourceRisk: sourceSignal.risk,
      sourceRiskReasons: sourceSignal.reasons,
    });
  }

  return {
    targetFiles: snapshots.map((snapshot) => snapshot.path),
    changedFiles: changedTargets.map((target) => target.path),
    unchangedFiles,
    missingFiles,
    changedTargets,
  };
}

export function inspectExistingRuntimeTargetState(
  snapshots: RuntimeTargetSnapshot[],
): RuntimeExistingTargetState {
  const existing = snapshots.filter((snapshot) => snapshot.before !== null);
  if (existing.length === 0) {
    return {
      status: 'missing',
      reason: 'No target files existed before this run.',
      files: snapshots.map((snapshot) => snapshot.path),
    };
  }
  const screenRootFiles = existing.filter((snapshot) =>
    containsNonEmptyScreenRoot(snapshot.before ?? ''),
  );
  if (screenRootFiles.length > 0) {
    return {
      status: 'non_empty',
      reason: 'Existing target already contains a screen root.',
      files: screenRootFiles.map((snapshot) => snapshot.path),
    };
  }
  const nonEmptyFiles = existing.filter((snapshot) => (snapshot.before?.trim().length ?? 0) > 0);
  if (nonEmptyFiles.length > 0) {
    return {
      status: 'empty',
      reason: 'Existing target files are present but did not expose a screen root.',
      files: nonEmptyFiles.map((snapshot) => snapshot.path),
    };
  }
  return {
    status: 'empty',
    reason: 'Existing target files are empty.',
    files: existing.map((snapshot) => snapshot.path),
  };
}

function containsNonEmptyScreenRoot(source: string): boolean {
  if (!/\bdata-sd-screen-root\b/u.test(source)) return false;
  return !/\bdata-sd-empty-canvas\s*=\s*(?:"true"|'true'|\{true\})/u.test(source);
}

export function classifyRuntimeVisibleAcceptance(
  summary: RuntimeTargetChangeSummary,
  options: {
    visualDiff?: RuntimeScreenshotDiff | null;
    requireVisualEvidence?: boolean;
    renderHealth?: CanvasRuntimeHealth | null;
  } = {},
): RuntimeVisibleAcceptance {
  const visualDiff = options.visualDiff ?? undefined;
  const renderHealth = options.renderHealth ?? undefined;
  if (renderHealth?.status === 'failed') {
    return {
      status: 'failed',
      reason: renderHealth.reason,
      sourceRisk: highestSourceRisk(summary.changedTargets),
      changedFiles: summary.changedFiles,
      ...(visualDiff ? { visualDiff } : {}),
    };
  }
  if (summary.targetFiles.length > 0 && summary.changedTargets.length === 0) {
    return {
      status: 'failed',
      reason: 'No allowed target files changed.',
      sourceRisk: 'none',
      changedFiles: [],
      ...(visualDiff ? { visualDiff } : {}),
    };
  }
  if (summary.changedTargets.length === 0) {
    return {
      status: 'failed',
      reason: 'No changed target files were available for acceptance.',
      sourceRisk: 'none',
      changedFiles: [],
      ...(visualDiff ? { visualDiff } : {}),
    };
  }
  if (visualDiff?.status === 'changed') {
    return {
      status: 'accepted',
      reason: 'Screenshot diff crossed the visible-change threshold.',
      sourceRisk: highestSourceRisk(summary.changedTargets),
      changedFiles: summary.changedFiles,
      visualDiff,
    };
  }

  if (visualDiff?.status === 'unchanged') {
    return {
      status: 'accepted',
      reason:
        'Allowed files changed; screenshot diff stayed below the visible-change threshold, so the current screen should be rendered for iteration.',
      sourceRisk: highestSourceRisk(summary.changedTargets),
      changedFiles: summary.changedFiles,
      visualDiff,
    };
  }

  if (options.requireVisualEvidence && visualDiff?.status === 'unavailable') {
    return {
      status: 'accepted',
      reason: `Allowed files changed; external runtime render validation was unavailable: ${visualDiff.reason}`,
      sourceRisk: highestSourceRisk(summary.changedTargets),
      changedFiles: summary.changedFiles,
      visualDiff,
    };
  }

  const risk = highestSourceRisk(summary.changedTargets);
  if (risk === 'low_signal') {
    return {
      status: 'accepted',
      reason:
        'Allowed files changed, but the source diff is low-signal and visual diff evidence is unavailable; render the current screen for iteration.',
      sourceRisk: risk,
      changedFiles: summary.changedFiles,
      ...(visualDiff ? { visualDiff } : {}),
    };
  }

  return {
    status: 'accepted',
    reason: 'Allowed target files changed with substantial source diff evidence.',
    sourceRisk: risk,
    changedFiles: summary.changedFiles,
    ...(visualDiff ? { visualDiff } : {}),
  };
}

export function compareRuntimeScreenshotBytes(
  before: Uint8Array | null | undefined,
  after: Uint8Array | null | undefined,
  threshold = 0.001,
): RuntimeScreenshotDiff {
  const normalizedThreshold = Math.max(0, Math.min(1, threshold));
  if (!before || !after) {
    return {
      status: 'unavailable',
      changedByteRatio: null,
      threshold: normalizedThreshold,
      beforeBytes: before?.byteLength ?? 0,
      afterBytes: after?.byteLength ?? 0,
      reason: 'Before/after screenshots were not both available.',
    };
  }
  const maxLength = Math.max(before.byteLength, after.byteLength);
  if (maxLength === 0) {
    return {
      status: 'unchanged',
      changedByteRatio: 0,
      threshold: normalizedThreshold,
      beforeBytes: 0,
      afterBytes: 0,
      reason: 'Both screenshots were empty.',
    };
  }
  let changedBytes = Math.abs(before.byteLength - after.byteLength);
  const sharedLength = Math.min(before.byteLength, after.byteLength);
  for (let index = 0; index < sharedLength; index += 1) {
    if (before[index] !== after[index]) changedBytes += 1;
  }
  const changedByteRatio = changedBytes / maxLength;
  return {
    status: changedByteRatio >= normalizedThreshold ? 'changed' : 'unchanged',
    changedByteRatio,
    threshold: normalizedThreshold,
    beforeBytes: before.byteLength,
    afterBytes: after.byteLength,
    reason:
      changedByteRatio >= normalizedThreshold
        ? 'Screenshot byte diff crossed the threshold.'
        : 'Screenshot byte diff stayed below the threshold.',
  };
}

export async function checkRuntimeStoryIdentity(
  workspacePath: string,
  target: RuntimeStoryIdentityTarget | null | undefined,
): Promise<RuntimeStoryIdentityCheck> {
  const expectedStoryId = target?.storyId?.trim();
  const storyFilePath = target?.filePath ? normalizeRuntimeTargetPath(target.filePath) : null;
  if (!expectedStoryId || !storyFilePath) {
    return {
      status: 'unavailable',
      reason: 'No active Storybook story id and story file were available for validation.',
      ...(expectedStoryId ? { expectedStoryId } : {}),
      ...(storyFilePath ? { storyFilePath } : {}),
      exportNames: [],
      actualStoryIds: [],
    };
  }

  const source = await readWorkspaceFile(workspacePath, storyFilePath).catch(() => null);
  if (source === null) {
    return {
      status: 'changed',
      reason: `Active Storybook file could not be read: ${storyFilePath}.`,
      expectedStoryId,
      storyFilePath,
      exportNames: [],
      actualStoryIds: [],
    };
  }

  return inspectRuntimeStoryIdentity(source, {
    storyId: expectedStoryId,
    filePath: storyFilePath,
  });
}

export function inspectRuntimeStoryIdentity(
  source: string,
  target: { storyId: string; filePath: string },
): RuntimeStoryIdentityCheck {
  const expectedStoryId = target.storyId;
  const storyFilePath = target.filePath;
  const title = parseStorybookTitle(source);
  const exportNames = parseStoryExportNames(source);

  if (!title || exportNames.length === 0) {
    return {
      status: 'unavailable',
      reason: !title
        ? `Could not find a static Storybook title in ${storyFilePath}.`
        : `Could not find CSF story exports in ${storyFilePath}.`,
      expectedStoryId,
      storyFilePath,
      ...(title ? { title } : {}),
      exportNames,
      actualStoryIds: [],
    };
  }

  const actualStoryIds = exportNames.map((exportName) =>
    storybookIdFromTitleAndExport(title, exportName),
  );
  if (actualStoryIds.includes(expectedStoryId)) {
    return {
      status: 'unchanged',
      reason: 'The active Storybook id is still exported by the registered story file.',
      expectedStoryId,
      storyFilePath,
      title,
      exportNames,
      actualStoryIds,
    };
  }

  return {
    status: 'changed',
    reason: `Storybook id changed or disappeared for the active screen: expected ${expectedStoryId}.`,
    expectedStoryId,
    storyFilePath,
    title,
    exportNames,
    actualStoryIds,
  };
}

export async function checkRuntimeStoryImplementationInvariant(
  workspacePath: string,
  target: RuntimeStoryIdentityTarget | null | undefined,
): Promise<RuntimeStoryImplementationInvariant> {
  const storyFilePath = target?.filePath ? normalizeRuntimeTargetPath(target.filePath) : null;
  const implementationFilePath = target?.implementationFilePath
    ? normalizeRuntimeTargetPath(target.implementationFilePath)
    : null;
  if (!storyFilePath || !implementationFilePath) {
    return {
      status: 'unavailable',
      reasonCode: 'no_story_target',
      reason: 'No active Storybook wrapper and implementation file were available for validation.',
      ...(storyFilePath ? { storyFilePath } : {}),
      ...(implementationFilePath ? { implementationFilePath } : {}),
      implExports: [],
    };
  }

  const [storySource, implementationSource] = await Promise.all([
    readWorkspaceFile(workspacePath, storyFilePath).catch(() => null),
    readWorkspaceFile(workspacePath, implementationFilePath).catch(() => null),
  ]);
  if (storySource === null) {
    return {
      status: 'broken',
      reasonCode: 'story_file_missing',
      reason: `Active Storybook file could not be read: ${storyFilePath}.`,
      storyFilePath,
      implementationFilePath,
      implExports: [],
    };
  }
  if (implementationSource === null) {
    return {
      status: 'broken',
      reasonCode: 'impl_file_missing',
      reason: `Active screen implementation file could not be read: ${implementationFilePath}.`,
      storyFilePath,
      implementationFilePath,
      implExports: [],
    };
  }

  return inspectRuntimeStoryImplementationInvariant(storySource, implementationSource, {
    storyFilePath,
    implementationFilePath,
  });
}

export function inspectRuntimeStoryImplementationInvariant(
  storySource: string,
  implementationSource: string,
  target: { storyFilePath: string; implementationFilePath: string },
): RuntimeStoryImplementationInvariant {
  const componentName = parseStoryComponentName(storySource);
  const implExports = parseImplementationExportNames(implementationSource);
  if (!componentName) {
    return {
      status: 'unavailable',
      reasonCode: 'story_component_missing',
      reason: `Could not find a static Storybook component binding in ${target.storyFilePath}.`,
      storyFilePath: target.storyFilePath,
      implementationFilePath: target.implementationFilePath,
      implExports,
    };
  }

  const imported = parseStoryComponentImport(storySource, {
    componentName,
    storyFilePath: target.storyFilePath,
    implementationFilePath: target.implementationFilePath,
  });
  if (!imported) {
    return {
      status: 'unavailable',
      reasonCode: 'story_import_missing',
      reason: `Could not find the import that binds ${componentName} to ${target.implementationFilePath}.`,
      storyFilePath: target.storyFilePath,
      implementationFilePath: target.implementationFilePath,
      componentName,
      implExports,
    };
  }

  if (imported.importedName === 'default') {
    if (implementationHasDefaultExport(implementationSource)) {
      return verifiedStoryImplementationInvariant(
        target,
        componentName,
        imported.importedName,
        implExports,
      );
    }
  } else if (implExports.includes(imported.importedName)) {
    return verifiedStoryImplementationInvariant(
      target,
      componentName,
      imported.importedName,
      implExports,
    );
  }

  return {
    status: 'broken',
    reasonCode: 'impl_export_missing',
    reason: `Storybook wrapper imports ${imported.importedName} for ${componentName}, but ${target.implementationFilePath} does not export it.`,
    storyFilePath: target.storyFilePath,
    implementationFilePath: target.implementationFilePath,
    componentName,
    importedName: imported.importedName,
    implExports,
  };
}

export function formatRuntimeCompletionNotice(input: {
  runtimeLabel: string;
  summary: RuntimeTargetChangeSummary;
  acceptance: RuntimeVisibleAcceptance;
  storyIdentity?: RuntimeStoryIdentityCheck | null;
}): string {
  const storyLine =
    input.storyIdentity?.status === 'changed'
      ? `Storybook id: changed - expected ${input.storyIdentity.expectedStoryId ?? 'unknown'}, found ${formatPathList(
          input.storyIdentity.actualStoryIds,
        )}.`
      : input.storyIdentity?.status === 'unchanged'
        ? `Storybook id: unchanged (${input.storyIdentity.expectedStoryId}).`
        : null;
  return [
    '',
    '',
    `sber-designer: ${input.runtimeLabel} run summary`,
    `Changed files: ${formatPathList(input.summary.changedFiles)}.`,
    `Verification: ${input.acceptance.status} - ${input.acceptance.reason}`,
    storyLine,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

export function formatRuntimeStoryIdentityNotice(identity: RuntimeStoryIdentityCheck): string {
  return [
    '',
    '',
    'sber-designer: Storybook id changed for the active screen.',
    `Expected story id: ${identity.expectedStoryId ?? 'unknown'}.`,
    `Story file: ${identity.storyFilePath ?? 'unknown'}.`,
    `Current story ids in that file: ${formatPathList(identity.actualStoryIds)}.`,
    'This run was marked as failed because the canvas can no longer open the registered active story.',
  ].join('\n');
}

export function formatRuntimeChangeSummary(summary: RuntimeTargetChangeSummary): string {
  if (summary.targetFiles.length === 0) {
    return 'External runtime completed; no allowed target files were available for post-run diff validation.';
  }
  if (summary.changedTargets.length === 0) {
    return `External runtime produced no changes in allowed target files: ${formatPathList(summary.targetFiles)}.`;
  }
  return `External runtime changed ${summary.changedTargets.length} allowed target file${summary.changedTargets.length === 1 ? '' : 's'}: ${formatPathList(
    summary.changedTargets.map((target) => `${target.path} (${target.kind})`),
  )}.`;
}

export function formatRuntimeNoTargetChangeNotice(summary: RuntimeTargetChangeSummary): string {
  return [
    '',
    '',
    'sber-designer: The external runtime finished without changing any allowed target files.',
    `Checked: ${formatPathList(summary.targetFiles)}.`,
    'This run was marked as failed so the no-op is visible instead of looking like a successful screen update.',
  ].join('\n');
}

function normalizeRuntimeTargetPaths(paths: string[]): string[] {
  const normalized = new Set<string>();
  for (const rawPath of paths) {
    const path = normalizeRuntimeTargetPath(rawPath);
    if (path) normalized.add(path);
  }
  return [...normalized];
}

function parseStoryComponentName(source: string): string | null {
  return source.match(/\bcomponent\s*:\s*([A-Za-z_$][\w$]*)/u)?.[1] ?? null;
}

function parseStoryComponentImport(
  source: string,
  input: {
    componentName: string;
    storyFilePath: string;
    implementationFilePath: string;
  },
): { importedName: string } | null {
  const importPattern = /import\s+(?:type\s+)?([^;'"]+?)\s+from\s+['"]([^'"]+)['"]/gu;
  for (const match of source.matchAll(importPattern)) {
    const clause = match[1]?.trim();
    const modulePath = match[2]?.trim();
    if (!clause || !modulePath || !storyImportTargetsImplementation(input, modulePath)) continue;

    const defaultName = !clause.startsWith('{') ? clause.match(/^([A-Za-z_$][\w$]*)/)?.[1] : null;
    if (defaultName === input.componentName) return { importedName: 'default' };

    const braced = clause.match(/\{([^}]*)\}/)?.[1];
    if (!braced) continue;
    for (const part of braced.split(',')) {
      const [importedRaw, localRaw] = part.split(/\s+as\s+/u).map((item) => item.trim());
      const importedName = importedRaw ?? '';
      const localName = localRaw || importedName;
      if (localName === input.componentName && /^[A-Za-z_$][\w$]*$/u.test(importedName)) {
        return { importedName };
      }
    }
  }
  return null;
}

function storyImportTargetsImplementation(
  input: { storyFilePath: string; implementationFilePath: string },
  modulePath: string,
): boolean {
  if (!modulePath.startsWith('.')) return false;
  const resolved = posix.normalize(posix.join(posix.dirname(input.storyFilePath), modulePath));
  const implementation = stripSourceExtension(input.implementationFilePath);
  return stripSourceExtension(resolved) === implementation;
}

function stripSourceExtension(path: string): string {
  return path.replace(/\.[cm]?[tj]sx?$/u, '');
}

function parseImplementationExportNames(source: string): string[] {
  const names = new Set<string>();
  for (const match of source.matchAll(
    /\bexport\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gu,
  )) {
    if (match[1]) names.add(match[1]);
  }
  for (const match of source.matchAll(/\bexport\s*\{([^}]+)\}/gu)) {
    const body = match[1] ?? '';
    for (const part of body.split(',')) {
      const exportedName =
        part
          .trim()
          .split(/\s+as\s+/u)
          .at(-1)
          ?.trim() ?? '';
      if (/^[A-Za-z_$][\w$]*$/u.test(exportedName)) names.add(exportedName);
    }
  }
  return [...names].sort();
}

function implementationHasDefaultExport(source: string): boolean {
  return /\bexport\s+default\b/u.test(source);
}

function verifiedStoryImplementationInvariant(
  target: { storyFilePath: string; implementationFilePath: string },
  componentName: string,
  importedName: string,
  implExports: string[],
): RuntimeStoryImplementationInvariant {
  return {
    status: 'ok',
    reasonCode: 'verified',
    reason: 'The Storybook wrapper component binding is exported by the implementation file.',
    storyFilePath: target.storyFilePath,
    implementationFilePath: target.implementationFilePath,
    componentName,
    importedName,
    implExports,
  };
}

function normalizeRuntimeTargetPath(rawPath: string): string | null {
  const trimmed = rawPath
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '');
  if (!trimmed || trimmed.startsWith('/') || /^[A-Za-z]:\//u.test(trimmed)) return null;
  const normalized = posix.normalize(trimmed).replace(/^\.\/+/, '');
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    return null;
  }
  return normalized;
}

function parseStorybookTitle(source: string): string | null {
  const match = source.match(/\btitle\s*:\s*(['"`])([^'"`]+)\1/u);
  return match?.[2]?.trim() || null;
}

function parseStoryExportNames(source: string): string[] {
  const names = new Set<string>();
  for (const match of source.matchAll(/\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*(?::|=)/gu)) {
    const name = match[1];
    if (!name || name.startsWith('__')) continue;
    names.add(name);
  }
  return [...names];
}

function storybookIdFromTitleAndExport(title: string, exportName: string): string {
  const titleId = sanitizeStorybookId(title) || 'screens';
  const exportId = sanitizeStorybookId(exportName) || 'default';
  return `${titleId}--${exportId}`;
}

function sanitizeStorybookId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ ’–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}
