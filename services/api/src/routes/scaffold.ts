/**
 * POST /api/scaffold — create a fresh React+Vite+TS project on disk
 * (Phase 5.4). Optionally adds Storybook.
 *
 * Body: { parentDir: string, name: string, createProjectSubfolder?: boolean, withStorybook?: boolean }
 * Returns: { workspacePath: string, steps: [...] }
 *
 * The frontend can then POST /api/sandbox/sessions with the returned
 * `workspacePath` to start a dev-server in the new project. We don't
 * auto-start the sandbox here so the controller stays single-purpose.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import {
  DEFAULT_HTML_DESIGN_SYSTEM_PRESET_ID,
  isHtmlDesignSystemPresetId,
  type HtmlDesignSystemPresetId,
} from '@sber-designer/shared-types';

import { audit } from '../audit';
import { getUser } from '../auth';
import { bootstrapProject } from '../scaffolder';
import { assertWorkspacePathForIdentity, requestStorageIdentity } from '../user-storage';

const ScaffoldInput = z
  .object({
    parentDir: z.string().min(1),
    name: z.string().min(1),
    createProjectSubfolder: z.boolean().default(true),
    projectKind: z.enum(['react-vite', 'html-first']).default('react-vite'),
    withStorybook: z.boolean().default(false),
    createStarterFiles: z.boolean().default(false),
    htmlDesignSystemPresetId: z
      .custom<HtmlDesignSystemPresetId>(isHtmlDesignSystemPresetId)
      .default(DEFAULT_HTML_DESIGN_SYSTEM_PRESET_ID),
  })
  .strict();

export const scaffoldRouter = new Hono().post('/', async (c) => {
  const startedAt = Date.now();
  const user = getUser(c);
  const raw = await c.req.json().catch(() => null);
  const parse = ScaffoldInput.safeParse(raw);
  if (!parse.success) {
    return c.json({ error: 'invalid_input', detail: parse.error.message }, 400);
  }

  try {
    const parentDir = await assertWorkspacePathForIdentity(
      requestStorageIdentity(c),
      parse.data.parentDir,
    );
    const result = await bootstrapProject({ ...parse.data, parentDir });
    audit({
      kind: 'config',
      user,
      latencyMs: Date.now() - startedAt,
      errorMessage: `scaffold path=${result.workspacePath} kind=${parse.data.projectKind} sb=${parse.data.withStorybook ? 'yes' : 'no'}`,
    });
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    audit({ kind: 'error', user, errorMessage: `scaffold: ${message}` });
    return c.json({ error: 'scaffold_failed', detail: message }, 422);
  }
});
