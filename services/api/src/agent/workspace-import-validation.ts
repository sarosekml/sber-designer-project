import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { Project, Node, type SourceFile } from 'ts-morph';
import { resolveInside } from '@sber-designer/ast-bridge';

const VALIDATED_EXTENSIONS = /\.(tsx?|jsx?|mjs|cjs)$/i;
const IMPORT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];
const FALLBACK_WORKSPACE_ALIASES: WorkspaceAlias[] = [
  { pattern: '@/*', targets: ['src/*'], source: 'fallback' },
];
const TSCONFIG_CANDIDATES = ['tsconfig.json', 'jsconfig.json'];
const VITE_CONFIG_CANDIDATES = [
  'vite.config.ts',
  'vite.config.mts',
  'vite.config.cts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.cjs',
];

interface WorkspaceAlias {
  pattern: string;
  targets: string[];
  source: 'fallback' | 'tsconfig' | 'vite';
}

interface ImportReference {
  specifier: string;
  index: number;
  namedImports: string[];
}

interface UnresolvedImport {
  specifier: string;
  line: number;
  suggestions: string[];
}

interface MissingNamedImport {
  specifier: string;
  importedName: string;
  line: number;
  availableExports: string[];
}

interface WorkspaceImportReference extends ImportReference {
  target: string;
  kind: 'relative' | 'alias';
}

interface ExportedNamesResult {
  names: Set<string>;
  complete: boolean;
}

export async function validateWorkspaceRelativeImports(
  workspaceRoot: string,
  relPath: string,
  contents: string,
): Promise<void> {
  if (!VALIDATED_EXTENSIONS.test(relPath)) return;

  const aliases = await loadWorkspaceAliases(workspaceRoot);
  const imports = collectImportReferences(contents)
    .map((ref) => workspaceImportReference(ref, aliases))
    .filter((ref): ref is WorkspaceImportReference => ref !== null);
  if (imports.length === 0) return;

  const unresolved: UnresolvedImport[] = [];
  const missingNamedImports: MissingNamedImport[] = [];
  const exportCache = new Map<string, ExportedNamesResult>();
  for (const ref of imports) {
    const resolved = await resolveWorkspaceImport(workspaceRoot, relPath, ref);
    if (!resolved) {
      unresolved.push({
        specifier: ref.specifier,
        line: lineNumberAt(contents, ref.index),
        suggestions: await importSuggestions(workspaceRoot, ref),
      });
      continue;
    }
    if (ref.namedImports.length === 0) continue;
    const exportedNames = await collectExportedNames(workspaceRoot, resolved, exportCache, aliases);
    for (const importedName of ref.namedImports) {
      if (exportedNames.names.has(importedName)) continue;
      if (!exportedNames.complete) continue;
      missingNamedImports.push({
        specifier: ref.specifier,
        importedName,
        line: lineNumberAt(contents, ref.index),
        availableExports: Array.from(exportedNames.names).sort((a, b) => a.localeCompare(b)),
      });
    }
  }

  if (unresolved.length === 0 && missingNamedImports.length === 0) return;

  const fromDir = path.posix.dirname(relPath.replace(/\\/g, '/'));
  const unresolvedDetails = unresolved
    .map((item) => {
      const suggestion = item.suggestions.length
        ? ` Suggestions: ${item.suggestions.join('; ')}.`
        : '';
      return `line ${item.line}: ${item.specifier}.${suggestion}`;
    })
    .join(', ');
  const namedDetails = missingNamedImports
    .map((item) => {
      const available = item.availableExports.length
        ? ` Available exports: ${item.availableExports.slice(0, 12).join(', ')}.`
        : ' No named exports were detected.';
      return `line ${item.line}: ${item.specifier} has no named export ${item.importedName}.${available}`;
    })
    .join(', ');
  const details = [
    unresolved.length > 0 ? `unresolved workspace import(s): ${unresolvedDetails}.` : null,
    missingNamedImports.length > 0 ? `invalid named workspace import(s): ${namedDetails}.` : null,
  ]
    .filter(Boolean)
    .join(' ');
  throw new Error(
    [
      `Cannot write ${relPath}: ${details}`,
      `Relative imports are resolved from ${fromDir}.`,
      'Workspace alias imports such as @/components/... are resolved from src/.',
      'Project aliases from tsconfig/jsconfig paths and common Vite resolve.alias forms are also resolved when present.',
      'For generated screen stories under src/stories/screens/YYYY-MM-DD, imports from src/pages or src/components usually need ../../../pages/... or ../../../components/... unless a workspace alias is configured.',
    ].join(' '),
  );
}

