import type { Dirent } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { DESIGN_INDEX_PATHS } from '@sber-designer/design-indexer';

export interface DesignToken {
  id: string;
  name: string;
  value: string;
  source: string;
}

export interface DesignTokens {
  colors: DesignToken[];
  spacing: DesignToken[];
  typography: DesignToken[];
  radius: DesignToken[];
  shadows: DesignToken[];
}

type TokenKind = keyof DesignTokens;

const EMPTY: DesignTokens = {
  colors: [],
  spacing: [],
  typography: [],
  radius: [],
  shadows: [],
};

export async function loadDesignTokens(workspaceRoot: string): Promise<DesignTokens> {
  const groups = cloneEmpty();
  await loadIndexedTokens(workspaceRoot, groups);
  await loadCssVariableTokens(workspaceRoot, groups);
  await loadTailwindTokens(workspaceRoot, groups);
  return dedupeGroups(groups);
}

async function loadIndexedTokens(workspaceRoot: string, groups: DesignTokens): Promise<void> {
  const contents = await readOptional(resolve(workspaceRoot, DESIGN_INDEX_PATHS.tokens));
  if (!contents) return;
  let parsed: { tokens?: unknown[] } | null = null;
  try {
    parsed = JSON.parse(contents) as { tokens?: unknown[] };
  } catch {
    return;
  }
  for (const item of parsed.tokens ?? []) {
    if (!item || typeof item !== 'object') continue;
    const token = item as {
      id?: unknown;
      name?: unknown;
      value?: unknown;
      kind?: unknown;
      source?: unknown;
      filePath?: unknown;
    };
    if (
      typeof token.id !== 'string' ||
      typeof token.name !== 'string' ||
      typeof token.value !== 'string'
    ) {
      continue;
    }
    const kind = normalizeKind(typeof token.kind === 'string' ? token.kind : 'unknown');
    if (!kind) continue;
    groups[kind].push({
      id: token.id,
      name: token.name,
      value: token.value,
      source:
        typeof token.filePath === 'string'
          ? token.filePath
          : typeof token.source === 'string'
            ? token.source
            : DESIGN_INDEX_PATHS.tokens,
    });
  }
}

async function loadCssVariableTokens(workspaceRoot: string, groups: DesignTokens): Promise<void> {
  const files = await listCandidateCssFiles(workspaceRoot);
  for (const filePath of files) {
    const contents = await readOptional(resolve(workspaceRoot, filePath));
    if (!contents || contents.length > 256_000) continue;
    const matches = contents.matchAll(/(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+);/g);
    for (const match of matches) {
      const name = match[1]!;
      const value = match[2]!.trim();
      const kind = inferKind(name, value);
      if (!kind) continue;
      groups[kind].push({
        id: `css:${name}`,
        name,
        value,
        source: filePath,
      });
    }
  }
}

async function loadTailwindTokens(workspaceRoot: string, groups: DesignTokens): Promise<void> {
  const candidates = [
    'tailwind.config.js',
    'tailwind.config.ts',
    'tailwind.config.cjs',
    'tailwind.config.mjs',
  ];
  for (const filePath of candidates) {
    const contents = await readOptional(resolve(workspaceRoot, filePath));
    if (!contents) continue;
    extractTailwindSection(contents, 'colors', 'colors', filePath, groups);
    extractTailwindSection(contents, 'spacing', 'spacing', filePath, groups);
    extractTailwindSection(contents, 'borderRadius', 'radius', filePath, groups);
    extractTailwindSection(contents, 'boxShadow', 'shadows', filePath, groups);
    extractTailwindSection(contents, 'fontSize', 'typography', filePath, groups);
  }
}

function extractTailwindSection(
  contents: string,
  sectionName: string,
  kind: TokenKind,
  filePath: string,
  groups: DesignTokens,
): void {
  const section = new RegExp(`${sectionName}\\s*:\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, 'm').exec(
    contents,
  )?.[1];
  if (!section) return;
  const entries = section.matchAll(/['"]?([A-Za-z0-9_-]+)['"]?\s*:\s*['"]([^'"]+)['"]/g);
  for (const match of entries) {
    const name = match[1]!;
    const value = match[2]!;
    groups[kind].push({
      id: `tailwind:${sectionName}:${name}`,
      name: `${sectionName}.${name}`,
      value,
      source: filePath,
    });
  }
}

async function listCandidateCssFiles(workspaceRoot: string): Promise<string[]> {
  const found: string[] = [];
  await walk(workspaceRoot, workspaceRoot, found);
  return found;
}

async function walk(root: string, dir: string, found: string[]): Promise<void> {
  if (found.length >= 200) return;
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (found.length >= 200) return;
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(root, abs, found);
      continue;
    }
    if (!entry.isFile() || !/\.(css|scss)$/.test(entry.name)) continue;
    const rel = relative(root, abs).split('\\').join('/');
    try {
      const size = (await stat(abs)).size;
      if (size <= 256_000) found.push(rel);
    } catch {
      // ignore unreadable files
    }
  }
}

function normalizeKind(kind: string): TokenKind | null {
  if (kind === 'color') return 'colors';
  if (kind === 'spacing') return 'spacing';
  if (kind === 'radius') return 'radius';
  if (kind === 'typography') return 'typography';
  return null;
}

function inferKind(name: string, value: string): TokenKind | null {
  const lower = name.toLowerCase();
  if (/^#|rgb\(|rgba\(|hsl\(|hsla\(|oklch\(|var\(--color/.test(value) || lower.includes('color')) {
    return 'colors';
  }
  if (lower.includes('radius')) return 'radius';
  if (lower.includes('shadow')) return 'shadows';
  if (lower.includes('font') || lower.includes('line-height') || lower.includes('text')) {
    return 'typography';
  }
  if (/^-?\d+(\.\d+)?(px|rem|em|%)$/.test(value) || lower.includes('space')) {
    return 'spacing';
  }
  return null;
}

function dedupeGroups(groups: DesignTokens): DesignTokens {
  const next = cloneEmpty();
  for (const key of Object.keys(groups) as TokenKind[]) {
    const seen = new Set<string>();
    for (const token of groups[key]) {
      const id = `${token.id}:${token.value}`;
      if (seen.has(id)) continue;
      seen.add(id);
      next[key].push(token);
      if (next[key].length >= 80) break;
    }
  }
  return next;
}

function cloneEmpty(): DesignTokens {
  return {
    colors: [...EMPTY.colors],
    spacing: [...EMPTY.spacing],
    typography: [...EMPTY.typography],
    radius: [...EMPTY.radius],
    shadows: [...EMPTY.shadows],
  };
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}
