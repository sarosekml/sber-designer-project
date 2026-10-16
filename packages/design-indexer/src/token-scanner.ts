import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { DESIGN_INDEX_PATHS, type TokenRecord } from './types';
import { HTML_DESIGN_SYSTEM_PATHS } from '@sber-designer/shared-types';

const MAX_FILES = 500;
const TOKEN_ROOTS = [
  'src',
  'app',
  'pages',
  'screens',
  'public',
  'site',
  'styles',
  'theme',
  'tokens',
  HTML_DESIGN_SYSTEM_PATHS.folder,
];
const STYLE_TOKEN_FILE_RE = /\.(css|scss|sass|less)$/;
const STRUCTURED_TOKEN_FILE_RE = /\.(json|js|ts|mjs|cjs)$/;
const TAILWIND_CONFIG_FILES = [
  'tailwind.config.js',
  'tailwind.config.cjs',
  'tailwind.config.mjs',
  'tailwind.config.ts',
];

export async function scanProjectTokens(
  workspaceRoot: string,
  designMdContents: string | null,
  designBriefContents: string | null = null,
): Promise<TokenRecord[]> {
  const tokens = [
    ...extractTokensFromText(designMdContents ?? '', 'DESIGN.md', 'design-md'),
    ...extractTokensFromText(
      designBriefContents ?? '',
      DESIGN_INDEX_PATHS.designBrief,
      'design-brief',
    ),
  ];
  const files: string[] = [];
  for (const root of TOKEN_ROOTS) {
    await collectFiles(workspaceRoot, root, files);
  }
  for (const config of TAILWIND_CONFIG_FILES) {
    const abs = resolve(workspaceRoot, config);
    if (await exists(abs)) files.push(abs);
  }
  for (const file of files.sort().slice(0, MAX_FILES)) {
    const filePath = normalize(relative(workspaceRoot, file));
    const contents = await readFile(file, 'utf8').catch(() => '');
    tokens.push(...extractTokensFromText(contents, filePath, tokenSourceForFile(filePath)));
  }
  return dedupeById(tokens).sort((a, b) => a.id.localeCompare(b.id));
}

