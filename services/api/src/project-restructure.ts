import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, posix } from 'node:path';
import { resolveInside } from '@sber-designer/ast-bridge';
import { getHtmlProjectStructureReport } from '@sber-designer/design-indexer';
import {
  HTML_DESIGN_SYSTEM_PATHS,
  isHtmlDesignSystemPath,
  type HtmlProjectRestructureReceipt,
  type HtmlProjectStructureLink,
  type HtmlProjectStructureMapping,
  type ProjectScreen,
} from '@sber-designer/shared-types';

import { recordToolReceiptSafely } from './agent/run-recorder';
import { regenerateHtmlDesignSystemPreview } from './html-design-system-preview';
import { loadProjectForWorkspace, saveProject } from './project-store';
import { runProjectIndexJobNow } from './project-index/indexing-runner';
import {
  deleteWorkspaceFile,
  readWorkspaceFile,
  renameWorkspaceFile,
  workspaceFileExistsExact,
  writeWorkspaceFile,
} from './safe-fs';

export interface ApplyHtmlProjectRestructureInput {
  workspacePath: string;
  planDigest: string;
  confirmedByUser: true;
  runId?: string | null;
  canvasUrl?: string | null;
}

interface FileSnapshot {
  path: string;
  contents: Uint8Array | null;
}

