import { mkdir, readdir, readFile, rename, rmdir, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { resolveInside } from '@sber-designer/ast-bridge';

import { invalidateStorybookCache } from './storybook-cache';

export interface RenameWorkspaceScreenFolderInput {
  from: string;
  to: string;
}

export interface RenameWorkspaceScreenFolderResult {
  movedPaths: { from: string; to: string }[];
  updatedFiles: string[];
}

export interface RenameWorkspaceScreenInput {
  storyFilePath: string;
  implementationFilePath?: string | undefined;
  toName: string;
}

export interface RenameWorkspaceScreenResult {
  storyFilePath: string;
  implementationFilePath?: string;
  storyId: string;
  movedPaths: { from: string; to: string }[];
  updatedFiles: string[];
}

export interface MoveWorkspaceScreenToFolderInput {
  storyFilePath: string;
  implementationFilePath?: string | undefined;
  toFolder: string;
}

export interface MoveWorkspaceScreenToFolderResult {
  storyFilePath: string;
  implementationFilePath?: string;
  storyId: string;
  movedPaths: { from: string; to: string }[];
  updatedFiles: string[];
  removedEmptyDirs: string[];
}

const STORY_FILE_RE = /\.stories\.[jt]sx?$/iu;

export async function renameWorkspaceScreenFolder(
  workspaceRoot: string,
  input: RenameWorkspaceScreenFolderInput,
): Promise<RenameWorkspaceScreenFolderResult> {
  const from = normalizeFolderSegment(input.from);
  const to = normalizeFolderSegment(input.to);
  if (from === to) return { movedPaths: [], updatedFiles: [] };

  const movedPaths: RenameWorkspaceScreenFolderResult['movedPaths'] = [];
  for (const [fromPath, toPath] of [
    [`src/stories/screens/${from}`, `src/stories/screens/${to}`],
    [`src/screens/${from}`, `src/screens/${to}`],
  ] as const) {
    const moved = await renameWorkspaceDirIfPresent(workspaceRoot, fromPath, toPath);
    if (moved) movedPaths.push(moved);
  }

  const updatedFiles = await rewriteStoryFilesInFolder(
    workspaceRoot,
    `src/stories/screens/${to}`,
    from,
    to,
  );

  // Stale Storybook cache entries pointing at the old folder path break the
  // whole index build (task 9999 LIVE-1). Clear it so the next build re-globs.
  if (movedPaths.length > 0) await invalidateStorybookCache(workspaceRoot);

  return { movedPaths, updatedFiles };
}

export async function renameWorkspaceScreen(
  workspaceRoot: string,
  input: RenameWorkspaceScreenInput,
): Promise<RenameWorkspaceScreenResult> {
  const cleanName = normalizeScreenName(input.toName);
  const storyFilePath = normalizeWorkspacePath(input.storyFilePath);
  const storyInfo = parseStoryFilePath(storyFilePath);
  const componentName = toComponentName(cleanName);
  const targetStoryFilePath = `${storyInfo.dir}/${componentName}.stories.${storyInfo.extension}`;
  const implementationFilePath = input.implementationFilePath
    ? normalizeWorkspacePath(input.implementationFilePath)
    : undefined;
  const targetImplementationFilePath = implementationFilePath
    ? `${dirnamePath(implementationFilePath)}/${componentName}.${fileExtension(implementationFilePath)}`
    : undefined;

  const movedPaths: RenameWorkspaceScreenResult['movedPaths'] = [];
  const storyMove = await renameWorkspaceFileIfPresent(
    workspaceRoot,
    storyFilePath,
    targetStoryFilePath,
  );
  if (storyMove) movedPaths.push(storyMove);
  const implementationMove = targetImplementationFilePath
    ? await renameWorkspaceFileIfPresent(
        workspaceRoot,
        implementationFilePath!,
        targetImplementationFilePath,
      )
    : null;
  if (implementationMove) movedPaths.push(implementationMove);

  const storyAbs = resolveInside(workspaceRoot, targetStoryFilePath);
  const storyBefore = await readFile(storyAbs, 'utf8');
  const oldComponentName = extractStoryComponentName(storyBefore) ?? componentName;
  const storyTitle = `Screens/${storyInfo.folder}/${cleanName}`;
  const storyAfter = rewriteScreenStoryReferences(storyBefore, {
    cleanName,
    componentName,
    ...(targetImplementationFilePath !== undefined
      ? { implementationFilePath: targetImplementationFilePath }
      : {}),
    oldComponentName,
    storyFilePath: targetStoryFilePath,
    storyTitle,
  });
  const updatedFiles: string[] = [];
  if (storyAfter !== storyBefore) {
    await writeFile(storyAbs, storyAfter, 'utf8');
    updatedFiles.push(targetStoryFilePath);
  }

  if (targetImplementationFilePath) {
    const implementationAbs = resolveInside(workspaceRoot, targetImplementationFilePath);
    const implementationBefore = await readFile(implementationAbs, 'utf8').catch(() => null);
    if (implementationBefore !== null) {
      const implementationAfter = replaceIdentifier(
        implementationBefore,
        oldComponentName,
        componentName,
      );
      if (implementationAfter !== implementationBefore) {
        await writeFile(implementationAbs, implementationAfter, 'utf8');
        updatedFiles.push(targetImplementationFilePath);
      }
    }
  }

  // See note above: a moved story/impl file strands Storybook's cache → index 500.
  if (movedPaths.length > 0) await invalidateStorybookCache(workspaceRoot);

  return {
    storyFilePath: targetStoryFilePath,
    ...(targetImplementationFilePath
      ? { implementationFilePath: targetImplementationFilePath }
      : {}),
    storyId: storybookIdFromTitleAndExport(storyTitle, 'Default'),
    movedPaths,
    updatedFiles,
  };
}

/**
 * Move a single generated screen between folders on disk. Relocates the
 * thin Storybook story and its editable implementation file, rewrites the
 * CSF `title` and the relative import to the implementation, recomputes the
 * story id, and removes the now-empty source folders. This is the per-screen
 * analog of `renameWorkspaceScreenFolder` and the disk side of the editor's
 * "Move to folder" action (task 0077).
 */
export async function moveWorkspaceScreenToFolder(
  workspaceRoot: string,
  input: MoveWorkspaceScreenToFolderInput,
): Promise<MoveWorkspaceScreenToFolderResult> {
  const toFolder = normalizeFolderSegment(input.toFolder);
  const storyFilePath = normalizeWorkspacePath(input.storyFilePath);
  const storyInfo = parseStoryFilePath(storyFilePath);
  const fromFolder = storyInfo.folder;
  const implementationFilePath = input.implementationFilePath
    ? normalizeWorkspacePath(input.implementationFilePath)
    : undefined;

  if (fromFolder === toFolder) {
    const storyAbs = resolveInside(workspaceRoot, storyFilePath);
    const current = await readFile(storyAbs, 'utf8').catch(() => '');
    return {
      storyFilePath,
      ...(implementationFilePath ? { implementationFilePath } : {}),
      storyId: storyIdFromStorySource(current, toFolder),
      movedPaths: [],
      updatedFiles: [],
      removedEmptyDirs: [],
    };
  }

  const storyBaseName = baseName(storyFilePath);
  const targetStoryFilePath = `src/stories/screens/${toFolder}/${storyBaseName}`;
  const targetImplementationFilePath = implementationFilePath
    ? `src/screens/${toFolder}/${baseName(implementationFilePath)}`
    : undefined;

  const movedPaths: MoveWorkspaceScreenToFolderResult['movedPaths'] = [];
  const storyMove = await renameWorkspaceFileIfPresent(
    workspaceRoot,
    storyFilePath,
    targetStoryFilePath,
  );
  if (storyMove) movedPaths.push(storyMove);
  if (implementationFilePath && targetImplementationFilePath) {
    const implMove = await renameWorkspaceFileIfPresent(
      workspaceRoot,
      implementationFilePath,
      targetImplementationFilePath,
    );
    if (implMove) movedPaths.push(implMove);
  }

  const updatedFiles: string[] = [];
  const storyAbs = resolveInside(workspaceRoot, targetStoryFilePath);
  const before = await readFile(storyAbs, 'utf8').catch(() => null);
  let storyId: string;
  if (before !== null) {
    const after = rewriteStoryFolderReferences(before, fromFolder, toFolder);
    if (after !== before) {
      await writeFile(storyAbs, after, 'utf8');
      updatedFiles.push(targetStoryFilePath);
    }
    storyId = storyIdFromStorySource(after, toFolder);
  } else {
    storyId = storybookIdFromTitleAndExport(`Screens/${toFolder}`, 'Default');
  }

  const removedEmptyDirs = await removeEmptyScreenFolderDirs(workspaceRoot, fromFolder);

  // A moved story/impl file strands Storybook's cache → index 500 (LIVE-1).
  if (movedPaths.length > 0) await invalidateStorybookCache(workspaceRoot);

  return {
    storyFilePath: targetStoryFilePath,
    ...(targetImplementationFilePath
      ? { implementationFilePath: targetImplementationFilePath }
      : {}),
    storyId,
    movedPaths,
    updatedFiles,
    removedEmptyDirs,
  };
}

function baseName(filePath: string): string {
  return filePath.split('/').filter(Boolean).at(-1) ?? filePath;
}

function storyIdFromStorySource(source: string, fallbackFolder: string): string {
  const title = /title\s*:\s*['"`](Screens\/[^'"`]+)['"`]/u.exec(source)?.[1];
  return storybookIdFromTitleAndExport(title ?? `Screens/${fallbackFolder}`, 'Default');
}

async function removeEmptyScreenFolderDirs(
  workspaceRoot: string,
  folder: string,
): Promise<string[]> {
  const removed: string[] = [];
  for (const dir of [`src/stories/screens/${folder}`, `src/screens/${folder}`]) {
    const abs = resolveInside(workspaceRoot, dir);
    const entries = await readdir(abs).catch(() => null);
    if (entries && entries.length === 0) {
      const ok = await rmdir(abs)
        .then(() => true)
        .catch(() => false);
      if (ok) {
        removed.push(dir);
      }
    }
  }
  return removed;
}

function normalizeFolderSegment(value: string): string {
  const folder = value.trim();
  if (!folder) throw new Error('Screen folder name cannot be empty.');
  if (folder === '.' || folder === '..' || folder.includes('/') || folder.includes('\\')) {
    throw new Error(`Invalid screen folder name: ${value}`);
  }
  if (folder.includes('\0')) throw new Error('Screen folder name cannot contain null bytes.');
  return folder;
}

function normalizeScreenName(value: string): string {
  const name = value.trim();
  if (!name) throw new Error('Screen name cannot be empty.');
  return name;
}

function normalizeWorkspacePath(value: string): string {
  const path = value
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '');
  if (!path || path.includes('\0')) throw new Error(`Invalid workspace path: ${value}`);
  return path;
}

async function renameWorkspaceDirIfPresent(
  workspaceRoot: string,
  fromPath: string,
  toPath: string,
): Promise<{ from: string; to: string } | null> {
  const fromAbs = resolveInside(workspaceRoot, fromPath);
  const toAbs = resolveInside(workspaceRoot, toPath);
  const sourceExists = await isDirectory(fromAbs);
  if (!sourceExists) return null;
  if (await pathExists(toAbs)) {
    throw new Error(`Cannot rename ${fromPath} to ${toPath}: destination already exists.`);
  }
  await mkdir(dirname(toAbs), { recursive: true });
  await rename(fromAbs, toAbs);
  return { from: fromPath, to: toPath };
}

async function renameWorkspaceFileIfPresent(
  workspaceRoot: string,
  fromPath: string,
  toPath: string,
): Promise<{ from: string; to: string } | null> {
  if (fromPath === toPath) return null;
  const fromAbs = resolveInside(workspaceRoot, fromPath);
  const toAbs = resolveInside(workspaceRoot, toPath);
  if (!(await isFile(fromAbs))) return null;
  if (await pathExists(toAbs)) {
    throw new Error(`Cannot rename ${fromPath} to ${toPath}: destination already exists.`);
  }
  await mkdir(dirname(toAbs), { recursive: true });
  await rename(fromAbs, toAbs);
  return { from: fromPath, to: toPath };
}

async function rewriteStoryFilesInFolder(
  workspaceRoot: string,
  folderPath: string,
  from: string,
  to: string,
): Promise<string[]> {
  const files = await collectStoryFiles(workspaceRoot, folderPath);
  const updated: string[] = [];
  for (const filePath of files) {
    const abs = resolveInside(workspaceRoot, filePath);
    const before = await readFile(abs, 'utf8');
    const after = rewriteStoryFolderReferences(before, from, to);
    if (after === before) continue;
    await writeFile(abs, after, 'utf8');
    updated.push(filePath);
  }
  return updated;
}

async function collectStoryFiles(workspaceRoot: string, folderPath: string): Promise<string[]> {
  const abs = resolveInside(workspaceRoot, folderPath);
  const entries = await readdir(abs, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const child = `${folderPath}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await collectStoryFiles(workspaceRoot, child)));
      continue;
    }
    if (entry.isFile() && STORY_FILE_RE.test(entry.name)) files.push(child);
  }
  return files;
}