function workspaceImportReference(
  ref: ImportReference,
  aliases: WorkspaceAlias[],
): WorkspaceImportReference | null {
  if (ref.specifier.startsWith('.')) {
    return { ...ref, target: ref.specifier, kind: 'relative' };
  }
  for (const alias of aliases) {
    const target = resolveSpecifierWithAlias(ref.specifier, alias);
    if (!target) continue;
    return { ...ref, target, kind: 'alias' };
  }
  return null;
}

async function importSuggestions(
  workspaceRoot: string,
  ref: WorkspaceImportReference,
): Promise<string[]> {
  const suggestions: string[] = [];
  if (ref.kind !== 'alias') return suggestions;

  const absBase = resolveInside(workspaceRoot, path.posix.normalize(ref.target));
  try {
    const fileStat = await stat(absBase);
    if (fileStat.isDirectory()) {
      const sameNamedModule = await sameNamedDirectoryModule(workspaceRoot, ref);
      if (sameNamedModule) {
        suggestions.push(`use ${sameNamedModule}`);
      }
      suggestions.push('folder imports need an index export');
    }
  } catch {
    // Missing paths are handled by the unresolved import error itself.
  }

  return suggestions;
}

async function sameNamedDirectoryModule(
  workspaceRoot: string,
  ref: WorkspaceImportReference,
): Promise<string | null> {
  const segment = path.posix.basename(ref.target);
  const targetWithSegment = path.posix.join(ref.target, segment);
  const candidateBase = resolveInside(workspaceRoot, targetWithSegment);
  for (const candidate of importCandidates(candidateBase)) {
    try {
      const fileStat = await stat(candidate);
      if (fileStat.isFile()) {
        return `${ref.specifier}/${segment}`;
      }
    } catch {
      // Keep trying TypeScript/Vite resolution candidates.
    }
  }
  return null;
}

function collectImportReferences(contents: string): ImportReference[] {
  const refs: ImportReference[] = [];
  const sourceFile = parseSource('workspace-import-validation.tsx', contents);
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    refs.push({
      specifier: importDeclaration.getModuleSpecifierValue(),
      index: importDeclaration.getStart(),
      namedImports: importDeclaration.getNamedImports().map((item) => item.getName()),
    });
  }
  for (const exportDeclaration of sourceFile.getExportDeclarations()) {
    const specifier = exportDeclaration.getModuleSpecifierValue();
    if (!specifier) continue;
    refs.push({
      specifier,
      index: exportDeclaration.getStart(),
      namedImports: exportDeclaration.getNamedExports().map((item) => item.getName()),
    });
  }

  const dynamicImportPattern = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match: RegExpExecArray | null;

  while ((match = dynamicImportPattern.exec(contents))) {
    refs.push({ specifier: match[1] ?? '', index: match.index, namedImports: [] });
  }

  return refs.filter((ref) => ref.specifier.length > 0);
}

async function resolveWorkspaceImport(
  workspaceRoot: string,
  fromRelPath: string,
  ref: WorkspaceImportReference,
): Promise<string | null> {
  const targetRelPath =
    ref.kind === 'relative'
      ? path.posix.normalize(
          path.posix.join(path.posix.dirname(fromRelPath.replace(/\\/g, '/')), ref.target),
        )
      : path.posix.normalize(ref.target);
  const candidateBase = resolveInside(workspaceRoot, targetRelPath);
  const candidates = importCandidates(candidateBase);

  for (const candidate of candidates) {
    try {
      const fileStat = await stat(candidate);
      if (fileStat.isFile()) return candidate;
    } catch {
      // Keep trying TypeScript/Vite resolution candidates.
    }
  }

  return null;
}

function importCandidates(absBase: string): string[] {
  const ext = path.extname(absBase);
  const hasKnownImportExtension = IMPORT_EXTENSIONS.includes(ext);
  const exactOrExtended = hasKnownImportExtension
    ? [absBase]
    : [absBase, ...IMPORT_EXTENSIONS.map((suffix) => `${absBase}${suffix}`)];
  return [
    ...exactOrExtended,
    ...IMPORT_EXTENSIONS.map((suffix) => path.join(absBase, `index${suffix}`)),
  ];
}