function extractTokensFromText(
  contents: string,
  filePath: string,
  source: TokenRecord['source'],
): TokenRecord[] {
  const tokens: TokenRecord[] = [];
  if (filePath === 'DESIGN.md') {
    const frontmatter = contents.startsWith('---')
      ? contents.slice(3, contents.indexOf('\n---', 3)).trim()
      : '';
    const tokenRe = /^\s{2,}([A-Za-z0-9_-]+):\s*"?([^"\n]+)"?\s*$/gm;
    let match: RegExpExecArray | null;
    while ((match = tokenRe.exec(frontmatter))) {
      const name = match[1];
      const value = match[2]?.trim();
      if (!name || !value) continue;
      tokens.push({
        id: `design-md:${name}`,
        name,
        value,
        source,
        filePath,
        kind: inferTokenKind(name, value),
      });
    }
  }
  if (STYLE_TOKEN_FILE_RE.test(filePath)) {
    tokens.push(...extractCssVariableTokens(contents, filePath, source));
  } else {
    const cssVarRe = /--([A-Za-z0-9_-]+)\s*:\s*([^;]+);/g;
    let match: RegExpExecArray | null;
    while ((match = cssVarRe.exec(contents))) {
      const name = match[1];
      const value = match[2]?.trim();
      if (!name || !value) continue;
      tokens.push({
        id: `${source}:${filePath}:${name}`,
        name,
        value,
        source,
        filePath,
        kind: inferTokenKind(name, value),
      });
    }
  }
  if (source === 'tailwind' || source === 'theme') {
    let match: RegExpExecArray | null;
    const structuredRe = /["']?([A-Za-z][A-Za-z0-9_-]*)["']?\s*:\s*["']([^"'\n]+)["']/g;
    while ((match = structuredRe.exec(contents))) {
      const name = match[1];
      const value = match[2]?.trim();
      if (!name || !value) continue;
      const kind = inferTokenKind(name, value);
      if (kind === 'unknown') continue;
      tokens.push({
        id: `${source}:${filePath}:${name}`,
        name,
        value,
        source,
        filePath,
        kind,
      });
    }
  }
  return tokens;
}

function extractCssVariableTokens(
  contents: string,
  filePath: string,
  source: TokenRecord['source'],
): TokenRecord[] {
  const tokens: TokenRecord[] = [];
  const blockRe = /(:root|\[\s*data-theme\s*=\s*(['"]?)([^'"\]\s]+)\2\s*\])\s*\{([\s\S]*?)\}/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(contents))) {
    const selector = match[1] ?? '';
    const theme = selector.startsWith('[') ? match[3]?.trim() : undefined;
    const body = match[4] ?? '';
    tokens.push(...extractCssVariablesFromBlock(body, filePath, source, theme));
  }
  if (tokens.length > 0) return tokens;
  return extractCssVariablesFromBlock(contents, filePath, source);
}

function extractCssVariablesFromBlock(
  contents: string,
  filePath: string,
  source: TokenRecord['source'],
  theme?: string,
): TokenRecord[] {
  const tokens: TokenRecord[] = [];
  const cssVarRe = /--([A-Za-z0-9_-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = cssVarRe.exec(contents))) {
    const rawName = match[1];
    const value = match[2]?.trim();
    if (!rawName || !value) continue;
    const name = theme ? `${rawName}@${theme}` : rawName;
    tokens.push({
      id: `${source}:${filePath}:${theme ? `${theme}:` : ''}${rawName}`,
      name,
      value,
      source,
      filePath,
      kind: inferTokenKind(rawName, value),
      ...(theme ? { theme } : {}),
    });
  }
  return tokens;
}

async function collectFiles(
  workspaceRoot: string,
  relPath: string,
  files: string[],
): Promise<void> {
  const abs = resolve(workspaceRoot, relPath);
  let entry;
  try {
    entry = await stat(abs);
  } catch {
    return;
  }
  if (entry.isFile()) {
    if (isTokenFile(relPath)) files.push(abs);
    return;
  }
  if (!entry.isDirectory()) return;
  const entries = await readdir(abs, { withFileTypes: true });
  for (const child of entries) {
    if (child.name.startsWith('.') || child.name === 'node_modules') continue;
    const childAbs = join(abs, child.name);
    if (child.isDirectory()) {
      await collectFiles(workspaceRoot, normalize(relative(workspaceRoot, childAbs)), files);
    } else if (child.isFile() && isTokenFile(normalize(relative(workspaceRoot, childAbs)))) {
      files.push(childAbs);
    }
    if (files.length >= MAX_FILES) return;
  }
}

async function exists(abs: string): Promise<boolean> {
  try {
    await stat(abs);
    return true;
  } catch {
    return false;
  }
}

function isTokenFile(filePath: string): boolean {
  if (STYLE_TOKEN_FILE_RE.test(filePath)) return true;
  if (!STRUCTURED_TOKEN_FILE_RE.test(filePath)) return false;
  return (
    filePath.startsWith('theme/') ||
    filePath.startsWith('tokens/') ||
    /(^|\/)(tokens|theme)\.(json|js|ts|mjs|cjs)$/.test(filePath)
  );
}

function tokenSourceForFile(filePath: string): TokenRecord['source'] {
  if (filePath.startsWith('tailwind.config.')) return 'tailwind';
  if (STYLE_TOKEN_FILE_RE.test(filePath)) return 'css';
  return 'theme';
}

function inferTokenKind(name: string, value: string): TokenRecord['kind'] {
  const combined = `${name} ${value}`.toLowerCase();
  if (/#[0-9a-f]{3,8}|rgb|hsl|color|bg|surface|text/.test(combined)) return 'color';
  if (/spacing|space|gap|margin|padding|\d(px|rem)$/.test(combined)) return 'spacing';
  if (/radius|rounded|border-radius/.test(combined)) return 'radius';
  if (/font|typography|line-height|weight/.test(combined)) return 'typography';
  return 'unknown';
}

function dedupeById<T extends { id: string }>(records: T[]): T[] {
  return Array.from(new Map(records.map((record) => [record.id, record])).values());
}

function normalize(path: string): string {
  return path.split('\\').join('/');
}
