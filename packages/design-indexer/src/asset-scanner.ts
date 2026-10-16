import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import type { AssetKind, AssetRecord } from './types';

const ASSET_ROOTS: { root: string; kind: AssetKind }[] = [
  { root: 'src/sber-designer-assets/icons', kind: 'icon' },
  { root: 'src/sber-designer-assets/illustrations', kind: 'illustration' },
  { root: 'src/assets/icons', kind: 'icon' },
  { root: 'src/assets/illustrations', kind: 'illustration' },
  { root: 'public/assets/icons', kind: 'icon' },
  { root: 'public/assets/illustrations', kind: 'illustration' },
  { root: 'public/assets', kind: 'image' },
];

const ASSET_RE = /\.(svg|png|jpe?g|webp|avif)$/i;
const MAX_ASSETS = 1_000;

interface ImportedPacksFile {
  packs?: {
    id?: string;
    assetCount?: number;
    assets?: { filePath?: string }[];
  }[];
}

export async function scanProjectAssets(workspaceRoot: string): Promise<AssetRecord[]> {
  const files = new Map<string, AssetKind>();
  for (const source of ASSET_ROOTS) {
    await collectFiles(workspaceRoot, source.root, source.kind, files);
    if (files.size >= MAX_ASSETS) break;
  }
  const packIds = await readPackIdsByFile(workspaceRoot);
  return Array.from(files.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, MAX_ASSETS)
    .map(([filePath, rootKind]) =>
      assetRecord(
        filePath,
        inferKind(filePath, rootKind),
        packIds.get(filePath) ?? packIds.get('*'),
      ),
    );
}

async function collectFiles(
  workspaceRoot: string,
  relPath: string,
  kind: AssetKind,
  files: Map<string, AssetKind>,
): Promise<void> {
  const abs = resolve(workspaceRoot, relPath);
  let entry;
  try {
    entry = await stat(abs);
  } catch {
    return;
  }
  if (entry.isFile()) {
    if (ASSET_RE.test(abs)) {
      const filePath = normalize(relative(workspaceRoot, abs));
      if (!files.has(filePath)) files.set(filePath, kind);
    }
    return;
  }
  if (!entry.isDirectory()) return;
  const entries = await readdir(abs, { withFileTypes: true });
  for (const child of entries) {
    if (child.name.startsWith('.')) continue;
    const childAbs = join(abs, child.name);
    if (child.isDirectory()) {
      await collectFiles(workspaceRoot, normalize(relative(workspaceRoot, childAbs)), kind, files);
    } else if (child.isFile() && ASSET_RE.test(child.name)) {
      const filePath = normalize(relative(workspaceRoot, childAbs));
      if (!files.has(filePath)) files.set(filePath, kind);
    }
    if (files.size >= MAX_ASSETS) return;
  }
}

function assetRecord(filePath: string, kind: AssetKind, packId: string | undefined): AssetRecord {
  const base = stripExtension(filePath.split('/').at(-1) ?? 'asset');
  const name = humanize(base);
  const importName = `${camel(base)}Url`;
  return {
    id: `asset-${kind}-${slug(base)}`,
    kind,
    name,
    filePath,
    usageMode: filePath.startsWith('public/') ? 'public-url' : 'asset-url',
    ...(filePath.startsWith('src/sber-designer-assets/')
      ? { importName, importSource: '@/sber-designer-assets' }
      : filePath.startsWith('src/assets/')
        ? { importName, importSource: '@/assets' }
        : {}),
    storybookTitle:
      kind === 'icon'
        ? 'Assets/Icons'
        : kind === 'illustration'
          ? 'Assets/Illustrations'
          : 'Assets/Images',
    storybookStory: pascal(base),
    tags: Array.from(new Set([...words(base), ...words(filePath)])),
    ...(packId ? { packId } : {}),
  };
}

function inferKind(filePath: string, rootKind: AssetKind): AssetKind {
  if (rootKind !== 'image') return rootKind;
  const normalized = filePath.toLowerCase();
  if (/(^|\/)icons?\//.test(normalized)) return 'icon';
  if (/(^|\/)(illustrations?|images?)\//.test(normalized)) return 'illustration';
  return 'image';
}

async function readPackIdsByFile(workspaceRoot: string): Promise<Map<string, string>> {
  try {
    const parsed = JSON.parse(
      await readFile(resolve(workspaceRoot, '.sber-designer/assets/imported-packs.json'), 'utf8'),
    ) as ImportedPacksFile;
    const packs = parsed.packs?.filter((pack) => typeof pack.id === 'string' && pack.id) ?? [];
    const byFile = new Map<string, string>();
    for (const pack of packs) {
      for (const asset of pack.assets ?? []) {
        if (typeof asset.filePath === 'string' && pack.id) {
          byFile.set(normalize(asset.filePath), pack.id);
        }
      }
    }
    if (byFile.size === 0 && packs.length === 1 && packs[0]?.id) {
      return new Map([['*', packs[0].id]]);
    }
    return byFile;
  } catch {
    return new Map();
  }
}

function stripExtension(value: string): string {
  return value.replace(/\.(svg|png|jpe?g|webp|avif)$/i, '');
}

function humanize(value: string): string {
  const [first, ...rest] = words(value);
  if (!first) return 'Asset';
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
  return words(value).join('-') || 'asset';
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
