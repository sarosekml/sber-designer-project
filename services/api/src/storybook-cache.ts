import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveInside } from '@sber-designer/ast-bridge';

/**
 * Storybook's cache directory in the connected project holds two very
 * different kinds of content (Storybook 8, webpack5 builder):
 *
 *   node_modules/.cache/storybook/default/…          — builder/index caches,
 *     regenerated on the next build; safe to delete at any time.
 *   node_modules/.cache/storybook/<cacheKey>/public/ — the dev-server's LIVE
 *     output: `iframe.html` and the preview bundles are written here
 *     (`alwaysWriteToDisk: true`) and served FROM DISK while `storybook dev`
 *     runs.
 *
 * Task 9999 (LIVE-1): a screen/folder rename moves `*.stories.tsx` on disk, but
 * stale persisted cache entries keep pointing at the OLD path. Storybook's
 * incremental index build then opens a now-missing file → `Unable to index …
 * ENOENT` → the entire `index.json` returns HTTP 500, which blanks every
 * screen. Deleting the caches on rename fixes that.
 *
 * The delete MUST spare `<cacheKey>/public`, though: removing `iframe.html`
 * from under a running dev-server turns every screen into
 * `Cannot GET /iframe.html` until the next restart. No recompile heals it —
 * in dev the document is byte-identical between builds, so html-webpack-plugin
 * serves its emit cache and never writes the file again.
 */
export async function invalidateStorybookCache(workspaceRoot: string): Promise<boolean> {
  try {
    const cacheDir = resolveInside(workspaceRoot, 'node_modules/.cache/storybook');
    const entries = await readdir(cacheDir, { withFileTypes: true }).catch(() => null);
    if (!entries) return true;
    for (const entry of entries) {
      const entryPath = join(cacheDir, entry.name);
      if (!entry.isDirectory()) {
        await rm(entryPath, { force: true });
        continue;
      }
      const children = await readdir(entryPath, { withFileTypes: true }).catch(() => []);
      const servesPublic = children.some((child) => child.isDirectory() && child.name === 'public');
      if (!servesPublic) {
        await rm(entryPath, { recursive: true, force: true });
        continue;
      }
      for (const child of children) {
        if (child.isDirectory() && child.name === 'public') continue;
        await rm(join(entryPath, child.name), { recursive: true, force: true });
      }
    }
    return true;
  } catch {
    return false;
  }
}
