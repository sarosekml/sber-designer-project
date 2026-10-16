/**
 * Shared best-effort readers for a component's TypeScript props source.
 *
 * Extracted from `variant-scanner.ts` (task 0133) so the variant scanner and
 * the component-param extractor parse props the same way. Everything here is
 * regex/brace-slicing based on purpose: it must survive partially typed,
 * non-compiling, and JS-only projects without a TS program.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { normalizeScanPath, parseImports, sliceBraceBlock } from './scan-shared';

export const STORY_FILE_RE = /\.stories\.[cm]?[jt]sx?$/i;
export const MAX_PROPS_FILE_BYTES = 400_000;
export const MAX_SIBLING_PROPS_FILES = 8;
export const MIN_UNION_VALUES = 2;
export const MAX_UNION_VALUES = 12;

/** A named `interface`/`type` block with its inheritance parents. */
export interface PropsTypeBlock {
  extends: string[];
  body: string;
}

/** Component file + up to a few same-directory siblings (barrels re-export). */
export async function readComponentSources(
  workspaceRoot: string,
  filePath: string,
): Promise<string> {
  const abs = resolve(workspaceRoot, filePath);
  const chunks: string[] = [];
  await readSourceFileInto(abs, chunks);
  if (shouldReadSiblingComponentSources(filePath)) {
    for (const sibling of await siblingSourceFiles(abs)) {
      await readSourceFileInto(sibling, chunks);
    }
  }
  return chunks.join('\n');
}

export function shouldReadSiblingComponentSources(filePath: string): boolean {
  const normalized = normalizeScanPath(filePath);
  return /(^|\/)index\.[cm]?[jt]sx?$/i.test(normalized) || STORY_FILE_RE.test(normalized);
}

/** Colocated `*.stories.*` files next to a component source, if any. */
export async function readColocatedStorySources(
  workspaceRoot: string,
  filePath: string,
  componentName: string,
  maxFiles = 2,
): Promise<string> {
  const abs = resolve(workspaceRoot, filePath);
  const chunks: string[] = [];
  try {
    const dir = dirname(abs);
    const entries = await readdir(dir, { withFileTypes: true });
    const stories = entries
      .filter((entry) => entry.isFile() && STORY_FILE_RE.test(entry.name))
      .map((entry) => entry.name)
      .sort();
    for (const name of stories) {
      if (chunks.length >= maxFiles) break;
      const storyPath = join(dir, name);
      const source = await readBoundedSource(storyPath);
      if (!source || !storyReferencesComponent(source, storyPath, abs, componentName)) continue;
      chunks.push(source);
    }
  } catch {
    /* directory unreadable */
  }
  return chunks.join('\n');
}

function storyReferencesComponent(
  contents: string,
  storyPath: string,
  definitionPath: string,
  componentName: string,
): boolean {
  const localNames: string[] = [];
  for (const [localName, binding] of parseImports(contents)) {
    if (
      binding.imported === componentName ||
      (binding.imported === 'default' &&
        importSourceMatchesDefinition(binding.source, storyPath, definitionPath))
    ) {
      localNames.push(localName);
    }
  }
  for (const localName of localNames) {
    const escaped = escapeRegExp(localName);
    if (
      new RegExp(`\\bcomponent\\s*:\\s*${escaped}\\b`, 'u').test(contents) ||
      new RegExp(`\\bMeta\\s*<\\s*typeof\\s+${escaped}\\b`, 'u').test(contents)
    ) {
      return true;
    }
  }
  return false;
}

