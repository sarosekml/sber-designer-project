import { Hono } from 'hono';
import { z } from 'zod';

import { audit } from '../audit';
import { getUser } from '../auth';
import { importAssetPack } from '../assets/asset-pack-importer';
import { materializeIndexedIcon } from '../assets/materialize-indexed-icon';
import { resolveCatalog } from '../catalog-cache';
import { generateProjectDesignIndexFiles } from '../design-index';
import { getProject } from '../project-store';
import { getState } from '../state-store';
import { markStorybookReloadPendingForPath } from '../storybook-reload';

const ImportAssetPackInput = z
  .object({
    workspacePath: z.string().min(1).optional(),
    sourcePath: z.string().min(1),
    packName: z.string().min(1).optional(),
    kinds: z
      .array(z.enum(['icons', 'illustrations']))
      .min(1)
      .default(['icons', 'illustrations']),
    overwrite: z.boolean().optional(),
  })
  .strict();

const MaterializeIndexedIconInput = z
  .object({
    workspacePath: z.string().min(1).optional(),
    iconId: z.string().min(1),
  })
  .strict();

export const assetsRouter = new Hono()
  .post('/import-pack', async (c) => {
    const user = getUser(c);
    const parse = ImportAssetPackInput.safeParse(await c.req.json().catch(() => ({})));
    if (!parse.success) {
      return c.json(
        {
          error: 'invalid_asset_pack_import',
          detail: parse.error.issues.map((issue) => issue.message).join(', '),
        },
        400,
      );
    }

    const workspaceRoot = parse.data.workspacePath ?? getState().workspacePath;
    if (!workspaceRoot) {
      return c.json(
        {
          error: 'no_workspace',
          detail: 'No workspacePath is known. Connect or open a project first.',
        },
        400,
      );
    }

    try {
      const result = await importAssetPack({
        workspaceRoot,
        sourcePath: parse.data.sourcePath,
        packName: parse.data.packName ?? 'Imported assets',
        kinds: parse.data.kinds,
        overwrite: parse.data.overwrite === true,
      });
      audit({
        kind: 'config',
        user,
        errorMessage: `imported asset pack imported=${result.imported} skipped=${result.skipped.length} workspace=${workspaceRoot}`,
      });
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `import asset pack: ${message}` });
      return c.json({ error: 'asset_pack_import_failed', detail: message }, 422);
    }
  })
  .post('/materialize-indexed-icon', async (c) => {
    const user = getUser(c);
    const state = getState();
    const parse = MaterializeIndexedIconInput.safeParse(await c.req.json().catch(() => ({})));
    if (!parse.success) {
      return c.json(
        {
          error: 'invalid_icon_materialization',
          detail: parse.error.issues.map((issue) => issue.message).join(', '),
        },
        400,
      );
    }

    const workspaceRoot = parse.data.workspacePath ?? state.workspacePath;
    if (!workspaceRoot) {
      return c.json(
        {
          error: 'no_workspace',
          detail: 'No workspacePath is known. Connect or open a project first.',
        },
        400,
      );
    }

    try {
      const materialized = await materializeIndexedIcon({
        workspaceRoot,
        iconId: parse.data.iconId,
      });
      for (const filePath of materialized.changedFiles) {
        markStorybookReloadPendingForPath(filePath, true);
      }
      const catalogResult = await resolveCatalog({
        workspacePath: workspaceRoot,
        bypass: true,
        ...(state.canvasUrl ? { canvasUrl: state.canvasUrl } : {}),
      });
      const project = getProject();
      const indexResult = await generateProjectDesignIndexFiles(workspaceRoot, {
        projectName: project.name || state.projectName || 'Untitled project',
        catalog: 'catalog' in catalogResult ? catalogResult.catalog : null,
      });
      const changedFiles = Array.from(
        new Set([...materialized.changedFiles, ...indexResult.changedFiles]),
      );
      audit({
        kind: 'config',
        user,
        errorMessage: `materialized indexed icon iconId=${parse.data.iconId} workspace=${workspaceRoot}`,
      });
      return c.json({
        ok: true,
        asset: materialized.asset,
        changedFiles,
        assetChangedFiles: materialized.changedFiles,
        indexChangedFiles: indexResult.changedFiles,
        projectIndex: {
          status: indexResult.context.status,
          stale: indexResult.context.stale,
          counts: indexResult.context.manifest?.counts ?? null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      audit({ kind: 'error', user, errorMessage: `materialize indexed icon: ${message}` });
      return c.json({ error: 'icon_materialization_failed', detail: message }, 422);
    }
  });