export async function applyHtmlProjectRestructure(
  input: ApplyHtmlProjectRestructureInput,
): Promise<HtmlProjectRestructureReceipt> {
  const report = await getHtmlProjectStructureReport(input.workspacePath);
  assertApplicablePlan(report, input.planDigest, input.confirmedByUser);
  if (report.alreadyCanonical) {
    const receipt = noOpReceipt(report);
    await recordRestructureReceipt(input, receipt);
    return receipt;
  }

  const moves = report.proposedMappings.filter(isMoveMapping);
  const removedManaged = report.proposedMappings.filter(
    (mapping): mapping is HtmlProjectStructureMapping & { sourcePath: string } =>
      mapping.action === 'remove-managed' && Boolean(mapping.sourcePath),
  );
  const creates = report.proposedMappings.filter((mapping) => mapping.action === 'create');
  const movedPaths = new Map(moves.map((mapping) => [mapping.sourcePath, mapping.targetPath]));
  const linkRewrites = report.links.filter(
    (link): link is HtmlProjectStructureLink & { proposedReference: string } =>
      Boolean(link.proposedReference),
  );
  const snapshotPaths = unique([
    ...report.proposedMappings.flatMap((mapping) =>
      [mapping.sourcePath, mapping.targetPath].filter((path): path is string => Boolean(path)),
    ),
    ...linkRewrites.map((link) => movedPaths.get(link.sourcePath) ?? link.sourcePath),
    '.sber-designer/project.sdproj',
    'index.html',
    HTML_DESIGN_SYSTEM_PATHS.previewHtml,
  ]);
  const snapshots = await snapshotWorkspaceFiles(input.workspacePath, snapshotPaths);
  const stageRoot = `.sber-designer/restructure-staging/${report.planDigest.slice(0, 12)}`;
  const movedFiles: Array<{ fromPath: string; toPath: string }> = [];
  const createdFiles: string[] = [];
  const removedManagedFiles: string[] = [];
  const rewrittenLinks: Array<{ sourcePath: string; from: string; to: string }> = [];

  try {
    await applyMovesThroughStaging(input.workspacePath, moves, stageRoot, movedFiles);
    for (const mapping of removedManaged) {
      await deleteWorkspaceFile(input.workspacePath, mapping.sourcePath);
      removedManagedFiles.push(mapping.sourcePath);
    }
    for (const mapping of creates) {
      if (await workspaceFileExistsExact(input.workspacePath, mapping.targetPath)) {
        throw new Error(`Restructure target appeared after planning: ${mapping.targetPath}`);
      }
      await writeWorkspaceFile(input.workspacePath, mapping.targetPath, '');
      createdFiles.push(mapping.targetPath);
    }
    for (const rewrite of linkRewrites) {
      const sourcePath = movedPaths.get(rewrite.sourcePath) ?? rewrite.sourcePath;
      const changed = await rewriteLocalReference(
        input.workspacePath,
        sourcePath,
        rewrite.reference,
        rewrite.proposedReference,
      );
      if (changed) {
        rewrittenLinks.push({
          sourcePath,
          from: rewrite.reference,
          to: rewrite.proposedReference,
        });
      }
    }

    const preFinalizeReport = await getHtmlProjectStructureReport(input.workspacePath);
    const project = await loadProjectForWorkspace(input.workspacePath);
    const { screens, registeredScreenIds } = await reconcileHtmlProjectScreens({
      workspacePath: input.workspacePath,
      existing: project.screens,
      pagePaths: preFinalizeReport.pageCandidates.filter((path) => path.startsWith('pages/')),
      movedPaths,
    });
    const validScreenIds = new Set(screens.map((screen) => screen.id));
    await saveProject({
      ...project,
      workspacePath: input.workspacePath,
      projectKind: 'html-first',
      screens,
      flow: project.flow.filter(
        (edge) => validScreenIds.has(edge.fromScreenId) && validScreenIds.has(edge.toScreenId),
      ),
    });
    const preview = await regenerateHtmlDesignSystemPreview(
      input.workspacePath,
      project.name || basename(input.workspacePath) || 'HTML project',
    );
    const job = await runProjectIndexJobNow({
      workspaceRoot: input.workspacePath,
      projectName: project.name || basename(input.workspacePath) || 'HTML project',
      enrich: false,
      ...(input.canvasUrl ? { canvasUrl: input.canvasUrl } : {}),
    });
    if (job.status === 'failed') throw new Error(job.error ?? 'Project index generation failed.');
    const postCheck = await getHtmlProjectStructureReport(input.workspacePath);
    const changedFiles = unique([
      ...movedFiles.flatMap((move) => [move.fromPath, move.toPath]),
      ...createdFiles,
      ...removedManagedFiles,
      ...rewrittenLinks.map((rewrite) => rewrite.sourcePath),
      '.sber-designer/project.sdproj',
      'index.html',
      preview.changedFile,
      ...preview.descriptionSections.changedFiles,
      ...job.changedFiles,
    ]);
    const receipt: HtmlProjectRestructureReceipt = {
      version: 1,
      planDigest: report.planDigest,
      previousStatus: report.status,
      finalStatus: postCheck.status,
      completed: postCheck.alreadyCanonical,
      movedFiles,
      createdFiles,
      removedManagedFiles,
      rewrittenLinks,
      registeredScreenIds,
      changedFiles,
      previewFile: preview.changedFile,
      reindexJobId: job.id,
      postCheck,
    };
    await recordRestructureReceipt(input, receipt);
    await rm(resolveInside(input.workspacePath, stageRoot), { recursive: true, force: true });
    return receipt;
  } catch (error) {
    await restoreWorkspaceFiles(input.workspacePath, snapshots);
    await rm(resolveInside(input.workspacePath, stageRoot), { recursive: true, force: true }).catch(
      () => undefined,
    );
    await runProjectIndexJobNow({
      workspaceRoot: input.workspacePath,
      projectName: basename(input.workspacePath) || 'HTML project',
      enrich: false,
      ...(input.canvasUrl ? { canvasUrl: input.canvasUrl } : {}),
    }).catch(() => undefined);
    throw error;
  }
}

