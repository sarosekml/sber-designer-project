import type { ComponentCatalog, ComponentEntry, ProjectScreen } from '@sber-designer/shared-types';

export interface ScreenImplementationReference {
  componentName: string;
  filePath: string;
}

export interface ScreenComponentUsage {
  component: ComponentEntry;
  imports: string[];
}

export type ScreenSourceTarget = 'implementation' | 'story';

export interface CodeModeFilePathInput {
  activeScreen: ProjectScreen | null;
  storySourceFilePath: string | null;
  selectedSourceLoc: string | null | undefined;
  selectedComponentLoc: string | null | undefined;
  workspacePath: string | null | undefined;
  derivedImplementationFilePath: string | null | undefined;
  screenSourceTarget: ScreenSourceTarget;
}

interface ParsedImport {
  modulePath: string | null;
  specifier: string;
  localName: string;
  importedName: string;
}

export function resolveScreenStoryFile(
  screen: ProjectScreen | null,
  components: readonly ComponentEntry[] | undefined,
): string | null {
  if (!screen) return null;
  if (screen.filePath) return screen.filePath;
  if (!screen.storyId || !components) return null;
  const component = components.find((entry) =>
    entry.stories.some((story) => story.id === screen.storyId),
  );
  return component?.filePath ?? null;
}

export function isStoryFile(path: string): boolean {
  return /\.(stories|story)\.[tj]sx?$/.test(path);
}

export function resolveCodeModeFilePath(input: CodeModeFilePathInput): string | null {
  const selectedSourceLoc = input.selectedSourceLoc?.startsWith('dom://')
    ? input.selectedComponentLoc
    : input.selectedSourceLoc;
  const selectedFilePath = resolveWorkspaceSourceFilePath(selectedSourceLoc, input.workspacePath);
  const implementationFilePath =
    input.activeScreen?.implementationFilePath ?? input.derivedImplementationFilePath ?? null;
  const screenTargetFilePath =
    input.screenSourceTarget === 'story'
      ? input.storySourceFilePath
      : (implementationFilePath ?? input.storySourceFilePath);

  if (input.screenSourceTarget === 'story') return input.storySourceFilePath;
  return selectedFilePath ?? screenTargetFilePath;
}

export function resolveWorkspaceSourceFilePath(
  sourceLoc: string | null | undefined,
  workspacePath: string | null | undefined,
): string | null {
  return toWorkspaceRelativeFile(parseFile(sourceLoc), workspacePath);
}

export function findStoryImplementationReference(
  storyFilePath: string,
  storySource: string,
  storyId?: string,
): ScreenImplementationReference | null {
  const componentName = findStoryComponentName(storySource, storyId);
  if (!componentName) return null;
  const filePath = resolveImportedComponentFile(storyFilePath, storySource, componentName);
  return filePath ? { componentName, filePath } : null;
}

export function resolveImportedComponentFile(
  fromFile: string,
  source: string,
  componentName: string,
): string | null {
  if (!/^[A-Za-z_$][\w$]*$/.test(componentName)) return null;
  const imports = parseImports(source, fromFile);
  const match = imports.find((entry) => entry.localName === componentName);
  return match?.modulePath ?? null;
}

export function collectScreenComponentUsage({
  source,
  sourceFilePath,
  catalog,
  catalogSources,
}: {
  source: string;
  sourceFilePath: string;
  catalog: ComponentCatalog | null;
  catalogSources: ReadonlyMap<string, string>;
}): ScreenComponentUsage[] {
  if (!catalog) return [];
  const screenImports = parseImports(source, sourceFilePath);
  const screenSignatures = importSignatures(screenImports);
  const screenJsxNames = extractJsxNames(source);
  const out: ScreenComponentUsage[] = [];

  for (const component of catalog.components) {
    if (!isDesignSystemComponent(component)) continue;
    const componentSource = catalogSources.get(component.filePath);
    const componentImports = componentSource
      ? parseImports(componentSource, component.filePath)
      : [];
    const matched = new Set<string>();

    for (const candidate of componentImports) {
      for (const key of signatureKeys(candidate)) {
        if (screenSignatures.has(key)) {
          matched.add(
            candidate.importedName === 'default' ? candidate.localName : candidate.importedName,
          );
        }
      }
      if (
        candidate.modulePath &&
        screenImports.some(
          (screenImport) =>
            screenImport.modulePath === candidate.modulePath &&
            (screenImport.importedName === candidate.importedName ||
              screenImport.localName === candidate.localName ||
              screenImport.localName === candidate.importedName),
        )
      ) {
        matched.add(
          candidate.importedName === 'default' ? candidate.localName : candidate.importedName,
        );
      }
    }

    if (
      matched.size === 0 &&
      screenImports.some(
        (entry) =>
          stripImportExtension(entry.modulePath ?? '') === stripImportExtension(component.filePath),
      )
    ) {
      matched.add(component.shortName);
    }

    if (matched.size === 0 && screenJsxNames.has(component.shortName)) {
      matched.add(component.shortName);
    }

    if (matched.size > 0) {
      out.push({ component, imports: Array.from(matched).sort() });
    }
  }

  return out.sort((a, b) => a.component.shortName.localeCompare(b.component.shortName));
}

