import { definedJson } from '../defined-json';
import { Hono } from 'hono';
import { z } from 'zod';
import { applyOps, OpSchema } from '@sber-designer/ast-bridge';

import { audit } from '../audit';
import { getUser } from '../auth';
import { readWorkspaceFile } from '../safe-fs';
import { markStorybookReloadPendingForPath } from '../storybook-reload';
import { getState } from '../state-store';

/**
 * POST /api/patch — apply structured AST ops atomically.
 *
 * Body: { workspacePath?: string, ops: Op[] }
 *
 * `workspacePath` is optional; when omitted, falls back to the latest
 * `state.workspacePath` published by apps/web. Refuses paths outside the
 * workspace (ast-bridge enforces) and refuses without any workspace info.
 *
 * Phase 3.2: response includes a per-file `diffs` array (before / after)
 * so the editor's DiffEditor can surface the change.
 *
 * See ADR-0013.
 */
const PatchInputSchema = z
  .object({
    workspacePath: z.string().optional(),
    ops: z.array(OpSchema).min(1).max(64),
  })
  .strict();

export const patchRouter = new Hono().post('/', async (c) => {
  const startedAt = Date.now();
  const user = getUser(c);
  const raw = await c.req.json().catch(() => null);
  const parse = PatchInputSchema.safeParse(raw);
  if (!parse.success) {
    return c.json({ error: 'invalid_input', detail: parse.error.message }, 400);
  }

  const workspaceRoot = parse.data.workspacePath ?? getState().workspacePath;
  if (!workspaceRoot) {
    return c.json(
      {
        error: 'no_workspace',
        detail:
          'No workspacePath provided and no active session known to the api. Connect a project or pass workspacePath.',
      },
      400,
    );
  }

  // Snapshot every touched file before applying so the response can carry
  // structured diffs for the UI.
  const touchedPaths = Array.from(new Set(parse.data.ops.map((op) => op.file)));
  const before = new Map<string, string>();
  for (const p of touchedPaths) {
    try {
      before.set(p, await readWorkspaceFile(workspaceRoot, p));
    } catch {
      // file may be brand-new; treated as "" baseline below.
    }
  }

  try {
    const result = await applyOps({ workspaceRoot, ops: definedJson(parse.data.ops) });
    const diffs = await Promise.all(
      result.changedFiles.map(async (path) => {
        markStorybookReloadPendingForPath(path, !before.has(path));
        return {
          path,
          before: before.get(path) ?? '',
          after: await readWorkspaceFile(workspaceRoot, path).catch(() => ''),
        };
      }),
    );
    audit({
      kind: 'config',
      user,
      latencyMs: Date.now() - startedAt,
      errorMessage: `patch ops=${parse.data.ops.length} files=${result.changedFiles.length}`,
    });
    return c.json({ ...result, diffs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    audit({
      kind: 'error',
      user,
      latencyMs: Date.now() - startedAt,
      errorMessage: `patch: ${message}`,
    });
    return c.json({ error: 'patch_failed', detail: message }, 422);
  }
});
