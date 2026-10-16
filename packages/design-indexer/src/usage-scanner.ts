import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, posix, resolve } from 'node:path';

import {
  collectSourceFiles,
  importMatchesComponent,
  normalizeScanPath,
  parseImports,
  type ImportBinding,
} from './scan-shared';
import type {
  ComponentUsageStats,
  DesignIndexDiagnostic,
  IndexedComponentRecord,
  UsageSnippetRecord,
} from './types';

const SOURCE_ROOTS = ['src', 'components', 'app', 'pages', 'screens', 'stories'];
const SOURCE_RE = /\.[cm]?[jt]sx$/i;
const MAX_FILES = 1200;
const MAX_FILE_BYTES = 400_000;
const MAX_ELEMENT_CHARS = 4_000;
const MAX_SNIPPET_LINES = 15;
const MAX_CLUSTERS_PER_COMPONENT = 4;
const MAX_PAIRS = 5;

export interface ScanComponentUsageInput {
  workspaceRoot: string;
  components: IndexedComponentRecord[];
  /** Extra roots (absolute or workspace-relative) of consumer repos to mine. */
  corpusRoots?: string[] | null;
}

export interface UsageScanResult {
  snippets: UsageSnippetRecord[];
  stats: ComponentUsageStats[];
  scannedFiles: number;
  diagnostics: DesignIndexDiagnostic[];
}

interface RawUsage {
  componentId: string;
  sourcePath: string;
  line: number;
  code: string;
  propNames: string[];
  propsPreview: Record<string, string>;
  origin: UsageSnippetRecord['origin'];
}

/**
 * Mine real JSX usages of catalog components from the connected repo (and
 * optional consumer corpus roots). Deterministic, regex/lexer-based — same
 * dependency-free idiom as the other design-indexer scanners.
 */
export async function scanComponentUsage(input: ScanComponentUsageInput): Promise<UsageScanResult> {
  const diagnostics: DesignIndexDiagnostic[] = [];
  const byShortName = groupByShortName(input.components);
  if (byShortName.size === 0) {
    return { snippets: [], stats: [], scannedFiles: 0, diagnostics };
  }

  const roots: { root: string; origin: 'workspace' | 'corpus' }[] = [
    { root: input.workspaceRoot, origin: 'workspace' },
  ];
  for (const corpusRoot of input.corpusRoots ?? []) {
    const abs = isAbsolute(corpusRoot) ? corpusRoot : resolve(input.workspaceRoot, corpusRoot);
    roots.push({ root: abs, origin: 'corpus' });
  }

  const usages: RawUsage[] = [];
  const fileComponents = new Map<string, Set<string>>();
  let scannedFiles = 0;

  for (const { root, origin } of roots) {
    const files: string[] = [];
    for (const sourceRoot of SOURCE_ROOTS) {
      await collectSourceFiles(root, sourceRoot, files, { fileRe: SOURCE_RE, maxFiles: MAX_FILES });
      if (files.length >= MAX_FILES) break;
    }
    if (origin === 'corpus' && files.length === 0) {
      diagnostics.push({
        level: 'warning',
        filePath: root,
        message: `usageCorpus root has no scannable source files: ${root}`,
      });
    }
    for (const filePath of files.sort()) {
      const abs = resolve(root, filePath);
      let contents: string;
      try {
        const info = await stat(abs);
        if (info.size > MAX_FILE_BYTES) continue;
        contents = await readFile(abs, 'utf8');
      } catch {
        continue;
      }
      scannedFiles += 1;
      const sourcePath = origin === 'corpus' ? `${normalizeScanPath(root)}/${filePath}` : filePath;
      const fileUsages = extractFileUsages(contents, filePath, sourcePath, byShortName, origin);
      if (fileUsages.length === 0) continue;
      usages.push(...fileUsages);
      const present = fileComponents.get(sourcePath) ?? new Set<string>();
      for (const usage of fileUsages) present.add(usage.componentId);
      fileComponents.set(sourcePath, present);
    }
  }

  return {
    snippets: clusterUsages(usages),
    stats: buildStats(usages, fileComponents),
    scannedFiles,
    diagnostics,
  };
}

function groupByShortName(
  components: IndexedComponentRecord[],
): Map<string, IndexedComponentRecord[]> {
  const map = new Map<string, IndexedComponentRecord[]>();
  for (const component of components) {
    const name = component.shortName.trim();
    if (!/^[A-Z][A-Za-z0-9_]*$/.test(name)) continue;
    const existing = map.get(name) ?? [];
    existing.push(component);
    map.set(name, existing);
  }
  return map;
}

