/**
 * 0083 G1 — project import-convention cheat-sheet for the component pack.
 *
 * The dominant generation crash was a name collision: the model imported the
 * kit `Grid`/`Table` from the component barrel when the screen needed MUI's
 * layout `Grid`/`Table`. Kit component cards can't surface this (they point at
 * the kit barrel). The universal, project-owned fix is to mine how the
 * project's own screens actually import each symbol and tell the model —
 * especially when a symbol resolves to more than one module (a collision).
 *
 * Pure aggregation here (hermetic); the pack reads a bounded set of screen
 * files and feeds their contents in. No hardcoded package names — every fact is
 * derived from the connected project (CLAUDE.md rule 9).
 */

export interface ImportConvention {
  symbol: string;
  /** Modules this symbol is imported from across the project, most-used first. */
  modules: { module: string; count: number }[];
  /** True when the same symbol is imported from more than one module. */
  collision: boolean;
}

// `import [type] <clause> from '<module>'` — clause captured for default/named parsing.
const IMPORT_RE = /import\s+(type\s+)?([^;'"]+?)\s+from\s+['"]([^'"]+)['"]/g;

interface RawImport {
  symbol: string;
  module: string;
}

function parseImportedSymbols(contents: string): RawImport[] {
  const out: RawImport[] = [];
  IMPORT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMPORT_RE.exec(contents))) {
    const [, typeKeyword, clauseRaw, module] = match;
    if (typeKeyword) continue; // `import type` — not a runtime component
    if (!clauseRaw || !module) continue;
    const clause = clauseRaw.trim();
    if (clause.startsWith('*')) continue; // namespace import — skip

    // Default import: leading identifier before a comma or the named block.
    if (!clause.startsWith('{')) {
      const defaultName = clause.match(/^([A-Za-z_$][\w$]*)/)?.[1];
      if (defaultName) out.push({ symbol: defaultName, module });
    }
    // Named imports inside `{ ... }`; keep the imported name (before `as`).
    const braced = clause.match(/\{([^}]*)\}/)?.[1];
    if (braced) {
      for (const part of braced.split(',')) {
        const name =
          part
            .trim()
            .split(/\s+as\s+/)[0]
            ?.trim() ?? '';
        if (/^[A-Za-z_$][\w$]*$/.test(name)) out.push({ symbol: name, module });
      }
    }
  }
  return out;
}

/**
 * Keep only design-system / framework component imports — what the model writes
 * as JSX. Drops the noise the code review flagged: non-component (lowercase)
 * symbols, `*Props` types, relative paths (component internals), and Storybook
 * scaffolding (`Meta`/`StoryObj`/`StoryFn` live under `@storybook/*`).
 */
function isRelevantImport(symbol: string, module: string): boolean {
  if (!/^[A-Z]/.test(symbol)) return false;
  if (symbol.endsWith('Props')) return false;
  if (module.startsWith('.')) return false;
  if (module.startsWith('@storybook/')) return false;
  return true;
}

export function collectImportConventions(
  files: { contents: string }[],
  options?: { maxCollisions?: number; maxFrequent?: number },
): ImportConvention[] {
  const maxCollisions = options?.maxCollisions ?? 6;
  const maxFrequent = options?.maxFrequent ?? 12;

  const counts = new Map<string, Map<string, number>>();
  for (const file of files) {
    for (const { symbol, module } of parseImportedSymbols(file.contents)) {
      if (!isRelevantImport(symbol, module)) continue;
      const byModule = counts.get(symbol) ?? new Map<string, number>();
      byModule.set(module, (byModule.get(module) ?? 0) + 1);
      counts.set(symbol, byModule);
    }
  }

  const conventions: ImportConvention[] = [];
  for (const [symbol, byModule] of counts) {
    const modules = [...byModule.entries()]
      .map(([module, count]) => ({ module, count }))
      .sort((a, b) => b.count - a.count || a.module.localeCompare(b.module));
    conventions.push({ symbol, modules, collision: modules.length >= 2 });
  }

  const total = (c: ImportConvention): number => c.modules.reduce((sum, m) => sum + m.count, 0);
  const byImpact = (a: ImportConvention, b: ImportConvention): number =>
    total(b) - total(a) || a.symbol.localeCompare(b.symbol);

  // Collisions first (highest-signal: the Grid/Table failure class), then the
  // most frequently imported symbols as a general cheat-sheet.
  const collisions = conventions
    .filter((c) => c.collision)
    .sort(byImpact)
    .slice(0, maxCollisions);
  const frequent = conventions
    .filter((c) => !c.collision)
    .sort(byImpact)
    .slice(0, maxFrequent);
  return [...collisions, ...frequent];
}

export function renderImportConventionsBlock(conventions: ImportConvention[]): string[] {
  if (conventions.length === 0) return [];
  const lines = [
    'Project import conventions (mined from existing screens — import each symbol from the module the project actually uses; do not guess the module):',
  ];
  for (const convention of conventions) {
    const [primary, ...rest] = convention.modules;
    if (!primary) continue; // every mined convention has ≥1 module; satisfies the type
    if (convention.collision) {
      const others = rest.map((m) => `${m.module} (${m.count}×)`).join(', ');
      lines.push(
        `- ${convention.symbol} ← ${primary.module} (${primary.count}×) — COLLISION: same name also from ${others}; pick by intent, do not assume the kit barrel.`,
      );
    } else {
      lines.push(`- ${convention.symbol} ← ${primary.module} (${primary.count}×)`);
    }
  }
  return lines;
}