async function collectExportedNames(
  workspaceRoot: string,
  absPath: string,
  cache: Map<string, ExportedNamesResult>,
  aliases: WorkspaceAlias[],
  visiting = new Set<string>(),
): Promise<ExportedNamesResult> {
  const key = path.normalize(absPath);
  const cached = cache.get(key);
  if (cached) return cached;
  if (visiting.has(key)) return { names: new Set<string>(), complete: true };
  visiting.add(key);

  const contents = await readFile(absPath, 'utf8').catch(() => null);
  if (contents === null) {
    const empty = { names: new Set<string>(), complete: true };
    cache.set(key, empty);
    return empty;
  }

  const sourceFile = parseSource(absPath, contents);
  const exportedNames = new Set<string>();
  let complete = true;

  for (const statement of sourceFile.getStatements()) {
    if (Node.isVariableStatement(statement) && statement.isExported()) {
      for (const declaration of statement.getDeclarations()) {
        exportedNames.add(declaration.getName());
      }
      continue;
    }
    if (Node.isFunctionDeclaration(statement) && statement.isExported()) {
      const name = statement.getName();
      if (name) exportedNames.add(name);
      if (statement.isDefaultExport()) exportedNames.add('default');
      continue;
    }
    if (Node.isClassDeclaration(statement) && statement.isExported()) {
      const name = statement.getName();
      if (name) exportedNames.add(name);
      if (statement.isDefaultExport()) exportedNames.add('default');
      continue;
    }
    if (Node.isInterfaceDeclaration(statement) && statement.isExported()) {
      const name = statement.getName();
      if (name) exportedNames.add(name);
      continue;
    }
    if (Node.isTypeAliasDeclaration(statement) && statement.isExported()) {
      const name = statement.getName();
      if (name) exportedNames.add(name);
      continue;
    }
    if (Node.isEnumDeclaration(statement) && statement.isExported()) {
      const name = statement.getName();
      if (name) exportedNames.add(name);
    }
  }

  for (const assignment of sourceFile.getExportAssignments()) {
    if (!assignment.isExportEquals()) exportedNames.add('default');
  }

  for (const declaration of sourceFile.getExportDeclarations()) {
    const namedExports = declaration.getNamedExports();
    if (namedExports.length > 0) {
      for (const namedExport of namedExports) {
        exportedNames.add(namedExport.getAliasNode()?.getText() ?? namedExport.getName());
      }
      continue;
    }
    const moduleSpecifier = declaration.getModuleSpecifierValue();
    if (!moduleSpecifier) continue;
    const reExportTarget = await resolveWorkspaceImportFromAbs(
      workspaceRoot,
      absPath,
      moduleSpecifier,
      aliases,
    );
    if (!reExportTarget) {
      if (!isWorkspaceReExportSpecifier(moduleSpecifier, aliases)) {
        complete = false;
      }
      continue;
    }
    const reExportedNames = await collectExportedNames(
      workspaceRoot,
      reExportTarget,
      cache,
      aliases,
      visiting,
    );
    if (!reExportedNames.complete) complete = false;
    for (const name of reExportedNames.names) {
      if (name !== 'default') exportedNames.add(name);
    }
  }

  const result = { names: exportedNames, complete };
  cache.set(key, result);
  visiting.delete(key);
  return result;
}

async function resolveWorkspaceImportFromAbs(
  workspaceRoot: string,
  fromAbsPath: string,
  specifier: string,
  aliases: WorkspaceAlias[],
): Promise<string | null> {
  const relPath = path.relative(workspaceRoot, fromAbsPath).replace(/\\/g, '/');
  const ref = workspaceImportReference(
    {
      specifier,
      index: 0,
      namedImports: [],
    },
    aliases,
  );
  if (!ref) return null;
  return resolveWorkspaceImport(workspaceRoot, relPath, ref);
}

function isWorkspaceReExportSpecifier(specifier: string, aliases: WorkspaceAlias[]): boolean {
  if (specifier.startsWith('.')) return true;
  return (
    workspaceImportReference(
      {
        specifier,
        index: 0,
        namedImports: [],
      },
      aliases,
    ) !== null
  );
}