function extractFileUsages(
  contents: string,
  filePath: string,
  sourcePath: string,
  byShortName: Map<string, IndexedComponentRecord[]>,
  rootOrigin: 'workspace' | 'corpus',
): RawUsage[] {
  if (!contents.includes('<')) return [];
  const imports = parseImports(contents);
  const usages: RawUsage[] = [];

  for (const [name, candidates] of byShortName) {
    if (!contents.includes(`<${name}`)) continue;
    const component = resolveComponent(name, candidates, imports.get(name), filePath);
    if (!component) continue;
    const origin =
      rootOrigin === 'corpus' ? 'corpus' : classifyOrigin(filePath, component.filePath);

    const tagRe = new RegExp(`<${name}(?=[\\s/>])`, 'g');
    let match: RegExpExecArray | null;
    while ((match = tagRe.exec(contents)) !== null) {
      const element = sliceJsxElement(contents, match.index, name);
      if (!element) continue;
      const openingTag = sliceOpeningTag(contents, match.index);
      const props = openingTag ? parseProps(openingTag, name) : { names: [], preview: {} };
      usages.push({
        componentId: component.id,
        sourcePath,
        line: lineOf(contents, match.index),
        code: trimSnippet(element),
        propNames: props.names,
        propsPreview: props.preview,
        origin,
      });
      tagRe.lastIndex = match.index + Math.max(element.length, name.length + 1);
    }
  }
  return usages;
}

function resolveComponent(
  name: string,
  candidates: IndexedComponentRecord[],
  binding: ImportBinding | undefined,
  filePath: string,
): IndexedComponentRecord | null {
  if (candidates.length === 0) return null;
  if (binding) {
    const resolved = candidates.filter((candidate) =>
      importMatchesComponent(binding.source, filePath, candidate),
    );
    if (resolved.length > 0) return resolved[0] ?? null;
    // Imported from a barrel/package the index cannot see through: accept only
    // an unambiguous shortName match.
    return candidates.length === 1 ? (candidates[0] ?? null) : null;
  }
  // No import: either defined in this file (internal) or ambiguous.
  const local = candidates.find((candidate) => sameDirectory(filePath, candidate.filePath));
  if (local) return local;
  return candidates.length === 1 ? (candidates[0] ?? null) : null;
}

function classifyOrigin(filePath: string, componentFilePath: string): UsageSnippetRecord['origin'] {
  if (/\.stories\.[cm]?[jt]sx?$/i.test(filePath)) return 'story';
  if (sameDirectory(filePath, componentFilePath)) return 'internal';
  if (/(^|\/)(screens?|pages?|views?|routes?|app)\//i.test(normalizeScanPath(filePath))) {
    return 'screen';
  }
  return 'app';
}

function sameDirectory(a: string, b: string): boolean {
  return posix.dirname(normalizeScanPath(a)) === posix.dirname(normalizeScanPath(b));
}

/**
 * Slice the full JSX element starting at `start` (position of `<Name`).
 * Quote/brace-aware; tracks nesting of the same tag name. Returns null when
 * the element cannot be balanced within the scan budget.
 */
function sliceJsxElement(contents: string, start: number, name: string): string | null {
  const end = Math.min(contents.length, start + MAX_ELEMENT_CHARS);
  let depth = 0;
  let index = start;
  while (index < end) {
    if (contents[index] === '<') {
      const open = matchTagAt(contents, index, name, false);
      if (open) {
        const tagEnd = findOpeningTagEnd(contents, index, end);
        if (tagEnd === -1) return null;
        if (contents[tagEnd - 1] === '/') {
          if (depth === 0) return contents.slice(start, tagEnd + 1);
        } else {
          depth += 1;
        }
        index = tagEnd + 1;
        continue;
      }
      const close = matchTagAt(contents, index, name, true);
      if (close) {
        const closeEnd = contents.indexOf('>', index);
        if (closeEnd === -1 || closeEnd >= end) return null;
        depth -= 1;
        if (depth === 0) return contents.slice(start, closeEnd + 1);
        index = closeEnd + 1;
        continue;
      }
    }
    index += 1;
  }
  return null;
}

function matchTagAt(contents: string, index: number, name: string, closing: boolean): boolean {
  const prefix = closing ? `</${name}` : `<${name}`;
  if (!contents.startsWith(prefix, index)) return false;
  const next = contents[index + prefix.length];
  return next === undefined || /[\s/>]/.test(next);
}

/** Find the `>` that terminates the opening tag starting at `start`. */
function findOpeningTagEnd(contents: string, start: number, end: number): number {
  let index = start + 1;
  let braceDepth = 0;
  let quote: string | null = null;
  while (index < end) {
    const char = contents[index];
    if (quote) {
      if (char === quote && contents[index - 1] !== '\\') quote = null;
    } else if (char === '"' || char === "'" || char === '`') {
      quote = char;
    } else if (char === '{') {
      braceDepth += 1;
    } else if (char === '}') {
      braceDepth -= 1;
    } else if (char === '>' && braceDepth === 0) {
      return index;
    }
    index += 1;
  }
  return -1;
}

function sliceOpeningTag(contents: string, start: number): string | null {
  const end = findOpeningTagEnd(contents, start, Math.min(contents.length, start + 2_000));
  return end === -1 ? null : contents.slice(start, end + 1);
}