function assertApplicablePlan(
  report: Awaited<ReturnType<typeof getHtmlProjectStructureReport>>,
  planDigest: string,
  confirmedByUser: boolean,
): void {
  if (!confirmedByUser) throw new Error('Explicit user confirmation is required.');
  if (report.planDigest !== planDigest) {
    throw new Error(
      'The project changed after the plan was shown. Generate and confirm a new report.',
    );
  }
  if (!report.supported || report.status === 'unsupported') {
    throw new Error(report.reason);
  }
  if (report.status === 'missing') {
    throw new Error('No static HTML structure was found. Use the design-system bootstrap actions.');
  }
  if (report.truncated) {
    throw new Error(
      'The structure scan was truncated. Narrow the workspace before applying moves.',
    );
  }
  if (report.conflicts.length > 0) {
    throw new Error(
      `Resolve restructure conflicts first: ${report.conflicts.map((item) => item.targetPath).join(', ')}`,
    );
  }
}

function isMoveMapping(
  mapping: HtmlProjectStructureMapping,
): mapping is HtmlProjectStructureMapping & { sourcePath: string } {
  return mapping.action === 'move' && Boolean(mapping.sourcePath);
}

async function applyMovesThroughStaging(
  workspacePath: string,
  mappings: Array<HtmlProjectStructureMapping & { sourcePath: string }>,
  stageRoot: string,
  receipt: Array<{ fromPath: string; toPath: string }>,
): Promise<void> {
  const staged: Array<{
    mapping: HtmlProjectStructureMapping & { sourcePath: string };
    stagePath: string;
  }> = [];
  for (const [index, mapping] of mappings.entries()) {
    if (!(await workspaceFileExistsExact(workspacePath, mapping.sourcePath))) {
      throw new Error(`Planned source is missing: ${mapping.sourcePath}`);
    }
    const stagePath = posix.join(stageRoot, `${index}${extname(mapping.sourcePath)}`);
    await renameWorkspaceFile(workspacePath, mapping.sourcePath, stagePath);
    staged.push({ mapping, stagePath });
  }
  for (const item of staged) {
    if (await workspaceFileExistsExact(workspacePath, item.mapping.targetPath)) {
      throw new Error(`Restructure target already exists: ${item.mapping.targetPath}`);
    }
    await renameWorkspaceFile(workspacePath, item.stagePath, item.mapping.targetPath);
    receipt.push({ fromPath: item.mapping.sourcePath, toPath: item.mapping.targetPath });
  }
}

async function rewriteLocalReference(
  workspacePath: string,
  sourcePath: string,
  from: string,
  to: string,
): Promise<boolean> {
  const contents = await readWorkspaceFile(workspacePath, sourcePath);
  const escaped = escapeRegExp(from);
  const htmlPattern = new RegExp(`((?:href|src)\\s*=\\s*["'])${escaped}(["'])`, 'giu');
  const cssPattern = new RegExp(`(url\\(\\s*["']?)${escaped}(["']?\\s*\\))`, 'giu');
  const next = contents.replace(htmlPattern, `$1${to}$2`).replace(cssPattern, `$1${to}$2`);
  if (next === contents) return false;
  await writeWorkspaceFile(workspacePath, sourcePath, next);
  return true;
}

async function reconcileHtmlProjectScreens(input: {
  workspacePath: string;
  existing: ProjectScreen[];
  pagePaths: string[];
  movedPaths: Map<string, string>;
}): Promise<{ screens: ProjectScreen[]; registeredScreenIds: string[] }> {
  const finalPaths = unique(input.pagePaths).sort();
  const existingByPath = new Map<string, ProjectScreen>();
  for (const screen of input.existing) {
    const originalPath = normalizePath(screen.implementationFilePath ?? screen.filePath ?? '');
    if (!originalPath) continue;
    const finalPath = input.movedPaths.get(originalPath) ?? originalPath;
    if (!isHtmlDesignSystemPath(finalPath)) existingByPath.set(finalPath, screen);
  }
  const usedIds = new Set(input.existing.map((screen) => screen.id));
  const screens: ProjectScreen[] = [];
  for (const path of finalPaths) {
    const existing = existingByPath.get(path);
    if (existing) {
      screens.push({ ...existing, kind: 'page', filePath: path, implementationFilePath: path });
      continue;
    }
    const id = uniqueScreenId(path, usedIds);
    usedIds.add(id);
    screens.push({
      id,
      name: await screenNameFromHtml(input.workspacePath, path),
      kind: 'page',
      filePath: path,
      implementationFilePath: path,
    });
  }
  const preserved = input.existing.filter(
    (screen) => screen.kind === 'story' && !screens.some((candidate) => candidate.id === screen.id),
  );
  return {
    screens: [...screens, ...preserved],
    registeredScreenIds: screens.map((screen) => screen.id),
  };
}

