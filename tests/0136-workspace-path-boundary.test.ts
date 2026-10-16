/**
 * 0136 R02 — the workspace filesystem boundary must be canonical, not lexical.
 *
 * Regression for the reproduction recorded in the review: a symlink inside the
 * workspace pointing at a neighbouring directory passed the `resolve`+prefix
 * check, and `readWorkspaceFile` / `writeWorkspaceFile` both reached outside
 * the workspace through it.
 */
import { describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { canonicalizeInside, resolveInside, WorkspaceEscape } from '@sber-designer/ast-bridge';
import { resolveInsideAgentsRoot } from '../services/api/src/agent-kit/safe-path';
import {
  deleteWorkspaceFile,
  readWorkspaceFile,
  renameWorkspaceFile,
  workspaceFileExistsExact,
  writeWorkspaceFile,
} from '../services/api/src/safe-fs';

async function stage(): Promise<{ workspace: string; outside: string }> {
  const base = await mkdtemp(join(tmpdir(), 'sd-0136-path-'));
  const workspace = join(base, 'workspace');
  const outside = join(base, 'outside');
  await mkdir(workspace, { recursive: true });
  await mkdir(outside, { recursive: true });
  await writeFile(join(outside, 'marker.txt'), 'secret-outside', 'utf8');
  return { workspace, outside };
}

describe('0136 R02 canonical workspace boundary', () => {
  test('refuses to read through a symlink that leaves the workspace', async () => {
    const { workspace, outside } = await stage();
    await symlink(outside, join(workspace, 'link'), 'dir');

    expect(() => resolveInside(workspace, 'link/marker.txt')).toThrow(WorkspaceEscape);
    await expect(readWorkspaceFile(workspace, 'link/marker.txt')).rejects.toThrow(WorkspaceEscape);
  });

  test('refuses to write through a symlink that leaves the workspace', async () => {
    const { workspace, outside } = await stage();
    await symlink(outside, join(workspace, 'link'), 'dir');

    await expect(writeWorkspaceFile(workspace, 'link/planted.txt', 'x')).rejects.toThrow(
      WorkspaceEscape,
    );
    expect(await workspaceFileExistsExact(workspace, 'link/marker.txt')).toBe(false);
  });

  test('refuses a not-yet-existing target underneath a linked parent', async () => {
    const { workspace, outside } = await stage();
    await symlink(outside, join(workspace, 'link'), 'dir');

    // The file does not exist, so only the nearest existing ancestor can be
    // canonicalized — that ancestor is already outside the workspace.
    expect(() => resolveInside(workspace, 'link/nested/new-file.txt')).toThrow(WorkspaceEscape);
  });

  test('refuses a symlinked file (not just a symlinked directory)', async () => {
    const { workspace, outside } = await stage();
    await symlink(join(outside, 'marker.txt'), join(workspace, 'marker-link.txt'), 'file');

    await expect(readWorkspaceFile(workspace, 'marker-link.txt')).rejects.toThrow(WorkspaceEscape);
  });

  test('refuses rename and delete that escape through a link', async () => {
    const { workspace, outside } = await stage();
    await symlink(outside, join(workspace, 'link'), 'dir');
    await writeWorkspaceFile(workspace, 'inside.txt', 'keep');

    await expect(renameWorkspaceFile(workspace, 'inside.txt', 'link/moved.txt')).rejects.toThrow(
      WorkspaceEscape,
    );
    await expect(deleteWorkspaceFile(workspace, 'link/marker.txt')).rejects.toThrow(
      WorkspaceEscape,
    );
    expect(await readFile(join(outside, 'marker.txt'), 'utf8')).toBe('secret-outside');
  });

  test('still allows a symlink that stays inside the workspace', async () => {
    const { workspace } = await stage();
    await mkdir(join(workspace, 'real'), { recursive: true });
    await writeFile(join(workspace, 'real', 'file.txt'), 'inside', 'utf8');
    await symlink(join(workspace, 'real'), join(workspace, 'alias'), 'dir');

    expect(await readWorkspaceFile(workspace, 'alias/file.txt')).toBe('inside');
    await writeWorkspaceFile(workspace, 'alias/written.txt', 'ok');
    expect(await readFile(join(workspace, 'real', 'written.txt'), 'utf8')).toBe('ok');
  });

  test('rejects traversal, absolute paths and NUL bytes', async () => {
    const { workspace } = await stage();
    expect(() => resolveInside(workspace, '../outside/marker.txt')).toThrow(WorkspaceEscape);
    expect(() => resolveInside(workspace, '/etc/passwd')).toThrow(WorkspaceEscape);
    expect(() => resolveInside(workspace, 'ok\0.txt')).toThrow(WorkspaceEscape);
  });

  test('canonicalizeInside reports both the lexical and the real destination', async () => {
    const { workspace } = await stage();
    await mkdir(join(workspace, 'real'), { recursive: true });
    await writeFile(join(workspace, 'real', 'file.txt'), 'inside', 'utf8');
    await symlink(join(workspace, 'real'), join(workspace, 'alias'), 'dir');

    const resolved = canonicalizeInside(workspace, 'alias/file.txt');
    expect(resolved.lexicalPath).toBe(join(workspace, 'alias', 'file.txt'));
    expect(resolved.canonicalPath.endsWith(join('real', 'file.txt'))).toBe(true);
  });

  test('the .agents boundary refuses the same escape', async () => {
    const { workspace, outside } = await stage();
    const agentsRoot = join(workspace, '.agents');
    await mkdir(agentsRoot, { recursive: true });
    await symlink(outside, join(agentsRoot, 'link'), 'dir');

    expect(() => resolveInsideAgentsRoot(agentsRoot, 'link/marker.txt')).toThrow(
      /escapes \.agents root/u,
    );
    expect(() => resolveInsideAgentsRoot(agentsRoot, '../../outside/marker.txt')).toThrow(
      /escapes \.agents root/u,
    );
  });
});