function parseProps(
  openingTag: string,
  name: string,
): { names: string[]; preview: Record<string, string> } {
  const body = openingTag
    .replace(new RegExp(`^<${name}`), '')
    .replace(/\/?>$/, '')
    .trim();
  const names: string[] = [];
  const preview: Record<string, string> = {};
  const propRe = /([A-Za-z_$][\w-]*)\s*(?:=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\{[^{}]*\}))?/g;
  let match: RegExpExecArray | null;
  while ((match = propRe.exec(body)) !== null) {
    const prop = match[1];
    if (!prop || prop === 'key' || names.includes(prop)) continue;
    names.push(prop);
    const raw = match[2];
    if (!raw) {
      preview[prop] = 'true';
      continue;
    }
    if (raw.startsWith('"') || raw.startsWith("'")) {
      preview[prop] = raw.slice(1, -1);
    } else {
      const inner = raw.slice(1, -1).trim();
      if (/^(true|false|\d+(\.\d+)?|'[^']*'|"[^"]*")$/.test(inner)) {
        preview[prop] = inner.replace(/^['"]|['"]$/g, '');
      }
    }
  }
  return { names: names.sort(), preview };
}

function trimSnippet(element: string): string {
  const dedented = dedent(element);
  const lines = dedented.split('\n');
  if (lines.length <= MAX_SNIPPET_LINES) return dedented;
  const closing = (lines[lines.length - 1] ?? '').trim();
  return [...lines.slice(0, MAX_SNIPPET_LINES - 2), '  {/* … */}', closing].join('\n');
}

function dedent(value: string): string {
  const lines = value.split('\n');
  if (lines.length === 1) return value.trim();
  const indents = lines
    .slice(1)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^\s*/)?.[0].length ?? 0);
  const minIndent = indents.length > 0 ? Math.min(...indents) : 0;
  return [(lines[0] ?? '').trim(), ...lines.slice(1).map((line) => line.slice(minIndent))].join(
    '\n',
  );
}

function lineOf(contents: string, index: number): number {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (contents[cursor] === '\n') line += 1;
  }
  return line;
}

const ORIGIN_RANK: Record<UsageSnippetRecord['origin'], number> = {
  story: 0,
  screen: 1,
  app: 2,
  corpus: 3,
  internal: 4,
};

function clusterUsages(usages: RawUsage[]): UsageSnippetRecord[] {
  const byComponent = new Map<string, RawUsage[]>();
  for (const usage of usages) {
    const existing = byComponent.get(usage.componentId) ?? [];
    existing.push(usage);
    byComponent.set(usage.componentId, existing);
  }

  const records: UsageSnippetRecord[] = [];
  for (const [componentId, componentUsages] of byComponent) {
    const clusters = new Map<string, RawUsage[]>();
    for (const usage of componentUsages) {
      const key = usage.propNames.join(',');
      const cluster = clusters.get(key) ?? [];
      cluster.push(usage);
      clusters.set(key, cluster);
    }
    const ranked = Array.from(clusters.entries()).sort((a, b) => {
      const sizeDelta = b[1].length - a[1].length;
      return sizeDelta !== 0 ? sizeDelta : a[0].localeCompare(b[0]);
    });
    ranked.slice(0, MAX_CLUSTERS_PER_COMPONENT).forEach(([, cluster], index) => {
      const representative = [...cluster].sort(
        (a, b) =>
          ORIGIN_RANK[a.origin] - ORIGIN_RANK[b.origin] ||
          a.code.length - b.code.length ||
          a.sourcePath.localeCompare(b.sourcePath),
      )[0];
      if (!representative) return;
      records.push({
        id: `usage-${componentId}-${index + 1}`,
        componentId,
        sourcePath: representative.sourcePath,
        line: representative.line,
        code: representative.code,
        propNames: representative.propNames,
        propsPreview: representative.propsPreview,
        count: cluster.length,
        share: round2(cluster.length / componentUsages.length),
        origin: representative.origin,
      });
    });
  }
  return records.sort((a, b) => a.id.localeCompare(b.id));
}

function buildStats(
  usages: RawUsage[],
  fileComponents: Map<string, Set<string>>,
): ComponentUsageStats[] {
  const totals = new Map<string, { count: number; files: Set<string> }>();
  for (const usage of usages) {
    const entry = totals.get(usage.componentId) ?? { count: 0, files: new Set<string>() };
    entry.count += 1;
    entry.files.add(usage.sourcePath);
    totals.set(usage.componentId, entry);
  }

  const pairs = new Map<string, Map<string, number>>();
  for (const present of fileComponents.values()) {
    const ids = Array.from(present).sort();
    for (const a of ids) {
      for (const b of ids) {
        if (a === b) continue;
        const map = pairs.get(a) ?? new Map<string, number>();
        map.set(b, (map.get(b) ?? 0) + 1);
        pairs.set(a, map);
      }
    }
  }

  return Array.from(totals.entries())
    .map(([componentId, entry]) => ({
      componentId,
      totalCount: entry.count,
      fileCount: entry.files.size,
      pairsWith: Array.from(pairs.get(componentId)?.entries() ?? [])
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, MAX_PAIRS)
        .map(([id, count]) => ({ componentId: id, count })),
    }))
    .sort((a, b) => a.componentId.localeCompare(b.componentId));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
