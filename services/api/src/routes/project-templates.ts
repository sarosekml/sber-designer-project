import { Hono } from 'hono';

import { audit } from '../audit';
import { getUser } from '../auth';
import { listProjectTemplates } from '../project-templates';

/**
 * GET /api/project/templates
 *
 * Deprecated compatibility route. New screen creation uses
 * /api/project/screen-templates and built-in templates only.
 */
export const projectTemplatesRouter = new Hono().get('/', async (c) => {
  const user = getUser(c);
  const workspacePath = c.req.query('workspacePath') ?? undefined;

  const templates = await listProjectTemplates(workspacePath);
  audit({
    kind: 'config',
    user,
    errorMessage: `screen template compatibility count=${templates.length}`,
  });
  return c.json({ templates });
});
