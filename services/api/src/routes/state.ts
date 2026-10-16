import { Hono, type Context } from 'hono';

import { EditorStateSchema, getState, patchState } from '../state-store';
import {
  assertWorkspacePathForIdentity,
  requestStorageIdentity,
  userProjectsRoot,
} from '../user-storage';

/**
 * Latest-wins editor state. apps/web pushes its current selection /
 * mode here every time they change; proj-mcp tools (editor_get_selection,
 * editor_get_mode in Phase 1.3) read it.
 */
export const stateRouter = new Hono()
  .get('/', async (c) => {
    const requested = c.req.query('workspacePath');
    const resolved = await resolveStateWorkspace(c, requested);
    if ('response' in resolved) return resolved.response;
    return c.json(getState(resolved.workspacePath));
  })
  .post('/', async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = EditorStateSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'invalid_input', detail: parsed.error.message }, 400);
    }
    const resolved = await resolveStateWorkspace(c, parsed.data.workspacePath ?? undefined);
    if ('response' in resolved) return resolved.response;
    return c.json(patchState(parsed.data, resolved.workspacePath));
  });

async function resolveStateWorkspace(
  c: Context,
  requested: string | undefined,
): Promise<{ workspacePath: string | undefined } | { response: Response }> {
  const identity = requestStorageIdentity(c);
  const scopedRoot = await userProjectsRoot(identity);
  if (!scopedRoot) return { workspacePath: requested };
  if (!requested?.trim()) {
    return {
      response: c.json(
        { error: 'workspace_path_required', detail: 'workspacePath is required on this server.' },
        400,
      ),
    };
  }
  try {
    return {
      workspacePath: await assertWorkspacePathForIdentity(identity, requested),
    };
  } catch (error) {
    return {
      response: c.json(
        {
          error: 'workspace_outside_user_root',
          detail: error instanceof Error ? error.message : String(error),
        },
        422,
      ),
    };
  }
}
