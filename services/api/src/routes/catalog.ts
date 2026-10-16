import { Hono, type Context } from 'hono';
import type { ComponentCatalog } from '@sber-designer/shared-types';

import { audit } from '../audit';
import { getUser } from '../auth';
import { getCatalog, getStaticCatalog } from '../catalog-cache';
import { getState } from '../state-store';

/**
 * GET /api/catalog
 *
 * Query:
 *   - strategy   = 'auto' | 'storybook' | 'static'  (default: auto)
 *   - previewUrl = override the latest sandbox URL
 *   - workspacePath = override the latest workspacePath
 *   - refresh    = '1' to bypass the in-process TTL cache
 *
 * Strategy picker (ADR-0011):
 *   - storybook → /index.json from a running Storybook dev-server.
 *     Accurate, has stories.
 *   - static    → AST scan of the workspace for default-exported React
 *     components. Used when there's no Storybook (Phase 1.7).
 *   - auto      → try Storybook first; if previewUrl is missing or the
 *     fetch fails AND we have a workspacePath, fall back to static.
 */
export const catalogRouter = new Hono().get('/', async (c) => {
  const user = getUser(c);
  const refresh = c.req.query('refresh') === '1';
  const strategy = (c.req.query('strategy') ?? 'auto') as 'auto' | 'storybook' | 'static';
  const state = getState();
  const previewUrl = c.req.query('previewUrl') ?? state.canvasUrl ?? null;
  const workspacePath = c.req.query('workspacePath') ?? state.workspacePath ?? null;

  if (strategy === 'storybook') {
    if (!previewUrl) {
      return c.json(
        { error: 'no_preview_url', detail: 'strategy=storybook requires previewUrl.' },
        400,
      );
    }
    return runStorybook(c, user, previewUrl, refresh, workspacePath);
  }

  if (strategy === 'static') {
    if (!workspacePath) {
      return c.json(
        { error: 'no_workspace', detail: 'strategy=static requires workspacePath.' },
        400,
      );
    }
    return runStatic(c, user, workspacePath, refresh);
  }

  // Auto: try Storybook, fall back to static on failure or absence.
  if (previewUrl) {
    try {
      const catalog = await getCatalog(previewUrl, {
        bypass: refresh,
        workspaceRoot: workspacePath,
      });
      audit({
        kind: 'config',
        user,
        errorMessage: `catalog source=${catalog.source} components=${catalog.components.length} url=${previewUrl}${refresh ? ' bypass' : ''}`,
      });
      return c.json(catalog);
    } catch (err) {
      // Storybook is unreachable. Try static next if we can.
      if (!workspacePath) {
        const message = err instanceof Error ? err.message : String(err);
        audit({ kind: 'error', user, errorMessage: `catalog (storybook): ${message}` });
        return c.json({ error: 'catalog_failed', detail: message }, 502);
      }
      // fall through
    }
  }

  if (!workspacePath) {
    return c.json(
      {
        error: 'no_source',
        detail:
          'Neither a Storybook previewUrl nor a workspacePath is known. Connect a project first or pass one explicitly.',
      },
      400,
    );
  }
  return runStatic(c, user, workspacePath, refresh);
});

async function runStorybook(
  c: Context,
  user: string,
  previewUrl: string,
  refresh: boolean,
  workspacePath: string | null,
) {
  try {
    const catalog: ComponentCatalog = await getCatalog(previewUrl, {
      bypass: refresh,
      workspaceRoot: workspacePath,
    });
    audit({
      kind: 'config',
      user,
      errorMessage: `catalog source=${catalog.source} components=${catalog.components.length} url=${previewUrl}${refresh ? ' bypass' : ''}`,
    });
    return c.json(catalog);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    audit({ kind: 'error', user, errorMessage: `catalog (storybook): ${message}` });
    return c.json({ error: 'catalog_failed', detail: message }, 502);
  }
}

async function runStatic(c: Context, user: string, workspacePath: string, refresh: boolean) {
  try {
    const catalog: ComponentCatalog = await getStaticCatalog(workspacePath, { bypass: refresh });
    audit({
      kind: 'config',
      user,
      errorMessage: `catalog source=${catalog.source} components=${catalog.components.length} workspace=${workspacePath}${refresh ? ' bypass' : ''}`,
    });
    return c.json(catalog);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    audit({ kind: 'error', user, errorMessage: `catalog (static): ${message}` });
    return c.json({ error: 'catalog_failed', detail: message }, 502);
  }
}
