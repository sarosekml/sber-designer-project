import { Hono } from 'hono';

import { audit } from '../audit';
import { getUser } from '../auth';
import { importHtmlDesignSystemFiles } from '../html-design-system-import';
import { loadProjectForWorkspace } from '../project-store';
import { getState } from '../state-store';

export const htmlDesignSystemRouter = new Hono().post('/import', async (c) => {
  const user = getUser(c);
  const state = getState();
  const workspacePath = c.req.query('workspacePath') ?? state.workspacePath;
  if (!workspacePath) {
    return c.json(
      { error: 'no_workspace', detail: 'Connect or open a project before importing files.' },
      400,
    );
  }
  try {
    const form = await c.req.formData();
    const files = await Promise.all(
      form.getAll('files').flatMap((entry) => {
        if (typeof entry === 'string') return [];
        return [
          entry.arrayBuffer().then((buffer) => ({
            name: entry.name,
            mimeType: entry.type,
            bytes: new Uint8Array(buffer),
          })),
        ];
      }),
    );
    const project = await loadProjectForWorkspace(workspacePath);
    const result = await importHtmlDesignSystemFiles({
      workspacePath,
      projectName: project.name || state.projectName || 'Untitled project',
      files,
      ...(state.canvasUrl ? { canvasUrl: state.canvasUrl } : {}),
    });
    audit({
      kind: 'config',
      user,
      errorMessage: `imported html design-system files imported=${result.imported.length} skipped=${result.skipped.length} workspace=${workspacePath}`,
    });
    return c.json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    audit({ kind: 'error', user, errorMessage: `import html design-system files: ${detail}` });
    return c.json({ error: 'html_design_system_import_failed', detail }, 422);
  }
});
