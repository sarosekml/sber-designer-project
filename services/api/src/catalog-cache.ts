/**
 * Catalog cache + strategy selector.
 *
 * Two ways to build the catalog:
 *   1. live Storybook /index.json — preferred, accurate, has stories;
 *   2. static AST scan — fallback for repos without Storybook (Phase 1.7).
 *
 * Cache key: `storybook::<previewUrl>` or `static::<workspaceRoot>`.
 * TTL is 30 s by default. Auto-invalidates on state-store changes via
 * subscribeState (wired in services/api/src/index.ts).
 *
 * In-memory single-process; multi-tenant sharding lands later.
 */
import { indexFromStaticAst, indexFromStorybook } from '@sber-designer/storybook-indexer';
import type { ComponentCatalog } from '@sber-designer/shared-types';

const DEFAULT_TTL_MS = 30_000;

interface Entry {
  catalog: ComponentCatalog;
  fetchedAt: number;
}

const cache = new Map<string, Entry>();

export interface GetCatalogOptions {
  /** Force a fresh fetch even if a cached entry is fresh enough. */
  bypass?: boolean;
  /** TTL override (mostly for tests). */
  ttlMs?: number;
  /** Workspace root used to read Storybook CSF description metadata. */
  workspaceRoot?: string | null;
}

/**
 * Storybook-backed catalog. Throws on a fetch failure — the caller
 * decides how to surface it.
 */
export async function getCatalog(
  previewUrl: string,
  opts: GetCatalogOptions = {},
): Promise<ComponentCatalog> {
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  const now = Date.now();
  const key = `storybook::${previewUrl}::${opts.workspaceRoot ?? 'no-workspace'}`;

  if (!opts.bypass) {
    const hit = cache.get(key);
    if (hit && now - hit.fetchedAt < ttl) return hit.catalog;
  }

  const catalog = await indexFromStorybook(previewUrl, {
    timeoutMs: 3_000,
    ...(opts.workspaceRoot ? { workspaceRoot: opts.workspaceRoot } : {}),
  });
  cache.set(key, { catalog, fetchedAt: now });
  return catalog;
}

/**
 * Static-AST catalog for repos without a running Storybook. Slower
 * than the Storybook path on first call (one fs walk + readFile per
 * candidate file), but cached aggressively.
 */
export async function getStaticCatalog(
  workspaceRoot: string,
  opts: GetCatalogOptions = {},
): Promise<ComponentCatalog> {
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  const now = Date.now();
  const key = `static::${workspaceRoot}`;

  if (!opts.bypass) {
    const hit = cache.get(key);
    if (hit && now - hit.fetchedAt < ttl) return hit.catalog;
  }

  const catalog = await indexFromStaticAst(workspaceRoot);
  cache.set(key, { catalog, fetchedAt: now });
  return catalog;
}

/** Drop entries — called when a sandbox session is stopped or workspace changes. */
export function invalidateCatalog(targetKeyOrPrefix?: string): void {
  if (!targetKeyOrPrefix) {
    cache.clear();
    return;
  }
  // Allow drop-by-prefix (so we can drop both `storybook::` and `static::`
  // entries for a particular project at once if we ever need to).
  for (const k of cache.keys()) {
    if (
      k === targetKeyOrPrefix ||
      k.endsWith(`::${targetKeyOrPrefix}`) ||
      k.includes(`::${targetKeyOrPrefix}::`)
    ) {
      cache.delete(k);
    }
  }
}

export function catalogCacheSize(): number {
  return cache.size;
}

/**
 * Auto-strategy: try Storybook, fall back to static AST. Returns null
 * when neither source is available. Useful for the prompt-builder and
 * the list_components tool — they don't care which strategy ran, only
 * about the catalog itself.
 */
export async function resolveCatalog(input: {
  canvasUrl?: string | null;
  workspacePath?: string | null;
  bypass?: boolean;
}): Promise<
  { catalog: import('@sber-designer/shared-types').ComponentCatalog } | { unavailable: string }
> {
  if (input.canvasUrl) {
    try {
      const catalog = await getCatalog(input.canvasUrl, {
        ...(input.bypass === undefined ? {} : { bypass: input.bypass }),
        ...(input.workspacePath ? { workspaceRoot: input.workspacePath } : {}),
      });
      return { catalog };
    } catch (err) {
      if (!input.workspacePath) {
        const reason = err instanceof Error ? err.message : String(err);
        return { unavailable: reason };
      }
      // fall through to static
    }
  }
  if (input.workspacePath) {
    try {
      const catalog = await getStaticCatalog(input.workspacePath, {
        ...(input.bypass === undefined ? {} : { bypass: input.bypass }),
      });
      return { catalog };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return { unavailable: reason };
    }
  }
  return { unavailable: 'no source — neither canvasUrl nor workspacePath' };
}
