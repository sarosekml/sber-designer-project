/**
 * 0083 R2 — verify that the symbol the component pack tells the model to import
 * is actually a public export of the advised barrel.
 *
 * The pack advises `import <shortName> from <barrel>`, but a barrel often
 * re-exports a component under an alias — `export { Foo as Bar }` — so
 * `import { Foo }` fails with TS2305. The typecheck gate catches that after the
 * fact; this resolves the barrel's real export names (following `export *` and
 * `export { … } from`) up front so the pack can flag the miss and suggest the
 * real name, sparing the model a round-trip.
 *
 * Best-effort and bounded: unreadable/relative-only resolution, capped depth,
 * shared cache. When nothing resolves we report "not verifiable" so the pack
 * never flags a false positive.
 */
import { posix } from 'node:path';

import { readWorkspaceFile } from '../safe-fs';

export interface ModuleExports {
  /** Public export names (incl. `as` aliases and value declarations). */
  names: Set<string>;
  /** local name → exported name, for `export { Local as Exported }`. */
  aliasByLocal: Map<string, string>;
}

const NAMED_RE = /export\s+(type\s+)?\{([^}]*)\}(?:\s*from\s*['"]([^'"]+)['"])?/g;
const DECL_RE =
  /export\s+(?:async\s+)?(?:const|let|var|function\*?|class|enum)\s+([A-Za-z_$][\w$]*)/g;
const STAR_RE = /export\s+\*\s+(?:as\s+([A-Za-z_$][\w$]*)\s+)?from\s*['"]([^'"]+)['"]/g;

interface ParsedExports {
  names: string[];
  aliasByLocal: Map<string, string>;
  reexportAll: string[];
}

export function parseModuleExports(contents: string): ParsedExports {
  const names: string[] = [];
  const aliasByLocal = new Map<string, string>();
  const reexportAll: string[] = [];

  NAMED_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NAMED_RE.exec(contents))) {
    if (m[1]) continue; // `export type { … }` — not a runtime value
    for (const raw of (m[2] ?? '').split(',')) {
      const part = raw.trim();
      if (!part || part.startsWith('type ')) continue; // inline type specifier
      const [local, exported] = part.split(/\s+as\s+/).map((s) => s.trim());
      const exportedName = exported || local;
      if (!exportedName || !/^[A-Za-z_$][\w$]*$/.test(exportedName)) continue;
      names.push(exportedName);
      if (exported && local) aliasByLocal.set(local, exported);
    }
  }

  DECL_RE.lastIndex = 0;
  while ((m = DECL_RE.exec(contents))) {
    if (m[1]) names.push(m[1]);
  }

  STAR_RE.lastIndex = 0;
  while ((m = STAR_RE.exec(contents))) {
    if (m[1])
      names.push(m[1]); // `export * as NS from …`
    else if (m[2]) reexportAll.push(m[2]); // `export * from …`
  }

  return { names, aliasByLocal, reexportAll };
}

const MAX_DEPTH = 3;

/** Resolve the full public export surface of a barrel file, following re-exports. */
export async function resolveModuleExports(
  workspaceRoot: string,
  entryFile: string,
  cache: Map<string, ModuleExports> = new Map(),
): Promise<ModuleExports> {
  return resolveInner(workspaceRoot, normalize(entryFile), cache, new Set(), MAX_DEPTH);
}

async function resolveInner(
  workspaceRoot: string,
  file: string,
  cache: Map<string, ModuleExports>,
  visiting: Set<string>,
  depth: number,
): Promise<ModuleExports> {
  const cached = cache.get(file);
  if (cached) return cached;
  if (visiting.has(file)) return { names: new Set(), aliasByLocal: new Map() };
  visiting.add(file);

  const result: ModuleExports = { names: new Set(), aliasByLocal: new Map() };
  let contents: string;
  try {
    contents = await readWorkspaceFile(workspaceRoot, file);
  } catch {
    return result; // unreadable: contributes nothing
  }

  const parsed = parseModuleExports(contents);
  for (const name of parsed.names) result.names.add(name);
  for (const [local, exported] of parsed.aliasByLocal) result.aliasByLocal.set(local, exported);

  if (depth > 0) {
    const dir = posix.dirname(file);
    for (const spec of parsed.reexportAll) {
      const sub = await resolveRelativeModule(workspaceRoot, dir, spec);
      if (!sub) continue;
      const subExports = await resolveInner(workspaceRoot, sub, cache, visiting, depth - 1);
      for (const name of subExports.names) result.names.add(name);
      for (const [local, exported] of subExports.aliasByLocal) {
        if (!result.aliasByLocal.has(local)) result.aliasByLocal.set(local, exported);
      }
    }
  }

  cache.set(file, result);
  return result;
}

