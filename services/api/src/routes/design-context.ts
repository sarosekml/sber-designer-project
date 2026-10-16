import { Hono } from 'hono';
import { z } from 'zod';

import { audit } from '../audit';
import { getUser } from '../auth';
import { resolveCatalog } from '../catalog-cache';
import {
  generateProjectDesignContextFiles,
  loadProjectDesignContext,
  validateProjectDesignContext,
} from '../design-context';
import { getProject } from '../project-store';
import { getState } from '../state-store';

const GenerateDesignContextBody = z
  .object({
    include: z.enum(['design', 'component-map', 'both']).optional(),
    overwrite: z.boolean().optional(),
  })
  .strict();

/**
 * GET /api/project/design-context
 *
 * Reads project-local design-system context from:
 * - DESIGN.md
 * - component-selection-map.md
 */
export const designContextRouter = new Hono()
  .get('/', async (c) => {
    const user = getUser(c);
    const workspacePath = resolveWorkspacePath(c.req.query('workspacePath'));
    if (!workspacePath) {
      return c.json(
        {
          error: 'no_workspace',
          detail: 'No workspacePath is known. Connect or open a project first.',
        },
        400,
      );
    }

    try {
      const context = await loadProjectDesignContext(workspacePath);
      audit({
        kind: 'config',
        user,
        errorMessage: `design context design=${context.design.exists} map=${context.componentSelectionMap.exists} status=${context.validation.status} workspace=${workspacePath}`,
      });
      return c.json(context);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `design context: ${message}` });
      return c.json({ error: 'design_context_failed', detail: message }, 422);
    }
  })
  .post('/validate', async (c) => {
    const user = getUser(c);
    const workspacePath = resolveWorkspacePath(c.req.query('workspacePath'));
    if (!workspacePath) {
      return c.json(
        {
          error: 'no_workspace',
          detail: 'No workspacePath is known. Connect or open a project first.',
        },
        400,
      );
    }

    try {
      const context = await validateProjectDesignContext(workspacePath);
      audit({
        kind: 'config',
        user,
        errorMessage: `validated design context status=${context.validation.status} workspace=${workspacePath}`,
      });
      return c.json(context);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `validate design context: ${message}` });
      return c.json({ error: 'design_context_validation_failed', detail: message }, 422);
    }
  })
  .post('/generate', async (c) => {
    const user = getUser(c);
    const state = getState();
    const workspacePath = resolveWorkspacePath(c.req.query('workspacePath'));
    if (!workspacePath) {
      return c.json(
        {
          error: 'no_workspace',
          detail: 'No workspacePath is known. Connect or open a project first.',
        },
        400,
      );
    }

    const rawBody = await c.req.json().catch(() => ({}));
    const parsedBody = GenerateDesignContextBody.safeParse(rawBody);
    if (!parsedBody.success) {
      return c.json(
        {
          error: 'invalid_request',
          detail: parsedBody.error.issues.map((issue) => issue.message).join('; '),
        },
        400,
      );
    }

    try {
      const catalogResult = await resolveCatalog({
        canvasUrl: state.canvasUrl ?? null,
        workspacePath,
        bypass: true,
      });
      const project = getProject();
      const result = await generateProjectDesignContextFiles(workspacePath, {
        projectName: project.name || state.projectName || null,
        catalog: 'catalog' in catalogResult ? catalogResult.catalog : null,
        include: parsedBody.data.include ?? 'both',
        overwrite: parsedBody.data.overwrite ?? false,
      });
      audit({
        kind: 'config',
        user,
        errorMessage: `generated design context changed=${result.changedFiles.join(',') || 'none'} skipped=${result.skippedFiles.join(',') || 'none'} workspace=${workspacePath}`,
      });
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `generate design context: ${message}` });
      return c.json({ error: 'design_context_generation_failed', detail: message }, 422);
    }
  });

function resolveWorkspacePath(explicitWorkspacePath: string | null | undefined): string | null {
  const state = getState();
  return explicitWorkspacePath ?? state.workspacePath ?? null;
}