async function loadWorkspaceAliases(workspaceRoot: string): Promise<WorkspaceAlias[]> {
  const aliases: WorkspaceAlias[] = [...FALLBACK_WORKSPACE_ALIASES];
  for (const configPath of TSCONFIG_CANDIDATES) {
    const loaded = await loadTsConfigAliases(workspaceRoot, configPath);
    aliases.push(...loaded);
  }
  aliases.push(...(await loadViteAliases(workspaceRoot)));
  return dedupeAliases(aliases);
}

async function loadTsConfigAliases(
  workspaceRoot: string,
  relPath: string,
  visited = new Set<string>(),
): Promise<WorkspaceAlias[]> {
  const absPath = resolveInside(workspaceRoot, relPath);
  const normalizedRelPath = normalizeWorkspacePath(relPath);
  if (visited.has(normalizedRelPath)) return [];
  visited.add(normalizedRelPath);

  const raw = await readFile(absPath, 'utf8').catch(() => null);
  if (!raw) return [];
  const parsed = parseJsonLike(raw) as {
    extends?: string;
    compilerOptions?: {
      baseUrl?: string;
      paths?: Record<string, string[]>;
    };
  } | null;
  if (!parsed) return [];

  const configDir = path.posix.dirname(normalizedRelPath);
  const aliases: WorkspaceAlias[] = [];
  const extendPath = resolveTsConfigExtends(configDir, parsed.extends);
  if (extendPath) {
    aliases.push(...(await loadTsConfigAliases(workspaceRoot, extendPath, visited)));
  }

  const baseUrl = normalizeConfigRelativePath(configDir, parsed.compilerOptions?.baseUrl ?? '.');
  const paths = parsed.compilerOptions?.paths ?? {};
  for (const [pattern, targets] of Object.entries(paths)) {
    if (pattern === '*') continue;
    const normalizedTargets = targets
      .map((target) => normalizeConfigRelativePath(baseUrl, target))
      .filter(Boolean);
    if (normalizedTargets.length === 0) continue;
    aliases.push({ pattern, targets: normalizedTargets, source: 'tsconfig' });
  }
  return aliases;
}

async function loadViteAliases(workspaceRoot: string): Promise<WorkspaceAlias[]> {
  const aliases: WorkspaceAlias[] = [];
  for (const configPath of VITE_CONFIG_CANDIDATES) {
    const raw = await readFile(resolveInside(workspaceRoot, configPath), 'utf8').catch(() => null);
    if (!raw) continue;
    aliases.push(...parseViteAliases(raw));
  }
  return aliases;
}

