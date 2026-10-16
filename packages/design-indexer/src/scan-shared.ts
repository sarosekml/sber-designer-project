import { readdir, stat } from 'node:fs/promises';
import { join, posix, relative, resolve } from 'node:path';

import type { IndexedComponentRecord } from './types';

export const SCAN_IGNORE_DIRS = new Set([
  '.git',
  '.next',
  '.sber-designer',
  '.storybook',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'storybook-static',
]);

export interface ImportBinding {
  /** Original exported name ('default' for default imports). */
  imported: string;
  source: string;
}

export async function collectSourceFiles(
  root: string,
  relPath: string,
  out: string[],
  options: { fileRe: RegExp; maxFiles: number },
): Promise<void> {
  const abs = resolve(root, relPath);
  let entry;
  try {
    entry = await stat(abs);
  } catch {
    return;
  }
  if (entry.isFile()) {
    if (options.fileRe.test(abs)) out.push(normalizeScanPath(relative(root, abs)));
    return;
  }
  if (!entry.isDirectory()) return;

  const entries = await readdir(abs, { withFileTypes: true });
  for (const child of entries) {
    if (SCAN_IGNORE_DIRS.has(child.name) || child.name.startsWith('.')) continue;
    const childAbs = join(abs, child.name);
    if (child.isDirectory()) {
      await collectSourceFiles(root, normalizeScanPath(relative(root, childAbs)), out, options);
    } else if (child.isFile() && options.fileRe.test(child.name)) {
      out.push(normalizeScanPath(relative(root, childAbs)));
    }
    if (out.length >= options.maxFiles) return;
  }
}

/** localName -> binding for `import X from`, `import { A, B as C } from`. */
export function parseImports(contents: string): Map<string, ImportBinding> {
  const map = new Map<string, ImportBinding>();
  const importRe = /import\s+(type\s+)?([^'";]+?)\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importRe.exec(contents)) !== null) {
    const [, typeOnly, clause, source] = match;
    if (typeOnly || !clause || !source) continue;
    const defaultName = /^([A-Za-z_$][\w$]*)\s*(?:,|$)/.exec(clause.trim())?.[1];
    if (defaultName) map.set(defaultName, { imported: 'default', source });
    const named = /\{([^}]*)\}/.exec(clause)?.[1];
    if (named) {
      for (const part of named.split(',')) {
        const spec = part.trim();
        if (!spec || spec.startsWith('type ')) continue;
        const asMatch = /^([\w$]+)\s+as\s+([\w$]+)$/.exec(spec);
        const importedName = asMatch?.[1];
        const localName = asMatch?.[2];
        if (importedName && localName) map.set(localName, { imported: importedName, source });
        else if (/^[\w$]+$/.test(spec)) map.set(spec, { imported: spec, source });
      }
    }
  }
  return map;
}

export function importMatchesComponent(
  importSource: string,
  importerPath: string,
  component: IndexedComponentRecord,
): boolean {
  const componentPath = stripSourceExtension(normalizeScanPath(component.filePath));
  const componentDir = posix.dirname(componentPath);
  if (importSource.startsWith('.')) {
    const resolved = stripSourceExtension(
      normalizeScanPath(posix.join(posix.dirname(normalizeScanPath(importerPath)), importSource)),
    );
    return (
      resolved === componentPath ||
      resolved === componentDir ||
      componentPath.startsWith(`${resolved}/`)
    );
  }
  // Alias or package import: match on path suffix, e.g. "@/components/atoms/Button".
  const sourcePath = stripSourceExtension(normalizeScanPath(importSource.replace(/^[^/]*\//, '')));
  if (!sourcePath) return false;
  return (
    componentPath.endsWith(sourcePath) ||
    componentDir.endsWith(sourcePath) ||
    sourcePath.endsWith(componentDir.replace(/^src\//, ''))
  );
}

export function normalizeScanPath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function stripSourceExtension(value: string): string {
  return value.replace(/\.[cm]?[jt]sx?$/i, '').replace(/\/index$/, '');
}

/** Slice a balanced `{...}` block starting at the `{` at `start`. */
export function sliceBraceBlock(contents: string, start: number, maxChars: number): string | null {
  if (contents[start] !== '{') return null;
  const end = Math.min(contents.length, start + maxChars);
  let depth = 0;
  let quote: string | null = null;
  for (let index = start; index < end; index += 1) {
    const char = contents[index];
    if (quote) {
      if (char === quote && contents[index - 1] !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return contents.slice(start, index + 1);
    }
  }
  return null;
}
