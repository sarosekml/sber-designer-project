import { definedJson } from '../defined-json';
/**
 * /api/projects — local MVP registry for Projects Home (Backlog 0001).
 */
import { Hono } from 'hono';
import { z } from 'zod';

import { getUser } from '../auth';
import { audit } from '../audit';
import {
  ensureSberDesignerGitignore,
  readProjectCover,
  writeProjectCoverAndResetThumbnail,
} from '../project-cover-store';
import { loadProjectForWorkspace } from '../project-store';
import {
  duplicateProject,
  readProjectThumbnail,
  readProjectsRegistry,
  registerProject,
  removeProject,
  renameProject,
  setProjectCoverScreen,
  touchProject,
  updateProjectThumbnail,
} from '../projects-registry';
import { requestStorageIdentity, updateUserActiveWorkspace } from '../user-storage';

const RegisterProjectSchema = z
  .object({
    workspacePath: z.string().min(1),
    name: z.string().min(1).optional(),
  })
  .strict();

const UpdateThumbnailSchema = z
  .object({
    dataUrl: z.string().min(1).optional(),
    thumbnailPath: z.string().min(1).optional(),
    // 0135: Generated preview clears the explicit override.
    reset: z.literal(true).optional(),
  })
  .strict()
  .refine(
    (value) => [value.dataUrl, value.thumbnailPath, value.reset].filter(Boolean).length === 1,
    { message: 'Provide exactly one of dataUrl, thumbnailPath, or reset.' },
  );

const UpdateCoverSchema = z
  .object({
    dataUrl: z.string().min(1),
    screenId: z.string().min(1).optional(),
  })
  .strict();

const CoverScreenSchema = z
  .object({
    screenId: z.string().min(1).nullable(),
  })
  .strict();

const RenameProjectSchema = z
  .object({
    name: z.string().trim().min(1),
  })
  .strict();

const DuplicateProjectSchema = z
  .object({
    name: z.string().trim().min(1),
    parentDir: z.string().min(1),
  })
  .strict();

