/**
 * Design-context state: fingerprinting of tracked workspace files and the
 * .sber-designer/design-context-state.json read/write.
 */
import { createHash } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { relative } from 'node:path';
import { resolveInside } from '@sber-designer/ast-bridge';
import { readWorkspaceFile, writeWorkspaceFile } from '../safe-fs';
import {
  DESIGN_CONTEXT_STATE_PATH,
  type DesignContextState,
  FINGERPRINT_TRACKED_PATHS,
  MAX_TRACKED_FILES,
  SKIPPED_FINGERPRINT_DIRS,
  TRACKED_FILE_EXTENSIONS,
} from './contract';
import { isNotFound } from './markdown';

export async function readFirstExistingWorkspaceFile(
  root: string,
  filePaths: readonly string[],
): Promise<{ filePath: string; contents: string } | null> {
  for (const filePath of filePaths) {
    const found = await readOptionalWorkspaceFile(root, filePath);
    if (found) return found;
  }
  return null;
}

export async function readOptionalWorkspaceFile(
  root: string,
  filePath: string,
): Promise<{ filePath: string; contents: string } | null> {
  try {
    const contents = await readWorkspaceFile(root, filePath);
    return { filePath, contents };
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function readDesignContextState(root: string): Promise<DesignContextState | null> {
  const file = await readOptionalWorkspaceFile(root, DESIGN_CONTEXT_STATE_PATH);
  if (!file) return null;
  try {
    const parsed = JSON.parse(file.contents) as Partial<DesignContextState>;
    if (
      parsed.version === 1 &&
      typeof parsed.fingerprint === 'string' &&
      typeof parsed.trackedFiles === 'number' &&
      typeof parsed.checkedAt === 'number'
    ) {
      return parsed as DesignContextState;
    }
  } catch {
    return null;
  }
  return null;
}

export async function writeDesignContextState(
  root: string,
  state: DesignContextState,
): Promise<void> {
  await writeWorkspaceFile(root, DESIGN_CONTEXT_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

export async function fingerprintProjectDesignContext(
  root: string,
): Promise<{ value: string; trackedFiles: number }> {
  const files = new Set<string>();
  for (const path of FINGERPRINT_TRACKED_PATHS) {
    await collectTrackedFiles(root, path, files);
  }
  const sorted = Array.from(files).sort().slice(0, MAX_TRACKED_FILES);
  const hash = createHash('sha256');
  for (const filePath of sorted) {
    const contents = await readWorkspaceFile(root, filePath).catch(() => '');
    hash.update(filePath);
    hash.update('\0');
    hash.update(contents);
    hash.update('\0');
  }
  return { value: hash.digest('hex'), trackedFiles: sorted.length };
}

async function collectTrackedFiles(
  root: string,
  relPath: string,
  files: Set<string>,
): Promise<void> {
  let abs: string;
  try {
    abs = resolveInside(root, relPath);
  } catch {
    return;
  }

  let entry;
  try {
    entry = await stat(abs);
  } catch (err) {
    if (isNotFound(err)) return;
    throw err;
  }

  if (entry.isFile()) {
    const normalized = normalizeRelativePath(root, abs);
    if (shouldTrackFile(normalized)) files.add(normalized);
    return;
  }
  if (!entry.isDirectory()) return;

  const dirName = relPath.split('/').filter(Boolean).at(-1);
  if (dirName && SKIPPED_FINGERPRINT_DIRS.has(dirName)) return;

  const children = await readdir(abs, { withFileTypes: true });
  for (const child of children) {
    const childRel = relPath ? `${relPath}/${child.name}` : child.name;
    if (child.isDirectory() && SKIPPED_FINGERPRINT_DIRS.has(child.name)) continue;
    await collectTrackedFiles(root, childRel, files);
    if (files.size >= MAX_TRACKED_FILES) return;
  }
}

function shouldTrackFile(filePath: string): boolean {
  if (filePath === DESIGN_CONTEXT_STATE_PATH) return false;
  const last = filePath.split('/').at(-1) ?? '';
  const dot = last.lastIndexOf('.');
  const ext = dot >= 0 ? last.slice(dot) : '';
  return TRACKED_FILE_EXTENSIONS.has(ext);
}

export function normalizeRelativePath(root: string, abs: string): string {
  return relative(root, abs).split('\\').join('/');
}
