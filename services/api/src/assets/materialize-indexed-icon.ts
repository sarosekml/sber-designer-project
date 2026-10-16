import { copyFile, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { resolveInside } from '@sber-designer/ast-bridge';
import type {
  AssetRecord,
  ExternalIconRecord,
  IconCandidateRecord,
} from '@sber-designer/design-indexer';
import {
  DESIGN_INDEX_PATHS,
  MATERIALIZED_ASSETS_MANIFEST_PATH,
} from '@sber-designer/design-indexer';
import type { ProjectIconSource } from '@sber-designer/shared-types';

import { ProjectSchema } from '../project-store';

export interface MaterializeIndexedIconInput {
  workspaceRoot: string;
  iconId: string;
}

export interface MaterializeIndexedIconResult {
  asset: AssetRecord;
  changedFiles: string[];
}

interface MaterializedAssetsManifest {
  version: 1;
  assets: {
    externalIconId: string;
    sourceId: string;
    sourceRelPath: string;
    targetFilePath: string;
    importName: string;
    materializedAt: number;
  }[];
}

const SUPPORTED_ICON_RE = /\.(svg|png|jpe?g|webp|avif)$/i;

export async function materializeIndexedIcon(
  input: MaterializeIndexedIconInput,
): Promise<MaterializeIndexedIconResult> {
  const workspaceRoot = resolve(input.workspaceRoot);
  const externalIcon = await resolveExternalIcon(workspaceRoot, input.iconId);
  const source = await resolveProjectIconSource(workspaceRoot, externalIcon.sourceId);
  if (!source.localPath) {
    throw new Error(`Icon source "${source.name}" has no local path on this machine.`);
  }

  const sourceRoot = await realpath(resolve(source.localPath));
  const sourceFile = await realpath(resolve(sourceRoot, externalIcon.sourceRelPath));
  if (!isInside(sourceRoot, sourceFile)) {
    throw new Error(`External icon path escapes source "${source.name}".`);
  }
  if (!SUPPORTED_ICON_RE.test(sourceFile)) {
    throw new Error(`External icon has unsupported file type: ${externalIcon.sourceRelPath}`);
  }

  const ext = extname(sourceFile).toLowerCase();
  const targetFilePath = `src/sber-designer-assets/icons/${slug(stripExtension(externalIcon.sourceRelPath.split('/').at(-1) ?? externalIcon.name))}${ext}`;
  const targetAbs = resolveInside(workspaceRoot, targetFilePath);
  await mkdir(dirname(targetAbs), { recursive: true });
  await copyFile(sourceFile, targetAbs);

  const importName = `${camel(stripExtension(targetFilePath.split('/').at(-1) ?? 'icon'))}Url`;
  const changedFiles = new Set<string>([targetFilePath]);
  for (const filePath of await writeSberDesignerAssetsBarrel(workspaceRoot)) {
    changedFiles.add(filePath);
  }
  changedFiles.add(
    await writeMaterializedManifest(workspaceRoot, {
      externalIconId: externalIcon.id,
      sourceId: externalIcon.sourceId,
      sourceRelPath: externalIcon.sourceRelPath,
      targetFilePath,
      importName,
      materializedAt: Date.now(),
    }),
  );

  const changed = Array.from(changedFiles).sort();
  return {
    asset: {
      id: `asset-icon-${slug(stripExtension(targetFilePath.split('/').at(-1) ?? 'icon'))}`,
      kind: 'icon',
      name: externalIcon.name,
      filePath: targetFilePath,
      usageMode: 'asset-url',
      importName,
      importSource: '@/sber-designer-assets',
      storybookTitle: 'Assets/Icons',
      storybookStory: pascal(stripExtension(targetFilePath.split('/').at(-1) ?? 'icon')),
      tags: externalIcon.tags,
    },
    changedFiles: changed,
  };
}

async function resolveExternalIcon(
  workspaceRoot: string,
  iconId: string,
): Promise<ExternalIconRecord> {
  const externalIcons = await readJsonl<ExternalIconRecord>(
    resolveInside(workspaceRoot, DESIGN_INDEX_PATHS.externalIcons),
  );
  const direct = externalIcons.find(
    (icon) => icon.id === iconId || normalizeSearch(icon.name) === normalizeSearch(iconId),
  );
  if (direct) return direct;

  const candidates = await readJsonl<IconCandidateRecord>(
    resolveInside(workspaceRoot, DESIGN_INDEX_PATHS.iconCandidates),
  );
  const candidate = candidates.find(
    (icon) =>
      icon.id === iconId ||
      icon.externalIconId === iconId ||
      normalizeSearch(icon.name) === normalizeSearch(iconId),
  );
  const externalIcon = candidate?.externalIconId
    ? externalIcons.find((icon) => icon.id === candidate.externalIconId)
    : null;
  if (externalIcon) return externalIcon;
  throw new Error(`External indexed icon not found: ${iconId}`);
}

async function resolveProjectIconSource(
  workspaceRoot: string,
  sourceId: string,
): Promise<ProjectIconSource> {
  const parsed = ProjectSchema.safeParse(
    JSON.parse(
      await readFile(resolveInside(workspaceRoot, '.sber-designer/project.sdproj'), 'utf8'),
    ),
  );
  if (!parsed.success) throw new Error('Project file is missing or invalid.');
  const source = parsed.data.externalAssetSources?.icons?.find((item) => item.id === sourceId);
  if (!source) throw new Error(`Icon source not found in project settings: ${sourceId}`);
  return source;
}

async function writeSberDesignerAssetsBarrel(workspaceRoot: string): Promise<string[]> {
  const files = await collectWorkspaceAssetFiles(workspaceRoot, 'src/sber-designer-assets');
  if (files.length === 0) return [];
  const byExport = new Map<string, string>();
  for (const filePath of files) {
    const base = stripExtension(filePath.split('/').at(-1) ?? 'asset');
    const exportName = `${camel(base)}Url`;
    if (!byExport.has(exportName)) byExport.set(exportName, filePath);
  }
  const lines = Array.from(byExport.entries()).map(
    ([exportName, filePath]) =>
      `export { default as ${exportName} } from './${filePath.replace(/^src\/sber-designer-assets\//, '')}';`,
  );
  await writeWorkspaceText(
    workspaceRoot,
    'src/sber-designer-assets/index.ts',
    `${lines.join('\n')}\n`,
  );
  return ['src/sber-designer-assets/index.ts'];
}

async function collectWorkspaceAssetFiles(
  workspaceRoot: string,
  relRoot: string,
): Promise<string[]> {
  const root = resolveInside(workspaceRoot, relRoot);
  const out: string[] = [];
  await walkWorkspaceAssets(workspaceRoot, root, out);
  return out.sort();
}

async function walkWorkspaceAssets(
  workspaceRoot: string,
  dir: string,
  out: string[],
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkWorkspaceAssets(workspaceRoot, abs, out);
      continue;
    }
    if (!entry.isFile() || !SUPPORTED_ICON_RE.test(entry.name)) continue;
    out.push(normalize(relative(workspaceRoot, abs)));
  }
}

