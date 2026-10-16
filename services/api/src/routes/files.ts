/**
 * /api/files
 *
 *   GET    /api/files?path=...                — read a workspace-relative file.
 *   POST   /api/files  { path, contents }     — overwrite a workspace-relative file (Phase 3.1).
 *   DELETE /api/files?path=...                — delete a workspace-relative generated file.
 *   POST   /api/files/move { fromPath, toPath } — move/rename a workspace-relative file.
 *
 * Both paths go through ast-bridge's resolveInside; absolute paths and
 * workspace-escapes are refused with 422. Used by the editor's Code mode
 * to populate Monaco and persist edits.
 */
import { Hono } from 'hono';
import { z } from 'zod';

import { audit } from '../audit';
import { getUser } from '../auth';
import {
  deleteWorkspaceFile,
  readWorkspaceFile,
  renameWorkspaceFile,
  writeWorkspaceFile,
} from '../safe-fs';
import { markStorybookReloadPendingForPath } from '../storybook-reload';
import { getState } from '../state-store';
import { touchScreensForWorkspacePaths } from '../project-store';

const WriteFileInput = z
  .object({
    path: z.string().min(1),
    contents: z.string(),
  })
  .strict();

const MoveFileInput = z
  .object({
    fromPath: z.string().min(1),
    toPath: z.string().min(1),
  })
  .strict();

export const filesRouter = new Hono()
  .get('/', async (c) => {
    const user = getUser(c);
    const path = c.req.query('path');
    if (!path) {
      return c.json({ error: 'invalid_input', detail: 'Provide ?path=...' }, 400);
    }
    const workspaceRoot = getState().workspacePath;
    if (!workspaceRoot) {
      return c.json(
        { error: 'no_workspace', detail: 'No active workspace. Connect a project first.' },
        400,
      );
    }
    try {
      const contents = await readWorkspaceFile(workspaceRoot, path);
      audit({
        kind: 'config',
        user,
        errorMessage: `read file=${path} bytes=${contents.length}`,
      });
      return c.json({ path, contents });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `read file=${path}: ${message}` });
      return c.json({ error: 'read_failed', detail: message }, 422);
    }
  })
  .post('/move', async (c) => {
    const user = getUser(c);
    const raw = await c.req.json().catch(() => null);
    const parse = MoveFileInput.safeParse(raw);
    if (!parse.success) {
      return c.json({ error: 'invalid_input', detail: parse.error.message }, 400);
    }
    const workspaceRoot = getState().workspacePath;
    if (!workspaceRoot) {
      return c.json(
        { error: 'no_workspace', detail: 'No active workspace. Connect a project first.' },
        400,
      );
    }
    try {
      await renameWorkspaceFile(workspaceRoot, parse.data.fromPath, parse.data.toPath);
      await touchScreensForWorkspacePaths(workspaceRoot, [
        parse.data.fromPath,
        parse.data.toPath,
      ]).catch(() => undefined);
      markStorybookReloadPendingForPath(parse.data.fromPath, false);
      markStorybookReloadPendingForPath(parse.data.toPath, true);
      audit({
        kind: 'config',
        user,
        errorMessage: `move file=${parse.data.fromPath} -> ${parse.data.toPath}`,
      });
      return c.json({ ok: true, ...parse.data });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({
        kind: 'error',
        user,
        errorMessage: `move file=${parse.data.fromPath} -> ${parse.data.toPath}: ${message}`,
      });
      return c.json({ error: 'move_failed', detail: message }, 422);
    }
  })
  .post('/', async (c) => {
    const user = getUser(c);
    const raw = await c.req.json().catch(() => null);
    const parse = WriteFileInput.safeParse(raw);
    if (!parse.success) {
      return c.json({ error: 'invalid_input', detail: parse.error.message }, 400);
    }
    const workspaceRoot = getState().workspacePath;
    if (!workspaceRoot) {
      return c.json(
        { error: 'no_workspace', detail: 'No active workspace. Connect a project first.' },
        400,
      );
    }
    try {
      const before = await readWorkspaceFile(workspaceRoot, parse.data.path).catch(() => null);
      await writeWorkspaceFile(workspaceRoot, parse.data.path, parse.data.contents);
      await touchScreensForWorkspacePaths(workspaceRoot, [parse.data.path]).catch(() => undefined);
      markStorybookReloadPendingForPath(parse.data.path, before === null);
      audit({
        kind: 'config',
        user,
        errorMessage: `write file=${parse.data.path} bytes=${parse.data.contents.length}`,
      });
      return c.json({ ok: true, path: parse.data.path });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `write file=${parse.data.path}: ${message}` });
      return c.json({ error: 'write_failed', detail: message }, 422);
    }
  })
  .delete('/', async (c) => {
    const user = getUser(c);
    const path = c.req.query('path');
    if (!path) {
      return c.json({ error: 'invalid_input', detail: 'Provide ?path=...' }, 400);
    }
    const workspaceRoot = getState().workspacePath;
    if (!workspaceRoot) {
      return c.json(
        { error: 'no_workspace', detail: 'No active workspace. Connect a project first.' },
        400,
      );
    }
    try {
      await deleteWorkspaceFile(workspaceRoot, path);
      await touchScreensForWorkspacePaths(workspaceRoot, [path]).catch(() => undefined);
      markStorybookReloadPendingForPath(path, false);
      audit({
        kind: 'config',
        user,
        errorMessage: `delete file=${path}`,
      });
      return c.json({ ok: true, path });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `delete file=${path}: ${message}` });
      return c.json({ error: 'delete_failed', detail: message }, 422);
    }
  });
