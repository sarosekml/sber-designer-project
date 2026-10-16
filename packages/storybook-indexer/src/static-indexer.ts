/**
 * Static AST scanner for repos without Storybook.
 *
 * Walks the workspace, reads each `*.{tsx,jsx,ts,js}` file (skipping tests,
 * stories, build outputs, dependencies), and extracts exported React-looking
 * components. Each component becomes a virtual `ComponentEntry` with
 * `source: 'static'` and an empty `stories` list.
 *
 * Implementation is regex-based on purpose — Phase 1.7 keeps the
 * dependency surface tiny (no ts-morph for the indexer; it's only used
 * inside ast-bridge where we already pay for it). The matchers cover
 * the four common shapes:
 *
 *   1. export default function Foo(...) { ... }
 *   2. export default class Foo extends ... { ... }
 *   3. const Foo = (...) => ...; export default Foo;
 *   4. export default Foo;  // where Foo is a const declared above
 *
 * Names must be PascalCase to count as components — JSX names start
 * with a capital letter, and we ignore HOC factories / utility exports.
 *
 * Reach for ts-morph here when accuracy starts to matter (e.g.
 * filtering by JSX-returning vs not). For PoC and customer-kit-style
 * repos, the regex pass is fine.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { ComponentCatalog, ComponentEntry } from '@sber-designer/shared-types';

import { readComponentSidecarLayer } from './usage-metadata';

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.turbo',
  '.tauri',
  '.git',
  'target',
  'coverage',
  '.vite',
  'storybook-static',
]);

const COMP_EXTS = ['.tsx', '.jsx', '.ts', '.js'];

const SKIP_FILE_SUFFIXES = [
  '.test.tsx',
  '.test.jsx',
  '.spec.tsx',
  '.spec.jsx',
  '.stories.tsx',
  '.stories.jsx',
  '.mdx',
];

const PASCAL = /^[A-Z][A-Za-z0-9_]*$/;

const DEFAULT_PATTERNS: { re: RegExp; group: number }[] = [
  // export default function Foo(...)
  { re: /^\s*export\s+default\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*[<(]/m, group: 1 },
  // export default class Foo (extends|<|{)
  { re: /^\s*export\s+default\s+class\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:extends|<|\{)/m, group: 1 },
  // export default React.memo(Foo)  /  export default forwardRef(Foo)
  {
    re: /^\s*export\s+default\s+(?:React\.)?(?:memo|forwardRef)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)/m,
    group: 1,
  },
  // export default Foo;
  { re: /^\s*export\s+default\s+([A-Za-z_][A-Za-z0-9_]*)\s*;?\s*$/m, group: 1 },
];

const NAMED_PATTERNS: { re: RegExp; group: number }[] = [
  // export function Foo(...)
  { re: /^\s*export\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*[<(]/gm, group: 1 },
  // export class Foo (extends|<|{)
  { re: /^\s*export\s+class\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:extends|<|\{)/gm, group: 1 },
  // export const Foo = (...) => ...
  {
    re: /^\s*export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?\(?[^=;]*=>/gm,
    group: 1,
  },
  // export const Foo = memo(...) / forwardRef(...) / React.memo(...)
  {
    re: /^\s*export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:React\.)?(?:memo|forwardRef)\s*\(/gm,
    group: 1,
  },
];

const EXPORT_LIST_RE = /^\s*export\s*\{([^}]+)\}\s*(?:from\s*['"`][^'"`]+['"`])?\s*;?/gm;

export interface IndexFromStaticAstOptions {
  /** Soft cap on files visited. Avoids runaway scans on huge monorepos. */
  maxFiles?: number;
}

