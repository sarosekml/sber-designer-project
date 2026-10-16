import type { Context, MiddlewareHandler } from 'hono';
import { resolve } from 'node:path';

import { readContextAuthMethod } from './auth/middleware';
import {
  assertWorkspacePathForIdentity,
  configuredProjectsRoot,
  readUserSettings,
  requestStorageIdentity,
  updateUserActiveWorkspace,
} from './user-storage';
import { runWithRequestWorkspace } from './workspace-context';

/**
 * Bind every authenticated remote request to one validated user workspace.
 *
 * Explicit workspace paths are accepted from the query, a top-level JSON
 * `workspacePath`, or chat-stream's `editorContext.workspacePath`. All values
 * must resolve to the same canonical path inside the caller's managed subtree.
 * When a route omits the path, only that caller's persisted active workspace is
 * used; `null` intentionally prevents legacy global-state fallback.
 */
export function createWorkspaceAccessGuard(): MiddlewareHandler {
  return async (c, next) => {
    if (!readContextAuthMethod(c)) {
      await next();
      return;
    }

    const identity = requestStorageIdentity(c);
    if (identity.kind === 'local') {
      await next();
      return;
    }

    const explicitPaths = await explicitWorkspacePaths(c);
    if (!configuredProjectsRoot()) {
      if (explicitPaths.length > 0) {
        return c.json(
          {
            error: 'workspace_storage_not_configured',
            detail: 'SBER_DESIGNER_PROJECTS_ROOT is required in remote auth modes.',
          },
          503,
        );
      }
      return runWithRequestWorkspace(null, next);
    }

    if (explicitPaths.length > 0) {
      try {
        const canonical = await Promise.all(
          explicitPaths.map((workspacePath) =>
            assertWorkspacePathForIdentity(identity, workspacePath),
          ),
        );
        if (
          explicitPaths.some((workspacePath, index) => resolve(workspacePath) !== canonical[index])
        ) {
          return c.json(
            {
              error: 'workspace_path_not_canonical',
              detail: 'workspacePath must use the canonical managed project path.',
            },
            422,
          );
        }
        const distinct = new Set(canonical);
        if (distinct.size !== 1) {
          return c.json(
            {
              error: 'workspace_path_conflict',
              detail: 'All workspacePath values in one request must identify the same project.',
            },
            400,
          );
        }
        const workspacePath = canonical[0]!;
        await updateUserActiveWorkspace(identity, workspacePath);
        return runWithRequestWorkspace(workspacePath, next);
      } catch (error) {
        return workspaceAccessError(c, error);
      }
    }

    const settings = await readUserSettings(identity);
    if (!settings.activeWorkspace) return runWithRequestWorkspace(null, next);
    try {
      const workspacePath = await assertWorkspacePathForIdentity(
        identity,
        settings.activeWorkspace,
      );
      return runWithRequestWorkspace(workspacePath, next);
    } catch {
      // A removed/stale project must not make us fall back to another user's
      // process-global state. Routes will return their existing no-workspace response.
      return runWithRequestWorkspace(null, next);
    }
  };
}

async function explicitWorkspacePaths(c: Context): Promise<string[]> {
  const paths: string[] = [];
  const queryPath = c.req.query('workspacePath')?.trim();
  if (queryPath) paths.push(queryPath);

  if (c.req.method === 'GET' || c.req.method === 'HEAD') return paths;

  const body = await c.req.raw
    .clone()
    .json()
    .catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return paths;
  const record = body as Record<string, unknown>;
  pushString(paths, record.workspacePath);
  if (record.editorContext && typeof record.editorContext === 'object') {
    pushString(paths, (record.editorContext as Record<string, unknown>).workspacePath);
  }
  return Array.from(new Set(paths));
}

function pushString(target: string[], value: unknown): void {
  if (typeof value !== 'string') return;
  const trimmed = value.trim();
  if (trimmed) target.push(trimmed);
}

function workspaceAccessError(c: Context, error: unknown): Response {
  return c.json(
    {
      error: 'workspace_outside_user_root',
      detail: error instanceof Error ? error.message : String(error),
    },
    422,
  );
}
