import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { z } from 'zod';

import { audit, type AuditEvent } from '../audit';
import { AuthError } from './errors';
import { readContextSessionUser } from './middleware';
import { AuthService } from './service';
import { AuthStore } from './store';
import { CLI_RUNTIME_KINDS } from './system-settings';
import type { AdminUser, SystemSettings } from './types';
import {
  listTrashEntries,
  moveUserToTrash,
  previewUserTrash,
  purgeTrash,
  rollbackUserTrash,
  restoreTrashProject,
  type TrashManifest,
  UserTrashError,
  type UserTrashPreview,
} from '../user-trash';

const UserAccessSchema = z
  .object({
    role: z.enum(['admin', 'member']).optional(),
    status: z.enum(['active', 'disabled']).optional(),
  })
  .strict()
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: 'Role or status is required',
  });

const DeleteUserSchema = z.object({ confirm: z.string() }).strict();
const RestoreTrashSchema = z
  .object({ folder: z.string().min(1), targetUserId: z.string().min(1) })
  .strict();

const SystemSettingsSchema = z
  .object({
    registration: z.enum(['open', 'closed']),
    dsBrowser: z.object({ defaultEnabled: z.boolean() }).strict(),
    agents: z
      .object({
        enabledCliRuntimes: z
          .array(z.enum(CLI_RUNTIME_KINDS))
          .max(CLI_RUNTIME_KINDS.length)
          .refine((items) => new Set(items).size === items.length, {
            message: 'CLI runtime entries must be unique',
          }),
      })
      .strict(),
  })
  .strict();

type AdminAuditWriter = (event: Omit<AuditEvent, 'ts'>) => void;

export interface AdminTrashOperations {
  previewUser(user: AdminUser): Promise<UserTrashPreview>;
  moveUser(user: AdminUser, deletedBy: string): Promise<TrashManifest>;
  rollbackUser(user: AdminUser, manifest: TrashManifest): Promise<void>;
  list(): Promise<TrashManifest[]>;
  restore(input: {
    entryId: string;
    folder: string;
    targetUser: AdminUser;
  }): ReturnType<typeof restoreTrashProject>;
  purge(input: { entryId: string; folder?: string }): ReturnType<typeof purgeTrash>;
}

export interface AdminRouterDependencies {
  service: AuthService;
  store: AuthStore;
  requireUser: MiddlewareHandler;
  requireAdmin: MiddlewareHandler;
  writeAudit?: AdminAuditWriter;
  trash?: AdminTrashOperations;
}

