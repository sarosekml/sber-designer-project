import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath, stat } from 'node:fs/promises';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import type { ProjectIconSource } from '@sber-designer/shared-types';

import {
  type AssetKind,
  type AssetRecord,
  type DesignIndexDiagnostic,
  type ExternalIconRecord,
  type IconIndexFile,
  type IconSourceManifestEntry,
  type IconSourceManifestFile,
} from './types';

const ASSET_RE = /\.(svg|png|jpe?g|webp|avif)$/i;
const COMPONENT_RE = /\.(tsx|jsx)$/i;
const MAX_SOURCE_FILES = 1_000;

export interface IconSourceScanResult {
  sourceManifest: IconSourceManifestFile;
  externalIcons: ExternalIconRecord[];
  workspaceAssets: AssetRecord[];
  workspaceProjectIcons: IconIndexFile['projectIcons'];
  diagnostics: DesignIndexDiagnostic[];
}

interface CollectedFile {
  absolutePath: string;
  relPath: string;
  size: number;
}

export async function scanConfiguredIconSources(
  workspaceRoot: string,
  sources: ProjectIconSource[] | null | undefined,
  generatedAt = Date.now(),
): Promise<IconSourceScanResult> {
  const workspaceCanonical = await realpath(workspaceRoot).catch(() => resolve(workspaceRoot));
  const diagnostics: DesignIndexDiagnostic[] = [];
  const sourceManifest: IconSourceManifestEntry[] = [];
  const externalIcons: ExternalIconRecord[] = [];
  const workspaceAssets: AssetRecord[] = [];
  const workspaceProjectIcons: IconIndexFile['projectIcons'] = [];

  for (const source of normalizeSources(sources)) {
    const resolved = await resolveSourceRoot(workspaceCanonical, source);
    if (!resolved) {
      sourceManifest.push(sourceManifestEntry(source, 'missing', 0));
      diagnostics.push({
        level: 'warning',
        filePath: '.sber-designer/project.sdproj',
        message: `Icon source "${source.name}" has no localPath or workspacePath.`,
      });
      continue;
    }
    if (!(await exists(resolved.canonicalRoot))) {
      sourceManifest.push(sourceManifestEntry(source, 'missing', 0, resolved));
      diagnostics.push({
        level: 'warning',
        filePath: source.workspacePath ?? '.sber-designer/project.sdproj',
        message: `Icon source "${source.name}" does not exist on this machine.`,
      });
      continue;
    }

    const mode =
      source.mode === 'workspace' || source.mode === 'external'
        ? source.mode
        : isInside(workspaceCanonical, resolved.canonicalRoot)
          ? 'workspace'
          : 'external';
    const files = await collectSourceFiles(resolved.canonicalRoot);
    sourceManifest.push(sourceManifestEntry(source, 'ready', files.length, { ...resolved, mode }));

    if (mode === 'workspace') {
      for (const file of files) {
        const workspaceRel = normalize(relative(workspaceCanonical, file.absolutePath));
        if (!workspaceRel || workspaceRel.startsWith('..')) continue;
        if (ASSET_RE.test(file.absolutePath)) {
          const kind = inferKind(file.relPath, source.families);
          workspaceAssets.push(workspaceAssetRecord(workspaceRel, kind));
        } else if (COMPONENT_RE.test(file.absolutePath)) {
          workspaceProjectIcons.push(workspaceProjectIconRecord(workspaceRel));
        }
      }
      continue;
    }

    for (const file of files) {
      if (!ASSET_RE.test(file.absolutePath)) continue;
      externalIcons.push(await externalIconRecord(source, file));
    }
  }

  return {
    sourceManifest: {
      version: 1,
      generatedAt,
      sources: dedupeById(sourceManifest),
    },
    externalIcons: dedupeById(externalIcons).sort((a, b) => a.id.localeCompare(b.id)),
    workspaceAssets: dedupeById(workspaceAssets).sort((a, b) =>
      a.filePath.localeCompare(b.filePath),
    ),
    workspaceProjectIcons: dedupeById(workspaceProjectIcons).sort((a, b) =>
      a.filePath.localeCompare(b.filePath),
    ),
    diagnostics,
  };
}

async function resolveSourceRoot(
  workspaceCanonical: string,
  source: ProjectIconSource,
): Promise<{
  canonicalRoot: string;
  workspacePath?: string;
  mode?: 'workspace' | 'external';
} | null> {
  const root = source.workspacePath
    ? resolve(workspaceCanonical, source.workspacePath)
    : source.localPath
      ? resolve(source.localPath)
      : null;
  if (!root) return null;
  const canonicalRoot = await realpath(root).catch(() => root);
  const workspacePath = isInside(workspaceCanonical, canonicalRoot)
    ? normalize(relative(workspaceCanonical, canonicalRoot))
    : source.workspacePath;
  return {
    canonicalRoot,
    ...(workspacePath && !workspacePath.startsWith('..') ? { workspacePath } : {}),
  };
}

async function collectSourceFiles(sourceRoot: string): Promise<CollectedFile[]> {
  const out: CollectedFile[] = [];
  await walk(sourceRoot, sourceRoot, out);
  return out.sort((a, b) => a.relPath.localeCompare(b.relPath)).slice(0, MAX_SOURCE_FILES);
}

