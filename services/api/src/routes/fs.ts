/**
 * GET /api/fs/list?path=<absolute> — list immediate subdirectories.
 *
 * Used by the Connect / Bootstrap dialogs to power a folder picker
 * UI. Read-only; never returns file contents.
 *
 * Path policy:
 *   - Must be absolute. Defaults to the user's home directory when
 *     omitted.
 *   - Resolved through `realpath` to defeat symlink escapes.
 *   - Restricted to a configurable allow-list root (default: $HOME)
 *     so a curious browser can't enumerate `/etc` or `/`. Extend via
 *     `SBER_DESIGNER_FS_ROOTS` (colon-separated) when you want to
 *     allow `/Volumes` or shared mounts.
 *
 * Hidden entries (dotfiles) are filtered by default. Pass
 * `?hidden=1` to include them.
 */
import { Hono } from 'hono';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { realpath, readdir } from 'node:fs/promises';

import {
  isPathInside,
  readUserSettings,
  requestStorageIdentity,
  updateUserLastFolder,
  userProjectsRoot,
} from '../user-storage';

interface FsEntry {
  name: string;
  isDir: boolean;
}

interface FsListResponse {
  /** Absolute, canonical path that was actually read. */
  path: string;
  /** Parent of `path`, or null when at an allow-list root. */
  parent: string | null;
  entries: FsEntry[];
  /** True when the root is the user's $HOME — shown as "Home" in the UI. */
  isHome: boolean;
}

const HOME = homedir();

export const fsRouter = new Hono().get('/list', async (c) => {
  const identity = requestStorageIdentity(c);
  const scopedRoot = await userProjectsRoot(identity);
  const settings = await readUserSettings(identity);
  const fallbackPath = scopedRoot ?? HOME;
  const explicitPath = c.req.query('path')?.trim();
  const requested = explicitPath || settings.lastFolder || fallbackPath;
  const includeHidden = c.req.query('hidden') === '1';
  const allowRoots = scopedRoot ? [scopedRoot] : configuredAllowRoots();

  if (!requested.startsWith('/')) {
    return c.json({ error: 'invalid_path', detail: 'path must be absolute' }, 400);
  }

  let canonical: string;
  try {
    canonical = await realpath(resolve(requested));
  } catch (err) {
    if (!explicitPath && requested !== fallbackPath) {
      canonical = await realpath(fallbackPath);
    } else {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'not_found', detail: message }, 404);
    }
  }

  if (!isUnderAllowedRoot(canonical, allowRoots) && !explicitPath && requested !== fallbackPath) {
    canonical = await realpath(fallbackPath);
  }

  if (!isUnderAllowedRoot(canonical, allowRoots)) {
    return c.json(
      {
        error: scopedRoot ? 'workspace_outside_user_root' : 'forbidden',
        detail: scopedRoot
          ? 'Projects must live under your folder on this server.'
          : `Path is outside the allowed roots (${allowRoots.join(', ')}). Set SBER_DESIGNER_FS_ROOTS to extend.`,
      },
      scopedRoot ? 422 : 403,
    );
  }

  let raw: { name: string; isDir: () => boolean }[];
  try {
    const dirents = await readdir(canonical, { withFileTypes: true });
    raw = dirents.map((d) => ({ name: d.name, isDir: () => d.isDirectory() }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: 'read_failed', detail: message }, 422);
  }

  const entries: FsEntry[] = raw
    .filter((d) => includeHidden || !d.name.startsWith('.'))
    .map((d) => ({ name: d.name, isDir: d.isDir() }))
    .sort((a, b) => {
      // Directories first, then alphabetical.
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const parentPath = dirname(canonical);
  const parent =
    canonical === parentPath || !isUnderAllowedRoot(parentPath, allowRoots) ? null : parentPath;

  const response: FsListResponse = {
    path: canonical,
    parent,
    entries,
    isHome: canonical === HOME,
  };
  await updateUserLastFolder(identity, canonical).catch(() => undefined);
  return c.json(response);
});

function configuredAllowRoots(): string[] {
  const extras = (process.env.SBER_DESIGNER_FS_ROOTS ?? '')
    .split(':')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => resolve(item));
  return [HOME, ...extras];
}

function isUnderAllowedRoot(path: string, roots: string[]): boolean {
  return roots.some((root) => isPathInside(root, path));
}