export async function indexFromStaticAst(
  workspaceRoot: string,
  opts: IndexFromStaticAstOptions = {},
): Promise<ComponentCatalog> {
  const maxFiles = opts.maxFiles ?? 5_000;
  const components: ComponentEntry[] = [];
  let visited = 0;

  for await (const file of walkFiles(workspaceRoot)) {
    if (visited >= maxFiles) break;
    visited++;
    const entries = await tryExtractComponents(workspaceRoot, file);
    for (const entry of entries) {
      const sidecar = await readComponentSidecarLayer(workspaceRoot, entry);
      components.push(
        sidecar
          ? {
              ...entry,
              description: sidecar.description,
              ...(sidecar.descriptionLayer ? { descriptionLayer: sidecar.descriptionLayer } : {}),
            }
          : entry,
      );
    }
  }

  // Stable order: by relative path, then by name.
  components.sort(
    (a, b) => a.filePath.localeCompare(b.filePath) || a.shortName.localeCompare(b.shortName),
  );

  return {
    source: 'static',
    generatedAt: Date.now(),
    components,
  };
}

async function tryExtractComponents(workspaceRoot: string, abs: string): Promise<ComponentEntry[]> {
  let source: string;
  try {
    source = await readFile(abs, 'utf8');
  } catch {
    return [];
  }

  const entries: ComponentEntry[] = [];

  for (const { re, group } of DEFAULT_PATTERNS) {
    const match = re.exec(source);
    if (!match) continue;
    const name = match[group];
    if (!name || !PASCAL.test(name)) continue;
    entries.push(componentEntry(workspaceRoot, abs, name, false));
    break;
  }

  for (const { re, group } of NAMED_PATTERNS) {
    re.lastIndex = 0;
    for (const match of source.matchAll(re)) {
      const name = match[group];
      if (!name || !PASCAL.test(name)) continue;
      entries.push(componentEntry(workspaceRoot, abs, name, true));
    }
  }

  for (const name of extractExportedNames(source)) {
    entries.push(componentEntry(workspaceRoot, abs, name, true));
  }

  return dedupeById(entries);
}

function extractExportedNames(source: string): string[] {
  const names: string[] = [];
  EXPORT_LIST_RE.lastIndex = 0;
  for (const match of source.matchAll(EXPORT_LIST_RE)) {
    const list = match[1] ?? '';
    for (const item of list.split(',')) {
      const name = exportedName(item);
      if (name && PASCAL.test(name)) names.push(name);
    }
  }
  return names;
}

function exportedName(value: string): string | null {
  const parts = value.trim().split(/\s+as\s+/);
  const raw = (parts[1] ?? parts[0] ?? '').trim();
  if (!raw || raw === 'default' || raw.startsWith('type ')) return null;
  return raw.replace(/^type\s+/, '');
}

function componentEntry(
  workspaceRoot: string,
  abs: string,
  name: string,
  includeNameInId: boolean,
): ComponentEntry {
  const filePath = normalize(relative(workspaceRoot, abs));
  const idBase = filePath.replace(/[^A-Za-z0-9]/g, '-');
  const idSuffix = includeNameInId ? `-${name.replace(/[^A-Za-z0-9]/g, '-')}` : '';
  return {
    id: `static-${idBase}${idSuffix}`,
    title: name,
    shortName: name,
    filePath,
    stories: [],
  };
}

async function* walkFiles(root: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const abs = join(root, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      yield* walkFiles(abs);
      continue;
    }
    if (!entry.isFile()) continue;
    if (SKIP_FILE_SUFFIXES.some((suf) => entry.name.endsWith(suf))) continue;
    if (!COMP_EXTS.some((ext) => entry.name.endsWith(ext))) continue;
    // Tiny size sanity (skip generated bundles that slipped past dir filters).
    try {
      const s = await stat(abs);
      if (s.size > 1_000_000) continue;
    } catch {
      continue;
    }
    yield abs;
  }
}

function dedupeById<T extends { id: string }>(records: T[]): T[] {
  return Array.from(new Map(records.map((record) => [record.id, record])).values());
}

function normalize(path: string): string {
  return path.split('\\').join('/');
}