async function walk(root: string, dir: string, out: CollectedFile[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const abs = join(dir, entry.name);
    const link = await lstat(abs).catch(() => null);
    if (!link || link.isSymbolicLink()) continue;
    const canonical = await realpath(abs).catch(() => abs);
    if (!isInside(root, canonical)) continue;
    if (entry.isDirectory()) {
      await walk(root, abs, out);
      if (out.length >= MAX_SOURCE_FILES) return;
      continue;
    }
    if (!entry.isFile() || (!ASSET_RE.test(entry.name) && !COMPONENT_RE.test(entry.name))) continue;
    const entryStat = await stat(canonical).catch(() => null);
    out.push({
      absolutePath: canonical,
      relPath: normalize(relative(root, canonical)),
      size: entryStat?.size ?? 0,
    });
    if (out.length >= MAX_SOURCE_FILES) return;
  }
}

function sourceManifestEntry(
  source: ProjectIconSource,
  status: IconSourceManifestEntry['status'],
  count: number,
  resolved?: { canonicalRoot: string; workspacePath?: string; mode?: 'workspace' | 'external' },
): IconSourceManifestEntry {
  const mode =
    resolved?.mode ??
    source.mode ??
    (source.workspacePath || source.localPath?.split(sep).includes('.sber-designer')
      ? 'workspace'
      : 'external');
  return {
    id: source.id,
    name: source.name,
    kind: source.kind,
    mode,
    families: normalizeFamilies(source.families),
    ...(resolved?.workspacePath ? { workspacePath: resolved.workspacePath } : {}),
    ...(mode === 'external' && resolved?.canonicalRoot
      ? { sourceLabel: basename(resolved.canonicalRoot) }
      : {}),
    status,
    count,
    ...(source.updatedAt ? { updatedAt: source.updatedAt } : {}),
  };
}

function workspaceAssetRecord(filePath: string, kind: AssetKind): AssetRecord {
  const base = stripExtension(filePath.split('/').at(-1) ?? 'asset');
  const importName = `${camel(base)}Url`;
  return {
    id: `asset-${kind}-${slug(filePath)}`,
    kind,
    name: humanize(base),
    filePath,
    usageMode: filePath.startsWith('public/') ? 'public-url' : 'asset-url',
    ...(filePath.startsWith('src/sber-designer-assets/')
      ? { importName, importSource: '@/sber-designer-assets' }
      : filePath.startsWith('src/assets/')
        ? { importName, importSource: '@/assets' }
        : { importName }),
    storybookTitle:
      kind === 'icon'
        ? 'Assets/Icons'
        : kind === 'illustration'
          ? 'Assets/Illustrations'
          : 'Assets/Images',
    storybookStory: pascal(base),
    tags: Array.from(new Set([...words(base), ...words(filePath)])),
  };
}

function workspaceProjectIconRecord(filePath: string): IconIndexFile['projectIcons'][number] {
  const base = stripExtension(filePath.split('/').at(-1) ?? 'Icon');
  const name = pascal(base) || 'Icon';
  return {
    id: `configured-${slug(filePath)}`,
    name,
    importName: name,
    filePath,
  };
}

async function externalIconRecord(
  source: ProjectIconSource,
  file: CollectedFile,
): Promise<ExternalIconRecord> {
  const base = stripExtension(file.relPath.split('/').at(-1) ?? 'icon');
  const contents = await readFile(file.absolutePath).catch(() => Buffer.from(''));
  return {
    id: `external-icon-${slug(source.id)}-${slug(file.relPath)}`,
    name: humanize(base),
    source: 'external-icon-reference',
    sourceId: source.id,
    sourceName: source.name,
    sourceRelPath: file.relPath,
    extension: extname(file.relPath).replace(/^\./, '').toLowerCase(),
    bytes: file.size,
    hash: `sha256:${createHash('sha256').update(contents).digest('hex')}`,
    tags: Array.from(new Set([...words(base), ...words(file.relPath), ...words(source.name)])),
  };
}

function inferKind(
  relPath: string,
  families: ProjectIconSource['families'] | undefined,
): AssetKind {
  const normalized = relPath.toLowerCase();
  const normalizedFamilies = normalizeFamilies(families);
  if (normalizedFamilies.length === 1 && normalizedFamilies[0] === 'illustrations') {
    return 'illustration';
  }
  if (/(^|\/)(illustrations?|images?)\//.test(normalized)) return 'illustration';
  if (/(^|\/)icons?\//.test(normalized)) return 'icon';
  return normalizedFamilies.includes('icons') ? 'icon' : 'image';
}

function normalizeSources(sources: ProjectIconSource[] | null | undefined): ProjectIconSource[] {
  return (sources ?? []).filter(
    (source) => source.id && source.name && source.kind === 'local-folder',
  );
}

function normalizeFamilies(
  families: ProjectIconSource['families'] | undefined,
): ('icons' | 'illustrations')[] {
  const clean = (families ?? ['icons']).filter(
    (family): family is 'icons' | 'illustrations' =>
      family === 'icons' || family === 'illustrations',
  );
  return clean.length > 0 ? Array.from(new Set(clean)) : ['icons'];
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of items) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith('/') && !rel.match(/^[A-Za-z]:/));
}

function stripExtension(value: string): string {
  return value.replace(/\.(tsx|jsx|svg|png|jpe?g|webp|avif)$/i, '');
}

function humanize(value: string): string {
  const [first, ...rest] = words(value);
  if (!first) return 'Icon';
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}

function pascal(value: string): string {
  return words(value)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function camel(value: string): string {
  const parts = words(value);
  return parts
    .map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join('');
}

function slug(value: string): string {
  return words(value).join('-') || 'icon';
}

function words(value: string): string[] {
  return value
    .replace(/\.(tsx|jsx|svg|png|jpe?g|webp|avif)$/i, '')
    .split(/[^A-Za-z0-9]+/)
    .flatMap((part) => part.split(/(?=[A-Z])/))
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function normalize(path: string): string {
  return path.split('\\').join('/');
}
