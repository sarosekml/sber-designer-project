import { Hono } from 'hono';

import { resolveScreenTemplates } from '../screen-templates';

export const screenTemplatesRouter = new Hono();

/**
 * GET /api/project/screen-templates
 *
 * Lists screen templates for the new-screen flow: built-in sber-designer
 * recipes plus, when `workspacePath` is supplied, project-local
 * `.sber-designer/screen-templates/*.screen.md` files. Built-in and
 * project templates with the same id both appear, tagged by `source`.
 */
screenTemplatesRouter.get('/', async (c) => {
  const workspacePath = c.req.query('workspacePath') ?? undefined;
  const { templates, diagnostics } = await resolveScreenTemplates(workspacePath);
  return c.json({ templates, diagnostics });
});
