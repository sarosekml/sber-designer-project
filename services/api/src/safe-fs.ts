/**
 * Workspace-scoped file ops. Uses ast-bridge's path-safety helper so the
 * rules stay consistent between AST patches, plain reads, and Code-mode
 * saves.
 *
 * 0136 R02 — these helpers act on the *canonical* path rather than the
 * lexical one. The boundary check already refused anything whose real
 * destination escapes the workspace; operating on the resolved path means
 * the syscall does not walk the symlinks a second time, so a link swapped
 * between the check and the operation cannot redirect the write.
 */
import { mkdir, readFile, readdir, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { canonicalizeInside } from '@sber-designer/ast-bridge';

/** Canonical absolute path for a workspace-relative path, boundary-checked. */
function safeAbs(workspaceRoot: string, relPath: string): string {
  return canonicalizeInside(workspaceRoot, relPath).canonicalPath;
}

export async function readWorkspaceFile(workspaceRoot: string, relPath: string): Promise<string> {
  return readFile(safeAbs(workspaceRoot, relPath), 'utf8');
}

export async function writeWorkspaceFile(
  workspaceRoot: string,
  relPath: string,
  contents: string,
): Promise<void> {
  const abs = safeAbs(workspaceRoot, relPath);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, contents, 'utf8');
}

export async function writeWorkspaceBytes(
  workspaceRoot: string,
  relPath: string,
  contents: Uint8Array,
): Promise<void> {
  const abs = safeAbs(workspaceRoot, relPath);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, contents);
}

export async function deleteWorkspaceFile(workspaceRoot: string, relPath: string): Promise<void> {
  await unlink(safeAbs(workspaceRoot, relPath));
}

export async function renameWorkspaceFile(
  workspaceRoot: string,
  fromRelPath: string,
  toRelPath: string,
): Promise<void> {
  const fromAbs = safeAbs(workspaceRoot, fromRelPath);
  const toAbs = safeAbs(workspaceRoot, toRelPath);
  await mkdir(dirname(toAbs), { recursive: true });
  await rename(fromAbs, toAbs);
}

export async function deleteWorkspaceTree(workspaceRoot: string, relPath: string): Promise<void> {
  await rm(safeAbs(workspaceRoot, relPath), { recursive: true, force: true });
}

export async function workspaceFileExistsExact(
  workspaceRoot: string,
  relPath: string,
): Promise<boolean> {
  const normalized = relPath.replace(/\\/gu, '/').replace(/^\.\//u, '');
  const parent = dirname(normalized);
  const name = basename(normalized);
  let parentAbs: string;
  try {
    parentAbs = safeAbs(workspaceRoot, parent === '.' ? '' : parent);
  } catch {
    return false;
  }
  const entries: string[] = await readdir(parentAbs).catch((): string[] => []);
  return entries.includes(name);
}