function findStoryComponentName(source: string, storyId?: string): string | null {
  const exportName = storyId ? storyExportNameFromId(storyId) : null;
  if (exportName) {
    const exportRe = new RegExp(`export\\s+const\\s+${escapeRegExp(exportName)}\\b`);
    const exportStart = source.search(exportRe);
    if (exportStart >= 0) {
      const block = source.slice(
        exportStart,
        nextExportStart(source, exportStart + exportName.length),
      );
      const renderMatch = /render:\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*<([A-Z][\w$]*)\b/.exec(
        block,
      );
      if (renderMatch?.[1]) return renderMatch[1];
      const storyComponentMatch = /component:\s*([A-Z][\w$]*)\b/.exec(block);
      if (storyComponentMatch?.[1]) return storyComponentMatch[1];
    }
  }
  const metaComponentMatch = /component:\s*([A-Z][\w$]*)\b/.exec(source);
  if (metaComponentMatch?.[1]) return metaComponentMatch[1];
  const renderMatch = /render:\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*<([A-Z][\w$]*)\b/.exec(
    source,
  );
  return renderMatch?.[1] ?? null;
}

function parseImports(source: string, fromFile: string): ParsedImport[] {
  const imports: ParsedImport[] = [];
  const re = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const clause = match[1]?.trim();
    const specifier = match[2];
    if (!clause || !specifier) continue;
    const modulePath = resolveRelativeModule(fromFile, specifier);
    const defaultMatch = /^([A-Za-z_$][\w$]*)\s*(?:,|$)/.exec(clause);
    if (defaultMatch?.[1] && !clause.startsWith('{') && !clause.startsWith('*')) {
      imports.push({ modulePath, specifier, localName: defaultMatch[1], importedName: 'default' });
    }
    const namedMatch = /\{([\s\S]*?)\}/.exec(clause);
    if (namedMatch?.[1]) {
      for (const rawPart of namedMatch[1].split(',')) {
        const part = rawPart.trim();
        if (!part) continue;
        const aliasMatch = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(part);
        if (aliasMatch?.[1] && aliasMatch[2]) {
          imports.push({
            modulePath,
            specifier,
            importedName: aliasMatch[1],
            localName: aliasMatch[2],
          });
        } else if (/^[A-Za-z_$][\w$]*$/.test(part)) {
          imports.push({ modulePath, specifier, importedName: part, localName: part });
        }
      }
    }
  }
  return imports;
}

function importSignatures(imports: ParsedImport[]): Set<string> {
  const out = new Set<string>();
  for (const entry of imports) {
    for (const key of signatureKeys(entry)) out.add(key);
  }
  return out;
}

function signatureKeys(entry: ParsedImport): string[] {
  if (!entry.modulePath) return [];
  const modulePath = stripImportExtension(entry.modulePath);
  return [`${modulePath}::${entry.importedName}`, `${modulePath}::${entry.localName}`];
}

function extractJsxNames(source: string): Set<string> {
  const out = new Set<string>();
  const re = /<([A-Z][A-Za-z0-9_$.]*)\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const name = match[1]?.split('.').at(0);
    if (name) out.add(name);
  }
  return out;
}

function isDesignSystemComponent(component: ComponentEntry): boolean {
  const root = component.title.split('/')[0]?.toLowerCase();
  return root !== 'screens' && root !== 'templates';
}

function nextExportStart(source: string, fromIndex: number): number {
  const next = source.slice(fromIndex).search(/\nexport\s+const\s+/);
  return next >= 0 ? fromIndex + next : source.length;
}

function storyExportNameFromId(storyId: string): string {
  const tail = storyId.includes('--') ? storyId.split('--').at(-1)! : storyId;
  return tail
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function resolveRelativeModule(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const parts = fromFile.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  const normalized = parts.join('/');
  if (/\.(css|json|mdx?|html|[cm]?[jt]sx?)$/.test(normalized)) return normalized;
  return `${normalized}.tsx`;
}

function stripImportExtension(filePath: string): string {
  return filePath.replace(/\.(tsx|ts|jsx|js|mjs|cjs|css|json|mdx?)$/, '');
}

function parseFile(loc: string | null | undefined): string | null {
  if (!loc) return null;
  if (loc.startsWith('dom://')) return null;
  const m = /^(.+):(\d+):(\d+)$/.exec(loc);
  return m ? m[1]! : loc;
}

function toWorkspaceRelativeFile(
  path: string | null,
  workspacePath: string | null | undefined,
): string | null {
  if (!path) return null;
  const normalized = decodeFilePath(path.replace(/^file:\/\//, ''))
    .split('\\')
    .join('/');
  const workspace = workspacePath?.split('\\').join('/').replace(/\/+$/, '');
  if (workspace && normalized.startsWith(`${workspace}/`)) {
    return sourceFileOrNull(normalized.slice(workspace.length + 1));
  }
  if (normalized.startsWith('/')) return null;
  return sourceFileOrNull(normalized);
}

function sourceFileOrNull(path: string): string | null {
  if (path.startsWith('dom://')) return null;
  if (path.includes('://')) return null;
  if (path.includes('\0')) return null;
  if (!/\.(tsx|ts|jsx|js|css|json|md|mdx|html)$/.test(path)) return null;
  return path.replace(/^\/+/, '');
}

function decodeFilePath(path: string): string {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