export function createAdminRouter(dependencies: AdminRouterDependencies): Hono {
  const router = new Hono();
  const writeAudit = dependencies.writeAudit ?? audit;
  const trash: AdminTrashOperations = dependencies.trash ?? {
    previewUser: previewUserTrash,
    moveUser: moveUserToTrash,
    rollbackUser: rollbackUserTrash,
    list: listTrashEntries,
    restore: restoreTrashProject,
    purge: purgeTrash,
  };

  router.onError((error, c) => adminErrorResponse(c, error));
  router.use('*', dependencies.requireUser);
  router.use('*', dependencies.requireAdmin);

  router.get('/users', async (c) => {
    const users = await dependencies.service.listUsers();
    users.sort((left, right) => left.email.localeCompare(right.email));
    return c.json({ users });
  });

  router.get('/users/:id/storage', async (c) => {
    const target = (await dependencies.service.listUsers()).find(
      (candidate) => candidate.id === c.req.param('id'),
    );
    if (!target) throw new AuthError('not_found', 404, 'User not found');
    return c.json({ preview: await trash.previewUser(target) });
  });

  router.patch('/users/:id', async (c) => {
    const actor = requireAdminUser(c);
    const body = await parseAdminBody(c, UserAccessSchema);
    const before = (await dependencies.service.listUsers()).find(
      (candidate) => candidate.id === c.req.param('id'),
    );
    const user = await dependencies.service.setUserAccess(c.req.param('id'), {
      ...(body.role !== undefined ? { role: body.role } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    });
    writeAudit({
      kind: 'admin',
      user: actor.email,
      action: 'user.access.update',
      target: user.email,
      metadata: {
        before: before ? { role: before.role, status: before.status } : null,
        after: { role: user.role, status: user.status },
      },
    });
    return c.json({ user });
  });

  router.post('/users/:id/reset-password', async (c) => {
    const actor = requireAdminUser(c);
    const result = await dependencies.service.resetUserPassword(c.req.param('id'));
    writeAudit({
      kind: 'admin',
      user: actor.email,
      action: 'user.password.reset',
      target: result.user.email,
    });
    return c.json(result);
  });

  router.delete('/users/:id', async (c) => {
    const actor = requireAdminUser(c);
    const body = await parseAdminBody(c, DeleteUserSchema);
    const target = (await dependencies.service.listUsers()).find(
      (candidate) => candidate.id === c.req.param('id'),
    );
    if (!target) throw new AuthError('not_found', 404, 'User not found');
    if (body.confirm.trim().toLocaleLowerCase('en-US') !== target.email) {
      throw new AuthError('confirmation_mismatch', 400, 'Confirmation email does not match');
    }
    if (target.status !== 'disabled') {
      throw new AuthError(
        'user_must_be_disabled',
        409,
        'Disable the user before deleting the account',
      );
    }
    const trashEntry = await trash.moveUser(target, actor.email);
    let user: AdminUser;
    try {
      user = await dependencies.service.deleteUser(c.req.param('id'));
    } catch (error) {
      await trash.rollbackUser(target, trashEntry);
      throw error;
    }
    writeAudit({
      kind: 'admin',
      user: actor.email,
      action: 'user.delete',
      target: user.email,
      metadata: {
        workspaceDisposition: 'trash',
        entryId: trashEntry.entryId,
        projects: trashEntry.projects.length,
        bytes: trashEntry.totalBytes,
        riskyProjects: trashEntry.riskyProjects,
      },
    });
    return c.json({
      user,
      workspaceDisposition: 'trash' as const,
      trashEntry,
    });
  });

  router.get('/trash', async (c) => c.json({ entries: await trash.list() }));

  router.post('/trash/:entryId/restore', async (c) => {
    const actor = requireAdminUser(c);
    const body = await parseAdminBody(c, RestoreTrashSchema);
    const targetUser = (await dependencies.service.listUsers()).find(
      (candidate) => candidate.id === body.targetUserId && candidate.status === 'active',
    );
    if (!targetUser) {
      throw new AuthError('not_found', 404, 'Active target user not found');
    }
    const result = await trash.restore({
      entryId: c.req.param('entryId'),
      folder: body.folder,
      targetUser,
    });
    writeAudit({
      kind: 'admin',
      user: actor.email,
      action: 'trash.project.restore',
      target: targetUser.email,
      metadata: {
        entryId: c.req.param('entryId'),
        folder: body.folder,
        projectId: result.project.id,
      },
    });
    return c.json(result);
  });

  router.delete('/trash/:entryId', async (c) => {
    const actor = requireAdminUser(c);
    const folder = c.req.query('folder')?.trim() || undefined;
    const result = await trash.purge({
      entryId: c.req.param('entryId'),
      ...(folder ? { folder } : {}),
    });
    writeAudit({
      kind: 'admin',
      user: actor.email,
      action: folder ? 'trash.project.purge' : 'trash.entry.purge',
      target: c.req.param('entryId'),
      metadata: { ...(folder ? { folder } : {}), purgedEntry: result.purgedEntry },
    });
    return c.json(result);
  });

  router.get('/settings', async (c) => {
    return c.json({ settings: await dependencies.store.readSystemSettings() });
  });

  router.patch('/settings', async (c) => {
    const actor = requireAdminUser(c);
    const body = await parseAdminBody(c, SystemSettingsSchema);
    const settings = await dependencies.store.mutateSystemSettings(() => ({
      value: { version: 1, ...body } satisfies SystemSettings,
      result: { version: 1, ...body } satisfies SystemSettings,
    }));
    writeAudit({
      kind: 'admin',
      user: actor.email,
      action: 'system.settings.update',
      target: 'system',
      metadata: {
        registration: settings.registration,
        dsBrowserDefaultEnabled: settings.dsBrowser.defaultEnabled,
        enabledCliRuntimes: settings.agents.enabledCliRuntimes,
      },
    });
    return c.json({ settings });
  });

  return router;
}

async function parseAdminBody<T extends z.ZodTypeAny>(c: Context, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new AuthError('invalid_request', 400, 'Request body must be valid JSON');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AuthError(
      'invalid_request',
      400,
      parsed.error.issues[0]?.message ?? 'Invalid request',
    );
  }
  return parsed.data;
}

function requireAdminUser(c: Context) {
  const user = readContextSessionUser(c);
  if (user?.role !== 'admin') {
    throw new AuthError('forbidden', 403, 'Administrator access required');
  }
  return user;
}

function adminErrorResponse(c: Context, error: Error): Response {
  if (error instanceof AuthError) {
    return c.json({ error: error.code, detail: error.message, ...error.metadata }, error.status);
  }
  if (error instanceof UserTrashError) {
    return c.json({ error: error.code, detail: error.message }, error.status);
  }
  const detail = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[auth-admin] request failed: ${detail}\n`);
  return c.json({ error: 'admin_failed', detail: 'Administration request failed' }, 500);
}