function parseViteAliases(source: string): WorkspaceAlias[] {
  const aliases: WorkspaceAlias[] = [];
  const objectBodies = matchBalancedBodies(source, /alias\s*:\s*\{/gu, '{', '}');
  for (const body of objectBodies) {
    const propertyPattern = /(?:^|[\n,])\s*['"`]([^'"`]+)['"`]\s*:\s*([^\n}]+)/gu;
    let match: RegExpExecArray | null;
    while ((match = propertyPattern.exec(body))) {
      const pattern = match[1]?.trim();
      const target = expressionToWorkspacePath(match[2] ?? '');
      if (!pattern || !target) continue;
      aliases.push({ pattern, targets: [target], source: 'vite' });
    }
  }

  const arrayBodies = matchBalancedBodies(source, /alias\s*:\s*\[/gu, '[', ']');
  for (const body of arrayBodies) {
    const itemPattern = /find\s*:\s*['"`]([^'"`]+)['"`]\s*,\s*replacement\s*:\s*([^\n}]+)/gu;
    let match: RegExpExecArray | null;
    while ((match = itemPattern.exec(body))) {
      const pattern = match[1]?.trim();
      const target = expressionToWorkspacePath(match[2] ?? '');
      if (!pattern || !target) continue;
      aliases.push({ pattern, targets: [target], source: 'vite' });
    }
  }

  return aliases;
}

function resolveSpecifierWithAlias(specifier: string, alias: WorkspaceAlias): string | null {
  const starIndex = alias.pattern.indexOf('*');
  if (starIndex >= 0) {
    const prefix = alias.pattern.slice(0, starIndex);
    const suffix = alias.pattern.slice(starIndex + 1);
    if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) return null;
    const matched = specifier.slice(prefix.length, specifier.length - suffix.length);
    const target = alias.targets[0];
    if (!target) return null;
    return normalizeWorkspacePath(target.replace('*', matched));
  }

  const target = alias.targets[0];
  if (!target) return null;
  if (specifier === alias.pattern) return normalizeWorkspacePath(target);
  if (specifier.startsWith(`${alias.pattern}/`)) {
    const suffix = specifier.slice(alias.pattern.length + 1);
    return normalizeWorkspacePath(path.posix.join(target, suffix));
  }
  return null;
}

function dedupeAliases(aliases: WorkspaceAlias[]): WorkspaceAlias[] {
  const seen = new Set<string>();
  const result: WorkspaceAlias[] = [];
  for (const alias of aliases) {
    const key = `${alias.pattern}\0${alias.targets.join('\0')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(alias);
  }
  return result.sort((a, b) => aliasSpecificity(b.pattern) - aliasSpecificity(a.pattern));
}

function aliasSpecificity(pattern: string): number {
  return pattern.replace('*', '').length;
}

function resolveTsConfigExtends(configDir: string, value: string | undefined): string | null {
  if (!value || value.startsWith('@') || /^[a-z][\w.-]*$/iu.test(value)) return null;
  const withExtension = path.posix.extname(value) ? value : `${value}.json`;
  return normalizeWorkspacePath(path.posix.join(configDir, withExtension));
}

function normalizeConfigRelativePath(configDir: string, value: string): string {
  const normalized = normalizeWorkspacePath(value);
  const withoutWildcard = normalized;
  if (path.posix.isAbsolute(withoutWildcard)) {
    return normalizeWorkspacePath(withoutWildcard.slice(1));
  }
  return normalizeWorkspacePath(path.posix.join(configDir, withoutWildcard));
}

function expressionToWorkspacePath(expression: string): string | null {
  const trimmed = expression.trim().replace(/,$/u, '');
  const direct = /^['"`]([^'"`]+)['"`]$/u.exec(trimmed)?.[1];
  if (direct) return normalizeAliasTargetPath(direct);

  const newUrl = /new\s+URL\(\s*['"`]([^'"`]+)['"`]\s*,\s*import\.meta\.url\s*\)/u.exec(
    trimmed,
  )?.[1];
  if (newUrl) return normalizeAliasTargetPath(newUrl);

  const dirnameCall = /(?:path\.)?(?:resolve|join)\(\s*__dirname\s*,([\s\S]+)\)$/u.exec(trimmed);
  if (dirnameCall) {
    const args = Array.from((dirnameCall[1] ?? '').matchAll(/['"`]([^'"`]+)['"`]/gu)).map(
      (match) => match[1] ?? '',
    );
    if (args.length > 0) return normalizeAliasTargetPath(path.posix.join(...args));
  }

  return null;
}

function matchBalancedBodies(
  source: string,
  startPattern: RegExp,
  openChar: '{' | '[',
  closeChar: '}' | ']',
): string[] {
  const bodies: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = startPattern.exec(source))) {
    const openIndex = startPattern.lastIndex - 1;
    const closeIndex = findBalancedClose(source, openIndex, openChar, closeChar);
    if (closeIndex < 0) continue;
    bodies.push(source.slice(openIndex + 1, closeIndex));
    startPattern.lastIndex = closeIndex + 1;
  }
  return bodies;
}

function findBalancedClose(
  source: string,
  openIndex: number,
  openChar: string,
  closeChar: string,
): number {
  let depth = 0;
  let quote: string | null = null;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function parseJsonLike(raw: string): unknown | null {
  try {
    return JSON.parse(stripTrailingCommas(stripJsonComments(raw)));
  } catch {
    return null;
  }
}

function stripJsonComments(raw: string): string {
  return raw.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
}

function stripTrailingCommas(raw: string): string {
  return raw.replace(/,\s*([}\]])/gu, '$1');
}

function normalizeAliasTargetPath(value: string): string {
  const normalized = normalizeWorkspacePath(value);
  return path.posix.isAbsolute(normalized)
    ? normalizeWorkspacePath(normalized.slice(1))
    : normalized;
}

function normalizeWorkspacePath(value: string): string {
  return value.replace(/\\/gu, '/').replace(/^\.\//u, '').replace(/\/+/gu, '/');
}

function parseSource(filePath: string, contents: string): SourceFile {
  const project = new Project({
    useInMemoryFileSystem: true,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    skipLoadingLibFiles: true,
  });
  return project.createSourceFile(filePath, contents, { overwrite: true });
}

function lineNumberAt(contents: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (contents.charCodeAt(i) === 10) line += 1;
  }
  return line;
}
