/**
 * File-system utilities that refuse to escape the workspace root. Used by
 * every tool that reads or writes files.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

export class WorkspaceEscape extends Error {
  constructor(p: string) {
    super(`Refused to access path outside workspace: ${p}`);
  }
}

function ensureInside(workspaceRoot: string, target: string): string {
  const abs = resolve(workspaceRoot, target);
  const root = resolve(workspaceRoot) + sep;
  if (abs !== resolve(workspaceRoot) && !abs.startsWith(root)) {
    throw new WorkspaceEscape(target);
  }
  return abs;
}

export async function readWorkspaceFile(workspaceRoot: string, relPath: string): Promise<string> {
  const abs = ensureInside(workspaceRoot, relPath);
  return await readFile(abs, 'utf8');
}

export async function writeWorkspaceFile(
  workspaceRoot: string,
  relPath: string,
  contents: string,
): Promise<void> {
  const abs = ensureInside(workspaceRoot, relPath);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, contents, 'utf8');
}