async function writeMaterializedManifest(
  workspaceRoot: string,
  record: MaterializedAssetsManifest['assets'][number],
): Promise<string> {
  const manifestPath = resolveInside(workspaceRoot, MATERIALIZED_ASSETS_MANIFEST_PATH);
  const existing = await readMaterializedManifest(manifestPath);
  const assets = [
    ...existing.assets.filter(
      (asset) =>
        asset.externalIconId !== record.externalIconId &&
        asset.targetFilePath !== record.targetFilePath,
    ),
    record,
  ].sort((a, b) => a.targetFilePath.localeCompare(b.targetFilePath));
  await writeWorkspaceText(
    workspaceRoot,
    MATERIALIZED_ASSETS_MANIFEST_PATH,
    `${JSON.stringify({ version: 1, assets }, null, 2)}\n`,
  );
  return MATERIALIZED_ASSETS_MANIFEST_PATH;
}

async function readMaterializedManifest(path: string): Promise<MaterializedAssetsManifest> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as MaterializedAssetsManifest;
  } catch {
    return { version: 1, assets: [] };
  }
}

async function readJsonl<T>(path: string): Promise<T[]> {
  try {
    return (await readFile(path, 'utf8'))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as T];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

async function writeWorkspaceText(
  workspaceRoot: string,
  relPath: string,
  contents: string,
): Promise<void> {
  const abs = resolveInside(workspaceRoot, relPath);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, contents, 'utf8');
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith('/') && !rel.match(/^[A-Za-z]:/));
}

function normalizeSearch(value: string): string {
  return words(value).join(' ');
}

function stripExtension(value: string): string {
  return value.replace(/\.(svg|png|jpe?g|webp|avif)$/i, '');
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
    .replace(/\.(svg|png|jpe?g|webp|avif)$/i, '')
    .split(/[^A-Za-z0-9]+/)
    .flatMap((part) => part.split(/(?=[A-Z])/))
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function normalize(path: string): string {
  return path.split('\\').join('/');
}
