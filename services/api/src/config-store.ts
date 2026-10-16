/**
 * Loads, caches, and re-reads the project's sber-designer.json.
 *
 * Resolution order (server-side):
 *   1. SBER_DESIGNER_CONFIG_PATH env var
 *   2. <repoRoot>/sber-designer.json   (default for local dev — repoRoot is
 *      services/api/../.. so this resolves to the monorepo's own config.
 *      In a production deployment the file lives next to the bound project
 *      and the env var sets the path explicitly.)
 *
 * 0136 R07 — the tracked file is a *portable template*: it must run on a
 * fresh clone with no machine-specific paths and with optional integrations
 * switched off. Personal wiring (an MCP server living elsewhere on disk, a
 * different default provider) belongs in an untracked overlay:
 *
 *   <config dir>/sber-designer.local.json, or SBER_DESIGNER_CONFIG_LOCAL_PATH
 *
 * The overlay is deep-merged over the template, so a developer keeps the
 * integrations they configured while the shared file stays clonable.
 *
 * Re-reads on file mtime change — no manual reload, no stale config after
 * editing either JSON during development.
 */
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseConfig, type SberDesignerConfig } from '@sber-designer/llm-gateway';

import { loadLocalEnvFiles } from './local-env';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_GUESS = resolve(here, '..', '..', '..');
const UNRESOLVED_ENV_SENTINEL = '__env_unresolved__';

const configPath = (): string =>
  process.env.SBER_DESIGNER_CONFIG_PATH ?? resolve(REPO_ROOT_GUESS, 'sber-designer.json');

export const LOCAL_CONFIG_FILENAME = 'sber-designer.local.json';

const localConfigPath = (basePath: string): string =>
  process.env.SBER_DESIGNER_CONFIG_LOCAL_PATH ?? resolve(dirname(basePath), LOCAL_CONFIG_FILENAME);

interface CacheEntry {
  path: string;
  mtimeMs: number;
  localPath: string;
  localMtimeMs: number | null;
  config: SberDesignerConfig;
}

let cache: CacheEntry | null = null;

export async function loadConfig(): Promise<SberDesignerConfig> {
  loadLocalEnvFiles();
  const path = configPath();
  loadLocalEnvFiles([dirname(path)]);
  const stats = await stat(path);
  const overlayPath = localConfigPath(path);
  const overlayMtimeMs = await stat(overlayPath)
    .then((info) => info.mtimeMs)
    .catch(() => null);
  if (
    cache &&
    cache.path === path &&
    cache.mtimeMs === stats.mtimeMs &&
    cache.localPath === overlayPath &&
    cache.localMtimeMs === overlayMtimeMs
  ) {
    return cache.config;
  }

  const raw = await readFile(path, 'utf8');
  const json = JSON.parse(raw) as unknown;
  const overlay =
    overlayMtimeMs === null ? null : (JSON.parse(await readFile(overlayPath, 'utf8')) as unknown);
  const merged = overlay ? mergeConfigLayers(json, overlay) : json;
  // strictEnv: false — we want missing env-vars to surface as a clear
  // error per request, not crash startup. The chat handler decides
  // what to do when the active provider's apiKey is still a placeholder.
  const cfg = parseConfig(merged, { env: process.env, strictEnv: false });
  cache = {
    path,
    mtimeMs: stats.mtimeMs,
    localPath: overlayPath,
    localMtimeMs: overlayMtimeMs,
    config: cfg,
  };
  return cfg;
}

/**
 * Deep merge for config layers. Objects merge key by key; arrays and scalars
 * are replaced wholesale, so an overlay can narrow `allowedTools` rather than
 * only extend it. `null` in the overlay removes the key — that is how a
 * machine drops a template entry it cannot run.
 */
export function mergeConfigLayers(base: unknown, overlay: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(overlay)) return overlay;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === null) {
      delete merged[key];
      continue;
    }
    merged[key] = key in merged ? mergeConfigLayers(merged[key], value) : value;
  }
  return merged;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function reloadConfig(): Promise<SberDesignerConfig> {
  cache = null;
  return loadConfig();
}

/**
 * Opaque revision of the *resolved* server config (review R4). Changes
 * whenever any effective endpoint/auth/model wiring changes — the browser
 * compares it to decide whether a connection-test result is still current.
 * It is a hash over the whole config, not over any single secret value, so
 * it cannot be used to confirm a guessed key.
 */
export function configRevisionOf(cfg: SberDesignerConfig): string {
  return createHash('sha256').update(JSON.stringify(cfg)).digest('hex').slice(0, 16);
}

export function resetConfigCache(): void {
  cache = null;
}

/**
 * Returns the same config but with every secret-bearing field stripped
 * out, ready to ship to the browser. Browser sees provider list, model
 * names, baseURLs (which are public anyway), and the active default —
 * never apiKey, never raw header values.
 */
export function toFrontendConfig(cfg: SberDesignerConfig): SberDesignerConfig {
  const clone: SberDesignerConfig = structuredClone(cfg);
  for (const provider of Object.values(clone.provider)) {
    if (provider.options?.apiKey !== undefined) {
      // mark presence without leaking value
      provider.options.apiKey = frontendSecretStatus(provider.options.apiKey);
    }
    if (provider.options?.headers) {
      for (const k of Object.keys(provider.options.headers)) {
        provider.options.headers[k] = '__configured__';
      }
    }
  }
  for (const server of Object.values(clone.mcpServers)) {
    if (server.type === 'stdio' && server.env) {
      for (const k of Object.keys(server.env)) {
        server.env[k] = '__configured__';
      }
    }
    if ('headers' in server && server.headers) {
      for (const k of Object.keys(server.headers)) {
        server.headers[k] = '__configured__';
      }
    }
  }
  return clone;
}

function frontendSecretStatus(value: string | undefined): string {
  if (!value) return '__missing__';
  if (/^\{env:[A-Z0-9_]+\}$/u.test(value)) return UNRESOLVED_ENV_SENTINEL;
  return '__configured__';
}