async function screenNameFromHtml(workspacePath: string, path: string): Promise<string> {
  const contents = await readWorkspaceFile(workspacePath, path).catch(() => '');
  const title = /<title[^>]*>([^<]+)<\/title>/iu.exec(contents)?.[1]?.trim();
  if (title) return title;
  return basename(path, extname(path))
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function uniqueScreenId(path: string, used: Set<string>): string {
  const base = `page-${path
    .replace(/\.[^.]+$/u, '')
    .replace(/[^a-z0-9]+/giu, '-')
    .replace(/^-|-$/gu, '')
    .toLowerCase()}`;
  let candidate = base || 'page-screen';
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function snapshotWorkspaceFiles(
  workspacePath: string,
  paths: string[],
): Promise<FileSnapshot[]> {
  return Promise.all(
    paths.map(async (path) => ({
      path,
      contents: await readFile(resolveInside(workspacePath, path)).catch(() => null),
    })),
  );
}

async function restoreWorkspaceFiles(
  workspacePath: string,
  snapshots: FileSnapshot[],
): Promise<void> {
  for (const snapshot of snapshots) {
    const absolute = resolveInside(workspacePath, snapshot.path);
    if (snapshot.contents === null) {
      await rm(absolute, { force: true }).catch(() => undefined);
      continue;
    }
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, snapshot.contents);
  }
}

function noOpReceipt(
  report: Awaited<ReturnType<typeof getHtmlProjectStructureReport>>,
): HtmlProjectRestructureReceipt {
  return {
    version: 1,
    planDigest: report.planDigest,
    previousStatus: report.status,
    finalStatus: report.status,
    completed: true,
    movedFiles: [],
    createdFiles: [],
    removedManagedFiles: [],
    rewrittenLinks: [],
    registeredScreenIds: [],
    changedFiles: [],
    previewFile: null,
    reindexJobId: null,
    postCheck: report,
  };
}

async function recordRestructureReceipt(
  input: ApplyHtmlProjectRestructureInput,
  receipt: HtmlProjectRestructureReceipt,
): Promise<void> {
  await recordToolReceiptSafely({
    workspacePath: input.workspacePath,
    runId: input.runId,
    tool: 'apply_project_restructure',
    status: receipt.completed ? 'ok' : 'error',
    changedFiles: receipt.changedFiles,
    summary: receipt.completed
      ? `Project restructure completed: ${receipt.movedFiles.length} moved, ${receipt.rewrittenLinks.length} link rewrites.`
      : 'Project files changed, but the deterministic post-check still requires attention.',
    metadata: {
      planDigest: receipt.planDigest,
      previousStatus: receipt.previousStatus,
      finalStatus: receipt.finalStatus,
      movedFiles: receipt.movedFiles,
      createdFiles: receipt.createdFiles,
      removedManagedFiles: receipt.removedManagedFiles,
      rewrittenLinks: receipt.rewrittenLinks,
      registeredScreenIds: receipt.registeredScreenIds,
      reindexJobId: receipt.reindexJobId,
      brokenLinks: receipt.postCheck.brokenLinks,
      manualFollowUps: receipt.postCheck.manualFollowUps,
    },
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function normalizePath(value: string): string {
  return value.replace(/\\/gu, '/').replace(/^\.\//u, '');
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
