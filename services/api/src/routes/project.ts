/**
 * /api/project — load and save the active .sdproj (Phase 5.1).
 *
 *   GET /api/project           — current active project (loads from disk
 *                                lazily on first read). Answers with an
 *                                ETag carrying the file's revision.
 *   PUT /api/project   { ... } — replaces the active project and writes
 *                                to disk in one atomic step. A client that
 *                                sends `If-Match: <revision>` gets 409
 *                                instead of overwriting a newer file
 *                                (0136 R08).
 *
 * The on-disk path is derived from the connected workspace
 * (`<workspacePath>/.sber-designer/project.sdproj`) or
 * `SBER_DESIGNER_PROJECT_PATH`, see project-store.ts.
 */
import { Hono } from 'hono';
import { z } from 'zod';

import { audit } from '../audit';
import { getUser } from '../auth';
import {
  ProjectConflictError,
  ProjectCorruptError,
  ProjectSchema,
  canReplaceActiveProject,
  getProject,
  isProjectLoaded,
  loadProjectForWorkspace,
  loadProjectFromDisk,
  projectRevisionFor,
  projectCorruptionDetail,
  saveProject,
} from '../project-store';
import { annotateProjectScreensWithHealth } from '../screen-health';
import { requestWorkspacePath } from '../workspace-context';

let loaded = false;

const ScreenHealthPatchSchema = z
  .object({
    status: z.enum(['ok', 'needs-review', 'broken']),
    reason: z.string().min(1).optional(),
  })
  .strict();

export const projectRouter = new Hono()
  .get('/', async (c) => {
    const workspacePath = requestWorkspacePath();
    if (workspacePath && !isProjectLoaded(workspacePath)) {
      await loadProjectForWorkspace(workspacePath).catch(() => undefined);
    } else if (workspacePath === undefined && !loaded) {
      await loadProjectFromDisk().catch(() => undefined);
      loaded = true;
    }
    const project = getProject();
    const corruption = projectCorruptionDetail(project.workspacePath);
    if (corruption)
      return c.json(
        {
          error: 'project_file_corrupt',
          detail: `Project file cannot be loaded: ${corruption}. Restore or quarantine it before editing.`,
        },
        409,
      );
    const screens =
      project.workspacePath && project.screens.length > 0
        ? await annotateProjectScreensWithHealth(project.workspacePath, project.screens).catch(
            () => project.screens,
          )
        : project.screens;
    const revision = projectRevisionFor(project.workspacePath);
    if (revision) c.header('etag', `"${revision}"`);
    return c.json(screens === project.screens ? project : { ...project, screens });
  })
  .patch('/screens/:screenId/health', async (c) => {
    const user = getUser(c);
    const screenId = c.req.param('screenId');
    const raw = await c.req.json().catch(() => null);
    const parse = ScreenHealthPatchSchema.safeParse(raw);
    if (!parse.success) {
      return c.json({ error: 'invalid_input', detail: parse.error.message }, 400);
    }
    const project = getProject();
    const index = project.screens.findIndex((screen) => screen.id === screenId);
    if (index < 0) {
      return c.json(
        { error: 'screen_not_found', detail: `Screen "${screenId}" was not found.` },
        404,
      );
    }
    const status = parse.data.status;
    const reason =
      parse.data.reason ??
      (status === 'ok'
        ? 'Marked healthy manually.'
        : status === 'needs-review'
          ? 'Marked as needing review manually.'
          : 'Marked broken manually.');
    const screens = project.screens.map((screen) =>
      screen.id === screenId
        ? {
            ...screen,
            health: {
              status,
              reason,
              source: 'manual' as const,
              updatedAt: Date.now(),
            },
          }
        : screen,
    );
    try {
      const saved = await saveProject({ ...project, screens });
      audit({
        kind: 'config',
        user,
        errorMessage: `screen health manual screen=${screenId} status=${status}`,
      });
      const revision = projectRevisionFor(saved.workspacePath);
      if (revision) c.header('etag', `"${revision}"`);
      return c.json(saved);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `screen health save: ${message}` });
      return c.json({ error: 'screen_health_save_failed', detail: message }, 422);
    }
  })
  .put('/', async (c) => {
    const user = getUser(c);
    const raw = await c.req.json().catch(() => null);
    const parse = ProjectSchema.safeParse(raw);
    if (!parse.success) {
      return c.json({ error: 'invalid_input', detail: parse.error.message }, 400);
    }
    const active = getProject();
    if (!canReplaceActiveProject(active, parse.data)) {
      audit({
        kind: 'error',
        user,
        errorMessage: `project save rejected: workspace mismatch active=${active.workspacePath} payload=${parse.data.workspacePath}`,
      });
      return c.json(
        {
          error: 'workspace_mismatch',
          detail:
            `This save targets "${parse.data.workspacePath}" but the active project lives in ` +
            `"${active.workspacePath}". Reload this editor tab to reconnect it.`,
        },
        409,
      );
    }
    try {
      const expectedRevision = parseIfMatch(c.req.header('if-match'));
      const saved = await saveProject(
        parse.data,
        expectedRevision === undefined ? {} : { expectedRevision },
      );
      audit({
        kind: 'config',
        user,
        errorMessage: `project save name=${saved.name} screens=${saved.screens.length}`,
      });
      const revision = projectRevisionFor(saved.workspacePath);
      if (revision) c.header('etag', `"${revision}"`);
      return c.json(saved);
    } catch (err) {
      if (err instanceof ProjectConflictError) {
        audit({ kind: 'error', user, errorMessage: `project save conflict: ${err.message}` });
        return c.json(
          {
            error: 'project_revision_conflict',
            detail: err.message,
            expectedRevision: err.expected,
            actualRevision: err.actual,
          },
          409,
        );
      }
      if (err instanceof ProjectCorruptError) {
        audit({ kind: 'error', user, errorMessage: `project save refused: ${err.message}` });
        return c.json({ error: 'project_file_corrupt', detail: err.message }, 409);
      }
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `project save: ${message}` });
      return c.json({ error: 'project_save_failed', detail: message }, 422);
    }
  });

/**
 * `If-Match: "<revision>"` — the revision the client last read. `*` means
 * "whatever is there", i.e. no check. Absent means the same: server-side
 * callers that just re-read the project do not need the guard.
 */
function parseIfMatch(header: string | undefined): string | null | undefined {
  const value = header?.trim();
  if (!value || value === '*') return undefined;
  const unquoted = value.replace(/^W\//u, '').replace(/^"/u, '').replace(/"$/u, '');
  return unquoted === 'null' ? null : unquoted;
}