export interface PublicExportCheck {
  /** False only when a barrel resolved and the symbol was genuinely absent. */
  exported: boolean;
  /** True when at least one barrel resolved; false ⇒ caller must not flag. */
  verifiable: boolean;
  /** The real export name when the advised symbol is only present as an alias. */
  actualName?: string;
  barrel?: string;
}

/**
 * Walk up from a component file to its public barrels (`index.ts(x)`), resolve
 * their exports, and check whether `shortName` is actually exported.
 */
export async function verifyPublicExportName(
  workspaceRoot: string,
  componentFilePath: string,
  shortName: string,
  cache: Map<string, ModuleExports> = new Map(),
): Promise<PublicExportCheck> {
  const barrels = await collectBarrels(workspaceRoot, componentFilePath);
  if (barrels.length === 0) return { exported: true, verifiable: false };

  const names = new Set<string>();
  const aliasByLocal = new Map<string, string>();
  for (const barrel of barrels) {
    const exports = await resolveModuleExports(workspaceRoot, barrel, cache);
    if (exports.names.has(shortName)) {
      return { exported: true, verifiable: true, barrel };
    }
    const actualName = exports.aliasByLocal.get(shortName);
    if (actualName) {
      return { exported: false, verifiable: true, actualName, barrel };
    }
    for (const name of exports.names) names.add(name);
    for (const [local, exported] of exports.aliasByLocal) {
      if (!aliasByLocal.has(local)) aliasByLocal.set(local, exported);
    }
  }

  if (names.has(shortName)) {
    const barrel = barrels[0];
    return {
      exported: true,
      verifiable: true,
      ...(barrel ? { barrel } : {}),
    };
  }
  const actualName = aliasByLocal.get(shortName);
  const barrel = barrels[0];
  return {
    exported: false,
    verifiable: true,
    ...(actualName ? { actualName } : {}),
    ...(barrel ? { barrel } : {}),
  };
}

const MAX_BARREL_LEVELS = 5;

/** Index files at or above the component's directory, nearest first. */
async function collectBarrels(workspaceRoot: string, componentFilePath: string): Promise<string[]> {
  const normalized = normalize(componentFilePath);
  const barrels: string[] = [];
  if (/(^|\/)index\.[cm]?[tj]sx?$/iu.test(normalized)) barrels.push(normalized);

  let dir = posix.dirname(normalized);
  for (let level = 0; level < MAX_BARREL_LEVELS && dir && dir !== '.' && dir !== '/'; level += 1) {
    for (const candidate of [`${dir}/index.ts`, `${dir}/index.tsx`]) {
      if (barrels.includes(candidate)) continue;
      try {
        await readWorkspaceFile(workspaceRoot, candidate);
        barrels.push(candidate);
        break;
      } catch {
        // no barrel at this level
      }
    }
    dir = posix.dirname(dir);
  }
  return barrels;
}

async function resolveRelativeModule(
  workspaceRoot: string,
  fromDir: string,
  spec: string,
): Promise<string | null> {
  if (!spec.startsWith('.')) return null; // only follow relative re-exports
  const base = posix.normalize(posix.join(fromDir, spec));
  const candidates = [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  for (const candidate of candidates) {
    try {
      await readWorkspaceFile(workspaceRoot, candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

function normalize(filePath: string): string {
  return filePath.replace(/\\/gu, '/').replace(/^\.\//u, '');
}