function rewriteScreenStoryReferences(
  source: string,
  input: {
    cleanName: string;
    componentName: string;
    implementationFilePath?: string;
    oldComponentName: string;
    storyFilePath: string;
    storyTitle: string;
  },
): string {
  let next = source.replace(
    /import\s+type\s*\{\s*Meta\s*,\s*StoryObj\s*\}\s*from\s*['"][^'"]+['"];?/u,
    "import type { Meta, StoryObj } from '@storybook/react';",
  );
  if (input.implementationFilePath) {
    const importPath = relativeImportPath(input.storyFilePath, input.implementationFilePath);
    const importRe = new RegExp(
      `import\\s*\\{\\s*${escapeRegExp(input.oldComponentName)}\\s*\\}\\s*from\\s*['"][^'"]+['"];?`,
      'u',
    );
    const replacement = `import { ${input.componentName} } from '${importPath}';`;
    next = importRe.test(next)
      ? next.replace(importRe, replacement)
      : next.replace(
          /from\s*['"](?:\.\.\/)+(?:screens|pages)\/[^'"]+['"]/u,
          `from '${importPath}'`,
        );
  }
  next = replaceIdentifier(next, input.oldComponentName, input.componentName);
  next = next.replace(
    /title\s*:\s*(['"`])Screens\/[^'"`]+\/[^'"`]+(['"`])/u,
    (_match, open: string, close: string) => `title: ${open}${input.storyTitle}${close}`,
  );
  next = next.replace(
    /name\s*:\s*(['"`])[^'"`]*(['"`])/u,
    (_match, open: string, close: string) => `name: ${open}${input.cleanName}${close}`,
  );
  next = next.replace(
    /(export\s+const\s+Default\s*:\s*Story\s*=\s*)\{\s*\}/u,
    `$1{\n  name: ${quoteSingle(input.cleanName)},\n}`,
  );
  return next;
}

function rewriteStoryFolderReferences(source: string, from: string, to: string): string {
  const fromPattern = escapeRegExp(from);
  return source
    .replace(
      new RegExp(`(title\\s*:\\s*['"\`])Screens/${fromPattern}(?=/)`, 'gu'),
      (_match, prefix: string) => `${prefix}Screens/${to}`,
    )
    .replace(
      new RegExp(`((?:\\.\\./)+screens/)${fromPattern}(?=/)`, 'gu'),
      (_match, prefix: string) => `${prefix}${to}`,
    )
    .replace(
      new RegExp(`((?:src/)?screens/)${fromPattern}(?=/)`, 'gu'),
      (_match, prefix: string) => `${prefix}${to}`,
    );
}

function parseStoryFilePath(filePath: string): { dir: string; extension: string; folder: string } {
  const match = /^src\/stories\/screens\/([^/]+)\/(.+)\.stories\.(tsx|ts|jsx|js)$/iu.exec(filePath);
  if (!match) {
    throw new Error(
      'screen story file path must be under src/stories/screens/<folder>/*.stories.tsx.',
    );
  }
  return {
    dir: `src/stories/screens/${match[1]}`,
    extension: match[3]!,
    folder: match[1]!,
  };
}

function extractStoryComponentName(source: string): string | null {
  return (
    /\bcomponent\s*:\s*([A-Za-z_$][\w$]*)/u.exec(source)?.[1] ??
    /import\s*\{\s*([A-Za-z_$][\w$]*)\s*\}\s*from/u.exec(source)?.[1] ??
    null
  );
}

function relativeImportPath(fromFile: string, toFile: string): string {
  const fromParts = fromFile.split('/').filter(Boolean).slice(0, -1);
  const toParts = stripImportExtension(toFile).split('/').filter(Boolean);
  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common += 1;
  }
  const up = fromParts.slice(common).map(() => '..');
  const down = toParts.slice(common);
  const relative = [...up, ...down].join('/') || '.';
  return relative.startsWith('.') ? relative : `./${relative}`;
}

function stripImportExtension(filePath: string): string {
  return filePath.replace(/\.(tsx|ts|jsx|js)$/iu, '');
}

function dirnamePath(filePath: string): string {
  return filePath.split('/').slice(0, -1).join('/');
}

function fileExtension(filePath: string): string {
  return filePath.split('.').at(-1) || 'tsx';
}

function replaceIdentifier(source: string, from: string, to: string): string {
  if (!from || from === to) return source;
  return source.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, 'gu'), to);
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

function toComponentName(value: string): string {
  const name =
    value
      .trim()
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('') || 'Screen';
  return /^[A-Za-z_$]/.test(name) ? name : `Screen${name}`;
}

function quoteSingle(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

async function pathExists(path: string): Promise<boolean> {
  return stat(path)
    .then(() => true)
    .catch(() => false);
}

async function isFile(path: string): Promise<boolean> {
  return stat(path)
    .then((entry) => entry.isFile())
    .catch(() => false);
}

async function isDirectory(path: string): Promise<boolean> {
  return stat(path)
    .then((entry) => entry.isDirectory())
    .catch(() => false);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