export const projectsRouter = new Hono()
  .get('/', async (c) => {
    return c.json(await readProjectsRegistry(requestStorageIdentity(c)));
  })
  .post('/', async (c) => {
    const user = getUser(c);
    const raw = await c.req.json().catch(() => null);
    const parsed = RegisterProjectSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'invalid_input', detail: parsed.error.message }, 400);
    }
    try {
      const entry = await registerProject(definedJson(parsed.data), requestStorageIdentity(c));
      audit({
        kind: 'config',
        user,
        errorMessage: `project register name=${entry.name} path=${entry.workspacePath}`,
      });
      return c.json(entry, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `project register: ${message}` });
      return c.json({ error: 'project_register_failed', detail: message }, 422);
    }
  })
  .post('/:id/duplicate', async (c) => {
    const user = getUser(c);
    const raw = await c.req.json().catch(() => null);
    const parsed = DuplicateProjectSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'invalid_input', detail: parsed.error.message }, 400);
    }
    try {
      const entry = await duplicateProject(
        {
          id: c.req.param('id'),
          name: parsed.data.name,
          parentDir: parsed.data.parentDir,
        },
        requestStorageIdentity(c),
      );
      if (!entry) {
        return c.json(
          { error: 'project_not_found', detail: `Unknown project ${c.req.param('id')}` },
          404,
        );
      }
      audit({
        kind: 'config',
        user,
        errorMessage: `project duplicate name=${entry.name} path=${entry.workspacePath}`,
      });
      return c.json(entry, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `project duplicate: ${message}` });
      return c.json({ error: 'project_duplicate_failed', detail: message }, 422);
    }
  })
  .post('/:id/open', async (c) => {
    const user = getUser(c);
    const id = c.req.param('id');
    const identity = requestStorageIdentity(c);
    let entry = await touchProject(id, identity);
    if (!entry) {
      return c.json({ error: 'project_not_found', detail: `Unknown project ${id}` }, 404);
    }
    await updateUserActiveWorkspace(identity, entry.workspacePath);
    // Keep only the heavy per-screen flow captures out of git. The small cover
    // itself is intentionally committed with the project (0135).
    void ensureSberDesignerGitignore(entry.workspacePath).catch(() => undefined);
    const project = await loadProjectForWorkspace(entry.workspacePath, entry.name);
    // A screen can disappear through file/agent changes while its cover pin
    // remains in the per-user registry. Heal that orphan on open so future
    // generation runs are not permanently blocked by an unreachable id.
    const pinnedCoverScreenId = entry.coverScreenId;
    if (
      pinnedCoverScreenId &&
      !project.screens.some((screen) => screen.id === pinnedCoverScreenId)
    ) {
      try {
        entry = (await setProjectCoverScreen({ id, screenId: null }, identity)) ?? entry;
      } catch {
        // Registry repair is best-effort and must not block opening the project.
      }
    }
    audit({
      kind: 'config',
      user,
      errorMessage: `project open name=${entry.name} path=${entry.workspacePath}`,
    });
    return c.json({ entry, project });
  })
  .get('/:id/thumbnail', async (c) => {
    const thumbnail = await readProjectThumbnail(c.req.param('id'), requestStorageIdentity(c));
    if (!thumbnail) {
      return c.json(
        { error: 'thumbnail_not_found', detail: 'No thumbnail for this project.' },
        404,
      );
    }
    c.header('content-type', thumbnail.contentType);
    c.header('cache-control', 'private, max-age=31536000, immutable');
    return c.body(new Uint8Array(thumbnail.bytes));
  })
  .get('/:id/cover', async (c) => {
    const cover = await readProjectCover(c.req.param('id'), requestStorageIdentity(c));
    if (!cover) {
      return c.json(
        { error: 'cover_not_found', detail: 'No generated cover for this project.' },
        404,
      );
    }
    // The cover is rewritten after each generation run, so it must revalidate
    // rather than sit in the browser cache behind a stale copy (0135).
    const etag = cover.etag;
    const cacheControl = 'private, no-cache, must-revalidate';
    if (c.req.header('if-none-match') === etag) {
      return new Response(null, {
        status: 304,
        headers: { etag, 'cache-control': cacheControl },
      });
    }
    return new Response(new Uint8Array(cover.bytes), {
      headers: {
        'content-type': cover.contentType,
        etag,
        'cache-control': cacheControl,
        'x-content-type-options': 'nosniff',
      },
    });
  })
  .put('/:id/cover', async (c) => {
    const user = getUser(c);
    const raw = await c.req.json().catch(() => null);
    const parsed = UpdateCoverSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'invalid_input', detail: parsed.error.message }, 400);
    }
    try {
      const result = await writeProjectCoverAndResetThumbnail(
        {
          id: c.req.param('id'),
          dataUrl: parsed.data.dataUrl,
          ...(parsed.data.screenId ? { screenId: parsed.data.screenId } : {}),
        },
        requestStorageIdentity(c),
      );
      if (!result) {
        return c.json(
          { error: 'project_not_found', detail: `Unknown project ${c.req.param('id')}` },
          404,
        );
      }
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `project cover update: ${message}` });
      return c.json({ error: 'cover_update_failed', detail: message }, 422);
    }
  })
  .put('/:id/cover-screen', async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = CoverScreenSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'invalid_input', detail: parsed.error.message }, 400);
    }
    const entry = await setProjectCoverScreen(
      { id: c.req.param('id'), screenId: parsed.data.screenId },
      requestStorageIdentity(c),
    );
    if (!entry) {
      return c.json(
        { error: 'project_not_found', detail: `Unknown project ${c.req.param('id')}` },
        404,
      );
    }
    return c.json(entry);
  })
  .patch('/:id', async (c) => {
    const user = getUser(c);
    const raw = await c.req.json().catch(() => null);
    const parsed = RenameProjectSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'invalid_input', detail: parsed.error.message }, 400);
    }
    try {
      const entry = await renameProject(
        {
          id: c.req.param('id'),
          name: parsed.data.name,
        },
        requestStorageIdentity(c),
      );
      if (!entry) {
        return c.json(
          { error: 'project_not_found', detail: `Unknown project ${c.req.param('id')}` },
          404,
        );
      }
      audit({
        kind: 'config',
        user,
        errorMessage: `project rename name=${entry.name} path=${entry.workspacePath}`,
      });
      return c.json(entry);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `project rename: ${message}` });
      return c.json({ error: 'project_rename_failed', detail: message }, 422);
    }
  })
  .put('/:id/thumbnail', async (c) => {
    const user = getUser(c);
    const raw = await c.req.json().catch(() => null);
    const parsed = UpdateThumbnailSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'invalid_input', detail: parsed.error.message }, 400);
    }
    try {
      const entry = await updateProjectThumbnail(
        {
          id: c.req.param('id'),
          ...definedJson(parsed.data),
        },
        requestStorageIdentity(c),
      );
      if (!entry) {
        return c.json(
          { error: 'project_not_found', detail: `Unknown project ${c.req.param('id')}` },
          404,
        );
      }
      audit({
        kind: 'config',
        user,
        errorMessage: `project thumbnail update name=${entry.name} path=${entry.workspacePath}`,
      });
      return c.json(entry);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `project thumbnail update: ${message}` });
      return c.json({ error: 'thumbnail_update_failed', detail: message }, 422);
    }
  })
  .delete('/:id', async (c) => {
    const id = c.req.param('id');
    const deleted = await removeProject(id, requestStorageIdentity(c));
    if (!deleted) {
      return c.json({ error: 'project_not_found', detail: `Unknown project ${id}` }, 404);
    }
    return c.body(null, 204);
  });