function importSourceMatchesDefinition(
  importSource: string,
  storyPath: string,
  definitionPath: string,
): boolean {
  const definition = stripSourcePath(definitionPath);
  if (importSource.startsWith('.')) {
    return stripSourcePath(resolve(dirname(storyPath), importSource)) === definition;
  }
  const source = stripSourcePath(importSource.replace(/^[@~]\//u, ''));
  return Boolean(source) && definition.endsWith(source);
}

function stripSourcePath(value: string): string {
  return normalizeScanPath(value)
    .replace(/\.[cm]?[jt]sx?$/iu, '')
    .replace(/\/index$/u, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** Modules a props type may pull shared unions from, e.g. `@/types`. */
const MAX_TYPE_IMPORT_FILES = 12;
const TYPE_IMPORT_EXTENSIONS = ['.ts', '.tsx', '.d.ts', '/index.ts', '/index.tsx'];

/**
 * Sources of locally imported modules, so a props type declared as
 * `size?: ButtonSize` can still resolve its union when `ButtonSize` lives in a
 * shared types module. Bounded and best-effort: relative and common alias
 * specifiers only, plus the exact dependency behind a `keyof typeof` enum.
 */
export async function readImportedTypeSources(
  workspaceRoot: string,
  filePath: string,
  sourceText: string,
): Promise<string> {
  const chunks: string[] = [];
  const seen = new Set<string>();
  const queue: { fromDir: string; specifier: string; depth: number; priority: number }[] = [];
  const rootDir = dirname(resolve(workspaceRoot, filePath));
  const specifiers = new Set<string>();
  const sourceImports = parseTypeAwareImports(sourceText);
  const propsText = extractPropsBlocks(sourceText).join('\n');
  const referencedPropTypes = new Set(
    Array.from(propsText.matchAll(/\b[A-Za-z_$][\w$]*\b/gu)).flatMap((match) =>
      match[0] ? [match[0]] : [],
    ),
  );
  for (const binding of sourceImports.values()) {
    if (isLocalSpecifier(binding.source)) specifiers.add(binding.source);
  }
  // Type-ish modules first: with a bounded budget, `@/types` must not lose the
  // race to styles/utils imports that never declare a union.
  const importPriority = (value: string) =>
    Number(looksLikeTypeModule(value)) * 2 +
    Number(
      Array.from(sourceImports).some(
        ([localName, binding]) =>
          binding.source === value &&
          /(?:Name|Props|Type|Types|Color|Size|Variant)$/u.test(localName),
      ),
    ) *
      4 +
    Number(
      Array.from(sourceImports).some(
        ([localName, binding]) => binding.source === value && referencedPropTypes.has(localName),
      ),
    ) *
      10;
  for (const specifier of specifiers) {
    queue.push({ fromDir: rootDir, specifier, depth: 0, priority: importPriority(specifier) });
  }

  while (queue.length > 0 && chunks.length < MAX_TYPE_IMPORT_FILES) {
    queue.sort((a, b) => b.priority - a.priority);
    const item = queue.shift() as (typeof queue)[number];
    const resolved = await resolveTypeModule(workspaceRoot, item.fromDir, item.specifier);
    if (!resolved || seen.has(resolved.path)) continue;
    seen.add(resolved.path);
    chunks.push(resolved.contents);
    // Shared types are usually behind a barrel (`export * from './common'`).
    // `keyof typeof iconsMap` needs one additional, narrowly selected import
    // containing that exact object. Both stay inside the file-count budget.
    if (item.depth < 2) {
      for (const specifier of reExportSpecifiers(resolved.contents)) {
        queue.push({
          fromDir: dirname(resolved.path),
          specifier,
          depth: item.depth + 1,
          priority: item.priority + 1 + Number(looksLikeTypeModule(specifier)),
        });
      }
      for (const specifier of keyofTypeDependencySpecifiers(resolved.contents)) {
        queue.push({
          fromDir: dirname(resolved.path),
          specifier,
          depth: item.depth + 1,
          priority: item.priority + 3,
        });
      }
    }
  }
  return chunks.join('\n');
}

async function resolveTypeModule(
  workspaceRoot: string,
  fromDir: string,
  specifier: string,
): Promise<{ path: string; contents: string } | null> {
  const base = specifier.startsWith('.')
    ? resolve(fromDir, specifier)
    : resolve(workspaceRoot, 'src', specifier.replace(/^[@~]\//u, ''));
  for (const extension of TYPE_IMPORT_EXTENSIONS) {
    const path = `${base}${extension}`;
    const chunks: string[] = [];
    await readSourceFileInto(path, chunks);
    if (chunks.length > 0) return { path, contents: chunks[0] as string };
  }
  return null;
}

function reExportSpecifiers(contents: string): string[] {
  const out: string[] = [];
  const re = /export\s+(?:type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/gu;
  let match: RegExpExecArray | null;
  while ((match = re.exec(contents)) !== null) {
    const specifier = match[1];
    if (specifier && isLocalSpecifier(specifier)) out.push(specifier);
  }
  return out;
}

function keyofTypeDependencySpecifiers(contents: string): string[] {
  const dependencies = new Set(
    Array.from(contents.matchAll(/\bkeyof\s+typeof\s+([A-Za-z_$][\w$]*)/gu)).flatMap((match) =>
      match[1] ? [match[1]] : [],
    ),
  );
  if (dependencies.size === 0) return [];
  const specifiers = new Set<string>();
  for (const [localName, binding] of parseImports(contents)) {
    if (dependencies.has(localName) && isLocalSpecifier(binding.source)) {
      specifiers.add(binding.source);
    }
  }
  return Array.from(specifiers);
}

function parseTypeAwareImports(
  contents: string,
): Map<string, { imported: string; source: string }> {
  const imports = new Map(parseImports(contents));
  const importRe = /import\s+(?:type\s+)?([^'";]+?)\s+from\s+['"]([^'"]+)['"]/gu;
  let match: RegExpExecArray | null;
  while ((match = importRe.exec(contents)) !== null) {
    const clause = match[1]?.trim();
    const source = match[2];
    if (!clause || !source) continue;
    const defaultName = /^([A-Za-z_$][\w$]*)\s*(?:,|$)/u.exec(clause)?.[1];
    if (defaultName) imports.set(defaultName, { imported: 'default', source });
    const named = /\{([^}]*)\}/u.exec(clause)?.[1];
    if (!named) continue;
    for (const part of named.split(',')) {
      const spec = part.trim().replace(/^type\s+/u, '');
      if (!spec) continue;
      const asMatch = /^([\w$]+)\s+as\s+([\w$]+)$/u.exec(spec);
      const imported = asMatch?.[1] ?? (/^[\w$]+$/u.test(spec) ? spec : undefined);
      const local = asMatch?.[2] ?? imported;
      if (imported && local) imports.set(local, { imported, source });
    }
  }
  return imports;
}

function isLocalSpecifier(specifier: string): boolean {
  return /^(?:\.{1,2}\/|[@~]\/|src\/)/u.test(specifier);
}

function looksLikeTypeModule(specifier: string): boolean {
  return /types?|const|enum/iu.test(specifier);
}

async function readSourceFileInto(path: string, chunks: string[]): Promise<void> {
  const source = await readBoundedSource(path);
  if (source) chunks.push(source);
}

async function readBoundedSource(path: string): Promise<string | null> {
  try {
    const info = await stat(path);
    if (!info.isFile() || info.size > MAX_PROPS_FILE_BYTES) return null;
    return await readFile(path, 'utf8');
  } catch {
    /* missing file: the index may be stale */
    return null;
  }
}

async function siblingSourceFiles(abs: string): Promise<string[]> {
  try {
    const dir = dirname(abs);
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter(
        (entry) =>
          entry.isFile() &&
          /\.[cm]?[jt]sx?$/i.test(entry.name) &&
          !/(^|\/)index\.[cm]?[jt]sx?$/i.test(entry.name) &&
          !STORY_FILE_RE.test(entry.name) &&
          !entry.name.includes('.test.'),
      )
      .map((entry) => entry.name)
      .sort()
      .slice(0, MAX_SIBLING_PROPS_FILES)
      .map((name) => join(dir, name));
  } catch {
    return [];
  }
}

/** `interface Name extends A, B { ... }` blocks keyed by name. */
export function collectInterfaceBlocks(contents: string): Map<string, PropsTypeBlock> {
  const blocks = new Map<string, PropsTypeBlock>();
  const headRe = /interface\s+([A-Za-z_$][\w$]*)\b([^{]*)\{/gu;
  let match: RegExpExecArray | null;
  while ((match = headRe.exec(contents)) !== null) {
    const name = match[1];
    if (!name) continue;
    const extendsClause = /extends\s+([^{]+)/u.exec(match[2] ?? '')?.[1] ?? '';
    const block = sliceBraceBlock(contents, match.index + match[0].length - 1, 20_000);
    if (!block) continue;
    blocks.set(name, { extends: typeReferenceNames(extendsClause), body: block.slice(1, -1) });
  }
  return blocks;
}

/**
 * Named props blocks from both `interface XProps {...}` and
 * `type XProps = A & { ... }`. Intersection members become `extends` parents so
 * callers can follow the chain the same way for either declaration style.
 */
export function collectPropsTypeBlocks(contents: string): Map<string, PropsTypeBlock> {
  const blocks = collectInterfaceBlocks(contents);
  const headRe = /type\s+([A-Za-z_$][\w$]*)\s*(?:<[^=]*>)?\s*=\s*([^;{]*)\{/gu;
  let match: RegExpExecArray | null;
  while ((match = headRe.exec(contents)) !== null) {
    const name = match[1];
    if (!name || blocks.has(name)) continue;
    const block = sliceBraceBlock(contents, match.index + match[0].length - 1, 20_000);
    if (!block) continue;
    blocks.set(name, {
      extends: typeReferenceNames(match[2] ?? ''),
      body: block.slice(1, -1),
    });
  }
  return blocks;
}

/**
 * Member declarations of the props type belonging to `componentName`, following
 * `extends`/intersection parents declared in the same sources.
 *
 * Scoped on purpose (0083 R6): when a chunk holds several components, pulling
 * members from every `*Props` would assign a neighbour's props to this one.
 * Falls back to the sole `*Props` block when there is exactly one.
 */
export function collectComponentPropsMembers(
  contents: string,
  componentName: string,
): { members: string[]; parents: string[] } {
  const blocks = collectPropsTypeBlocks(contents);
  const propsNames = Array.from(blocks.keys()).filter((name) => name.endsWith('Props'));
  const target = `${compactTypeName(componentName)}props`;
  let roots = propsNames.filter((name) => compactTypeName(name) === target);
  if (roots.length === 0) roots = propsNames.length === 1 ? propsNames : [];
  if (roots.length === 0) return { members: [], parents: [] };

  const members: string[] = [];
  const parents: string[] = [];
  const visited = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const name = queue.shift() as string;
    if (visited.has(name)) continue;
    visited.add(name);
    const block = blocks.get(name);
    if (!block) {
      parents.push(name);
      continue;
    }
    members.push(...splitMembers(block.body));
    for (const parent of block.extends) if (!visited.has(parent)) queue.push(parent);
  }
  return { members, parents };
}

/** Compact alphanumeric name for tolerant matching ("IconButton" -> "iconbutton"). */
export function compactTypeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Split an interface body into member declarations (`;`- or newline-separated). */
export function splitMembers(block: string): string[] {
  const members: string[] = [];
  let current = '';
  let depth = 0;
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*'))
      continue;
    // Union continuation lines attach to the previous member.
    if (current && (trimmed.startsWith('|') || current.trimEnd().endsWith('|'))) {
      current += ` ${trimmed}`;
    } else if (current && depth === 0) {
      members.push(current);
      current = trimmed;
    } else {
      current = current ? `${current} ${trimmed}` : trimmed;
    }
    for (const char of trimmed) {
      if (char === '{' || char === '(') depth += 1;
      if (char === '}' || char === ')') depth = Math.max(0, depth - 1);
    }
  }
  if (current) members.push(current);
  return members.map((member) => member.replace(/[;,]\s*$/, ''));
}

export function parsePropMember(
  member: string,
): { name: string; optional: boolean; type: string } | null {
  const match = /^(?:readonly\s+)?([A-Za-z_$][\w$]*)(\??)\s*:\s*([\s\S]+)$/u.exec(member.trim());
  const name = match?.[1];
  const type = match?.[3]?.trim();
  if (!name || !type) return null;
  return { name, optional: match?.[2] === '?', type };
}

/**
 * Enum-like type aliases declared in the same sources.
 *
 * In addition to direct literal unions this resolves compositions such as
 * `type Color = AlertColor | DefaultColor` and finite object-key enums such as
 * `type IconName = keyof typeof iconsMap`.
 */
export function extractLiteralUnionAliases(
  contents: string,
  maxValues = MAX_UNION_VALUES,
): Map<string, string[]> {
  const expressions = new Map<string, string>();
  const aliasRe = /(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+(?:\n\s*\|[^;\n]+)*)/g;
  let match: RegExpExecArray | null;
  while ((match = aliasRe.exec(contents)) !== null) {
    const aliasName = match[1];
    const typeText = match[2];
    if (!aliasName || !typeText) continue;
    expressions.set(aliasName, typeText.trim());
  }

  const aliases = new Map<string, string[]>();
  const resolving = new Set<string>();
  const resolveAlias = (name: string): string[] | null => {
    const cached = aliases.get(name);
    if (cached) return cached;
    if (resolving.has(name)) return null;
    const expression = expressions.get(name);
    if (!expression) return null;
    resolving.add(name);
    const values = resolveEnumExpression(contents, expression, resolveAlias, maxValues);
    resolving.delete(name);
    if (values && values.length >= MIN_UNION_VALUES && values.length <= maxValues) {
      aliases.set(name, values);
      return values;
    }
    return null;
  };
  for (const name of expressions.keys()) resolveAlias(name);
  return aliases;
}

function resolveEnumExpression(
  contents: string,
  expression: string,
  resolveAlias: (name: string) => string[] | null,
  maxValues: number,
): string[] | null {
  const values: string[] = [];
  const parts = expression
    .replace(/[;,]\s*$/u, '')
    .replace(/^\|\s*/u, '')
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part !== 'undefined' && part !== 'null');
  for (const part of parts) {
    const literal = /^['"]([^'"]*)['"]$/u.exec(part)?.[1];
    if (literal !== undefined) {
      values.push(literal);
    } else {
      const objectName = /^keyof\s+typeof\s+([A-Za-z_$][\w$]*)$/u.exec(part)?.[1];
      const resolved = objectName
        ? objectLiteralKeys(contents, objectName, maxValues)
        : /^[A-Za-z_$][\w$]*$/u.test(part)
          ? resolveAlias(part)
          : null;
      if (!resolved) return null;
      values.push(...resolved);
    }
    if (new Set(values).size > maxValues) return null;
  }
  return Array.from(new Set(values));
}

function objectLiteralKeys(contents: string, name: string, maxValues: number): string[] | null {
  const escaped = name.replace(/[^\w$]/gu, '');
  if (!escaped) return null;
  const head = new RegExp(
    `(?:export\\s+)?(?:const|let|var)\\s+${escaped}(?:\\s*:[^=]+)?\\s*=\\s*\\{`,
    'u',
  ).exec(contents);
  if (!head) return null;
  const block = sliceBraceBlock(contents, head.index + head[0].length - 1, 400_000);
  if (!block) return null;

  const keys: string[] = [];
  for (const entry of splitTopLevelCommaEntries(block.slice(1, -1))) {
    const trimmed = entry.trim();
    if (!trimmed || trimmed.startsWith('...')) continue;
    const key =
      /^([A-Za-z_$][\w$]*)\s*(?::|$)/u.exec(trimmed)?.[1] ??
      /^['"]([^'"]+)['"]\s*:/u.exec(trimmed)?.[1];
    if (!key || keys.includes(key)) continue;
    keys.push(key);
    if (keys.length > maxValues) return null;
  }
  return keys.length >= MIN_UNION_VALUES ? keys : null;
}

function splitTopLevelCommaEntries(body: string): string[] {
  const entries: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: string | null = null;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{' || char === '[' || char === '(') depth += 1;
    else if (char === '}' || char === ']' || char === ')') depth = Math.max(0, depth - 1);
    else if (char === ',' && depth === 0) {
      entries.push(body.slice(start, index));
      start = index + 1;
    }
  }
  entries.push(body.slice(start));
  return entries;
}

/** Bodies of `interface XxxProps {...}` / `type XxxProps = {...}` blocks. */
export function extractPropsBlocks(contents: string): string[] {
  const blocks: string[] = [];
  const headRe = /(?:interface|type)\s+[A-Za-z_$][\w$]*Props\b[^{=]*(?:=\s*)?\{/g;
  let match: RegExpExecArray | null;
  while ((match = headRe.exec(contents)) !== null) {
    const braceStart = match.index + match[0].length - 1;
    const block = sliceBraceBlock(contents, braceStart, 20_000);
    if (block) blocks.push(block.slice(1, -1));
  }
  // Inline props: `function X({...}: { variant?: 'a' | 'b'; ... })`.
  const inlineRe = /\)\s*:\s*\{|\}\s*:\s*\{/g;
  while ((match = inlineRe.exec(contents)) !== null) {
    const braceStart = match.index + match[0].length - 1;
    const block = sliceBraceBlock(contents, braceStart, 4_000);
    if (block) blocks.push(block.slice(1, -1));
  }
  return blocks;
}

export function literalUnionValues(typeText: string): string[] | null {
  const cleaned = typeText
    .replace(/[;,]\s*$/, '')
    .replace(/^\|\s*/, '')
    .trim();
  const parts = cleaned.split('|').map((part) => part.trim());
  if (parts.length < 2) return null;
  const values: string[] = [];
  for (const part of parts) {
    const literal = /^['"]([^'"]*)['"]$/.exec(part)?.[1];
    if (literal === undefined) return null;
    values.push(literal);
  }
  return Array.from(new Set(values));
}

function typeReferenceNames(clause: string): string[] {
  return clause
    .split(/[,&]/u)
    .map((part) => part.trim().replace(/<.*$/u, '').trim())
    .filter((part) => /^[A-Za-z_$][\w$]*$/u.test(part));
}
