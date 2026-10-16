import { Hono } from 'hono';
import { z } from 'zod';

import { audit } from '../audit';
import { getUser } from '../auth';
import { ScreenSchema } from '../project-store';
import {
  moveWorkspaceScreenToFolder,
  renameWorkspaceScreen,
  renameWorkspaceScreenFolder,
} from '../screen-folder-rename';
import { annotateProjectScreensWithHealth } from '../screen-health';
import { markStorybookReloadPendingForPath } from '../storybook-reload';
import { getState } from '../state-store';
import { getProject, touchScreens, touchScreensForWorkspacePaths } from '../project-store';

const RenameScreenFolderInput = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
  })
  .strict();

const RenameScreenInput = z
  .object({
    storyFilePath: z.string().min(1),
    implementationFilePath: z.string().min(1).optional(),
    toName: z.string().min(1),
  })
  .strict();

const MoveScreenInput = z
  .object({
    storyFilePath: z.string().min(1),
    implementationFilePath: z.string().min(1).optional(),
    toFolder: z.string().min(1),
  })
  .strict();

const ScreenHealthInput = z
  .object({
    screens: z.array(ScreenSchema),
  })
  .strict();

export const screenFoldersRouter = new Hono()
  .post('/rename', async (c) => {
    const user = getUser(c);
    const raw = await c.req.json().catch(() => null);
    const parse = RenameScreenFolderInput.safeParse(raw);
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
      const result = await renameWorkspaceScreenFolder(workspaceRoot, parse.data);
      await touchScreens(
        workspaceRoot,
        getProject(workspaceRoot)
          .screens.filter((screen) => screen.folder === parse.data.from)
          .map((screen) => screen.id),
      ).catch(() => undefined);
      for (const path of result.updatedFiles) {
        markStorybookReloadPendingForPath(path, false);
      }
      for (const path of result.movedPaths.map((entry) => entry.to)) {
        markStorybookReloadPendingForPath(path, true);
      }
      audit({
        kind: 'config',
        user,
        errorMessage: `screen folder rename ${parse.data.from} -> ${parse.data.to}`,
      });
      return c.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `screen folder rename: ${message}` });
      return c.json({ error: 'screen_folder_rename_failed', detail: message }, 422);
    }
  })
  .post('/screen/rename', async (c) => {
    const user = getUser(c);
    const raw = await c.req.json().catch(() => null);
    const parse = RenameScreenInput.safeParse(raw);
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
      const result = await renameWorkspaceScreen(workspaceRoot, parse.data);
      await touchScreensForWorkspacePaths(workspaceRoot, [
        parse.data.storyFilePath,
        ...(parse.data.implementationFilePath ? [parse.data.implementationFilePath] : []),
      ]).catch(() => undefined);
      for (const path of result.updatedFiles) {
        markStorybookReloadPendingForPath(path, false);
      }
      for (const path of result.movedPaths.map((entry) => entry.to)) {
        markStorybookReloadPendingForPath(path, true);
      }
      audit({
        kind: 'config',
        user,
        errorMessage: `screen rename ${parse.data.storyFilePath} -> ${parse.data.toName}`,
      });
      return c.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `screen rename: ${message}` });
      return c.json({ error: 'screen_rename_failed', detail: message }, 422);
    }
  })
  .post('/screen/move', async (c) => {
    const user = getUser(c);
    const raw = await c.req.json().catch(() => null);
    const parse = MoveScreenInput.safeParse(raw);
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
      const result = await moveWorkspaceScreenToFolder(workspaceRoot, parse.data);
      await touchScreensForWorkspacePaths(workspaceRoot, [
        parse.data.storyFilePath,
        ...(parse.data.implementationFilePath ? [parse.data.implementationFilePath] : []),
      ]).catch(() => undefined);
      for (const path of result.updatedFiles) {
        markStorybookReloadPendingForPath(path, false);
      }
      for (const path of result.movedPaths.map((entry) => entry.to)) {
        markStorybookReloadPendingForPath(path, true);
      }
      audit({
        kind: 'config',
        user,
        errorMessage: `screen move ${parse.data.storyFilePath} -> ${parse.data.toFolder}`,
      });
      return c.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `screen move: ${message}` });
      return c.json({ error: 'screen_move_failed', detail: message }, 422);
    }
  })
  .post('/health', async (c) => {
    const user = getUser(c);
    const raw = await c.req.json().catch(() => null);
    const parse = ScreenHealthInput.safeParse(raw);
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
      const screens = await annotateProjectScreensWithHealth(workspaceRoot, parse.data.screens);
      return c.json({ ok: true, screens });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `screen health: ${message}` });
      return c.json({ error: 'screen_health_failed', detail: message }, 422);
    }
  });
