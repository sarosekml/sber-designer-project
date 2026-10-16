import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import type { IconCandidateRecord } from './types';

const SOURCE_ROOTS = ['src', 'components', 'app'];
const SOURCE_RE = /\.[cm]?[jt]sx?$/i;
const IGNORE_DIRS = new Set([
  '.git',
  '.next',
  '.sber-designer',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'storybook-static',
]);
const MAX_FILES = 800;
const HTML_ICON_SPEC_PATHS = [
  'design-system/specs/Icons.md',
  'design-system/specs/icons.md',
] as const;

export async function scanProjectIconContracts(
  workspaceRoot: string,
): Promise<IconCandidateRecord[]> {
  const files: string[] = [];
  for (const root of SOURCE_ROOTS) {
    await collectSourceFiles(workspaceRoot, root, files);
    if (files.length >= MAX_FILES) break;
  }

  const byId = new Map<string, IconCandidateRecord>();
  for (const filePath of files.sort()) {
    const abs = resolve(workspaceRoot, filePath);
    const contents = await readFile(abs, 'utf8').catch(() => '');
    if (!looksLikeIconContract(filePath, contents)) continue;
    for (const name of extractIconNames(contents)) {
      const id = `icon-candidate-project-icon-prop-${slug(name)}`;
      if (byId.has(id)) continue;
      byId.set(id, {
        id,
        name,
        source: 'project-icon-prop',
        validFor: ['project-icon-prop'],
        confidence: 'high',
        componentName: inferComponentName(filePath),
        propName: inferPropName(contents),
        filePath,
        tags: Array.from(new Set([...words(name), ...words(filePath)])),
      });
    }
  }
  for (const filePath of HTML_ICON_SPEC_PATHS) {
    const contents = await readFile(resolve(workspaceRoot, filePath), 'utf8').catch(() => '');
    if (!contents || !hasHtmlIconRuntimeContract(contents)) continue;
    for (const name of extractHtmlDataIconNames(contents)) {
      const id = `icon-candidate-project-icon-prop-${slug(name)}`;
      if (byId.has(id)) continue;
      byId.set(id, {
        id,
        name,
        source: 'project-icon-prop',
        validFor: ['project-icon-prop'],
        confidence: 'high',
        componentName: 'i',
        propName: 'data-icon',
        filePath,
        tags: Array.from(new Set([...words(name), 'html', 'data-icon'])),
      });
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function extractHtmlDataIconNames(contents: string): string[] {
  if (!hasHtmlIconRuntimeContract(contents)) return [];
  const names = new Set<string>();
  for (const line of contents.split(/\r?\n/u)) {
    if (line.includes('·')) {
      for (const candidate of line.split('·')) {
        const name = candidate.trim().replace(/^`|`$/gu, '');
        if (/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(name)) names.add(name);
      }
      continue;
    }
    const bullet = /^\s*[-*]\s+`?([A-Za-z0-9][A-Za-z0-9._-]*)`?\s*$/u.exec(line)?.[1];
    if (bullet) names.add(bullet);
  }
  return Array.from(names).sort();
}

function hasHtmlIconRuntimeContract(contents: string): boolean {
  return (
    /\bdata-icon\b/u.test(contents) ||
    /\bDS_ICONS\b/u.test(contents) ||
    /\bicons-data\.js\b/iu.test(contents)
  );
}

async function collectSourceFiles(
  workspaceRoot: string,
  relPath: string,
  out: string[],
): Promise<void> {
  const abs = resolve(workspaceRoot, relPath);
  let entry;
  try {
    entry = await stat(abs);
  } catch {
    return;
  }
  if (entry.isFile()) {
    if (SOURCE_RE.test(abs)) out.push(normalize(relative(workspaceRoot, abs)));
    return;
  }
  if (!entry.isDirectory()) return;

  const entries = await readdir(abs, { withFileTypes: true });
  for (const child of entries) {
    if (IGNORE_DIRS.has(child.name) || child.name.startsWith('.')) continue;
    const childAbs = join(abs, child.name);
    if (child.isDirectory()) {
      await collectSourceFiles(workspaceRoot, normalize(relative(workspaceRoot, childAbs)), out);
    } else if (child.isFile() && SOURCE_RE.test(child.name)) {
      out.push(normalize(relative(workspaceRoot, childAbs)));
    }
    if (out.length >= MAX_FILES) return;
  }
}

function looksLikeIconContract(filePath: string, contents: string): boolean {
  const pathHint = /(^|\/)[^/]*icon[^/]*\.[cm]?[jt]sx?$/iu.test(filePath);
  return pathHint || /\biconName\b/u.test(contents) || /\bIconName\b/u.test(contents);
}

function extractIconNames(contents: string): string[] {
  const values = new Set<string>();
  collectArrayValues(contents, values);
  collectUnionValues(contents, values);
  collectEnumValues(contents, values);
  collectObjectKeys(contents, values);
  return Array.from(values).filter((value) => value.length > 0);
}

function collectArrayValues(contents: string, out: Set<string>): void {
  for (const match of contents.matchAll(
    /\b(?:export\s+)?const\s+([A-Za-z0-9_$]*icon[A-Za-z0-9_$]*|ICON_NAMES|icons)\s*=\s*\[([\s\S]*?)\]\s*(?:as\s+const)?/giu,
  )) {
    for (const value of stringLiterals(match[2] ?? '')) out.add(value);
  }
}

function collectUnionValues(contents: string, out: Set<string>): void {
  for (const match of contents.matchAll(
    /\b(?:type|interface)\s+[A-Za-z0-9_$]*Icon[A-Za-z0-9_$]*[\s\S]{0,240}?\biconName\??\s*:\s*([^;}\n]+)/giu,
  )) {
    for (const value of stringLiterals(match[1] ?? '')) out.add(value);
  }
  for (const match of contents.matchAll(
    /\b(?:export\s+)?type\s+[A-Za-z0-9_$]*Icon[A-Za-z0-9_$]*\s*=\s*([^;]+)/giu,
  )) {
    for (const value of stringLiterals(match[1] ?? '')) out.add(value);
  }
}

function collectEnumValues(contents: string, out: Set<string>): void {
  for (const match of contents.matchAll(
    /\benum\s+[A-Za-z0-9_$]*Icon[A-Za-z0-9_$]*\s*\{([\s\S]*?)\}/giu,
  )) {
    const body = match[1] ?? '';
    const explicit = stringLiterals(body);
    if (explicit.length > 0) {
      for (const value of explicit) out.add(value);
      continue;
    }
    for (const member of body.matchAll(/\b([A-Za-z][A-Za-z0-9_$]*)\b\s*(?:,|=|$)/gu)) {
      out.add(member[1] ?? '');
    }
  }
}

function collectObjectKeys(contents: string, out: Set<string>): void {
  for (const match of contents.matchAll(
    /\b(?:export\s+)?const\s+([A-Za-z0-9_$]*icon[A-Za-z0-9_$]*|icons)\s*=\s*\{([\s\S]*?)\}\s*(?:as\s+const)?/giu,
  )) {
    const body = match[2] ?? '';
    // Matches object property keys in three forms (task 9999 C1):
    //   quoted   : { 'Search': ... }
    //   bare     : { Search: ... }
    //   shorthand: { Search, Folder }   ← icon maps like `iconsMap = { Add, ... }`
    // The trailing delimiter is a lookahead so adjacent shorthand keys (which
    // share the separating comma) are not skipped.
    for (const key of body.matchAll(
      /(?:^|[,{])\s*(?:['"`]([^'"`]+)['"`]|([A-Za-z_$][A-Za-z0-9_$]*))\s*(?=[:,}]|\r?\n|$)/gmu,
    )) {
      out.add(key[1] ?? key[2] ?? '');
    }
  }
}

function stringLiterals(value: string): string[] {
  return Array.from(value.matchAll(/['"`]([^'"`\n]+)['"`]/gu)).map((match) => match[1] ?? '');
}

function inferComponentName(filePath: string): string {
  const parts = filePath.split('/');
  const fileBase = stripExtension(parts.at(-1) ?? 'Icon');
  if (/^icon(?:\.const)?$/iu.test(fileBase)) {
    const parent = parts.at(-2);
    if (parent) return pascal(parent);
  }
  const withoutSuffix = fileBase.replace(/\.const$/iu, '');
  return pascal(withoutSuffix || 'Icon');
}

function inferPropName(contents: string): string {
  if (/\biconName\b/u.test(contents)) return 'iconName';
  if (/\bname\b/u.test(contents)) return 'name';
  return 'iconName';
}

function stripExtension(value: string): string {
  return value.replace(/\.[cm]?[jt]sx?$/iu, '');
}

function pascal(value: string): string {
  const parts = words(value);
  if (parts.length === 0) return 'Icon';
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

function slug(value: string): string {
  return words(value).join('-') || 'icon';
}

function words(value: string): string[] {
  return value
    .replace(/\.[cm]?[jt]sx?$/iu, '')
    .split(/[^A-Za-z0-9]+/)
    .flatMap((part) => part.split(/(?=[A-Z])/))
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function normalize(path: string): string {
  return path.split('\\').join('/');
}
