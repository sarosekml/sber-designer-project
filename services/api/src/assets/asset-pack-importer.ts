import { createHash, randomUUID } from 'node:crypto';
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  realpath,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';

export type AssetPackKind = 'icons' | 'illustrations';

export interface ImportAssetPackInput {
  workspaceRoot: string;
  sourcePath: string;
  packName: string;
  kinds: AssetPackKind[];
  overwrite?: boolean;
}

export interface ImportAssetPackResult {
  changedFiles: string[];
  imported: number;
  skipped: { filePath: string; reason: string }[];
  diagnostics: { level: 'info' | 'warning' | 'error'; message: string }[];
}

interface ImportedAsset {
  name: string;
  variableName: string;
  sourceFilePath: string;
  targetFilePath: string;
  kind: AssetPackKind;
}

const ASSET_RE = /\.(svg|png|jpe?g|webp|avif)$/i;
const MAX_ASSET_BYTES = 8 * 1024 * 1024;
const MAX_ASSET_FILES = 500;
export const ASSET_PACK_OUTSIDE_WORKSPACE_ERROR =
  'Asset source folder is outside the connected project. Copy it into the project yourself and select the copied folder before importing. If you leave it outside the project, other users will not be able to use it.';

export async function importAssetPack(input: ImportAssetPackInput): Promise<ImportAssetPackResult> {
  const workspaceRoot = resolve(input.workspaceRoot);
  const sourceRoot = await resolveAllowedSource(input.sourcePath);
  const workspaceCanonicalRoot = await realpath(workspaceRoot).catch(() => workspaceRoot);
  if (!isInside(workspaceCanonicalRoot, sourceRoot)) {
    throw new Error(ASSET_PACK_OUTSIDE_WORKSPACE_ERROR);
  }
  const kinds = new Set(input.kinds);
  if (kinds.size === 0) throw new Error('At least one asset kind must be selected.');

  const sourceFiles = await collectSourceFiles(sourceRoot);
  const imported: ImportedAsset[] = [];
  const skipped: ImportAssetPackResult['skipped'] = [];
  const changedFiles = new Set<string>();
  const hash = createHash('sha256');

  for (const sourceFile of sourceFiles) {
    const sourceRel = normalize(relative(sourceRoot, sourceFile));
    const ext = extension(sourceFile);
    if (!ASSET_RE.test(sourceFile)) {
      skipped.push({ filePath: sourceRel, reason: 'unsupported_extension' });
      continue;
    }
    const entry = await stat(sourceFile);
    if (entry.size > MAX_ASSET_BYTES) {
      skipped.push({ filePath: sourceRel, reason: 'file_too_large' });
      continue;
    }
    const kind = classifyAsset(sourceRel, ext, kinds);
    if (!kind) {
      skipped.push({ filePath: sourceRel, reason: 'kind_not_selected' });
      continue;
    }
    const targetFilePath = targetPathFor(sourceRel, kind);
    const targetAbs = resolveInside(workspaceRoot, targetFilePath);
    if (!input.overwrite && (await exists(targetAbs))) {
      skipped.push({ filePath: sourceRel, reason: 'target_exists' });
      continue;
    }
    await mkdir(dirname(targetAbs), { recursive: true });
    await copyFile(sourceFile, targetAbs);
    const contents = await readFile(targetAbs);
    hash.update(targetFilePath);
    hash.update('\0');
    hash.update(contents);
    changedFiles.add(targetFilePath);
    imported.push({
      name: humanize(stripExtension(targetFilePath.split('/').at(-1) ?? 'asset')),
      variableName: `${camel(stripExtension(targetFilePath.split('/').at(-1) ?? 'asset'))}Url`,
      sourceFilePath: sourceRel,
      targetFilePath,
      kind,
    });
  }

  if (imported.length > 0) {
    for (const filePath of await writeAssetBarrel(workspaceRoot)) changedFiles.add(filePath);
    for (const filePath of await writeStorybookGalleries(workspaceRoot)) changedFiles.add(filePath);
    changedFiles.add(
      await writeImportedPackManifest(workspaceRoot, {
        name: input.packName.trim() || 'Imported assets',
        sourceLabel: sourceRoot.split(sep).at(-1) ?? 'assets',
        assetCount: imported.length,
        contentHash: `sha256:${hash.digest('hex')}`,
        assets: imported.map((asset) => ({
          filePath: asset.targetFilePath,
          kind: asset.kind,
          name: asset.name,
          importName: asset.variableName,
        })),
      }),
    );
  }

  const changed = Array.from(changedFiles).sort();
  return {
    changedFiles: changed,
    imported: imported.length,
    skipped,
    diagnostics: [],
  };
}

async function collectSourceFiles(sourceRoot: string): Promise<string[]> {
  const out: string[] = [];
  await walk(sourceRoot, sourceRoot, out);
  return out.sort().slice(0, MAX_ASSET_FILES);
}

async function walk(root: string, dir: string, out: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const abs = join(dir, entry.name);
    const link = await lstat(abs);
    if (link.isSymbolicLink()) continue;
    const canonical = await realpath(abs);
    if (!isInside(root, canonical)) continue;
    if (entry.isDirectory()) {
      await walk(root, abs, out);
    } else if (entry.isFile()) {
      out.push(canonical);
    }
    if (out.length >= MAX_ASSET_FILES) return;
  }
}

async function writeAssetBarrel(workspaceRoot: string): Promise<string[]> {
  const assets = await collectWorkspaceAssets(workspaceRoot);
  if (assets.length === 0) return [];
  const lines = assets.map(
    (asset) =>
      `export { default as ${asset.variableName} } from './${asset.targetFilePath.replace(/^src\/assets\//, '')}';`,
  );
  await writeWorkspaceText(workspaceRoot, 'src/assets/index.ts', `${lines.join('\n')}\n`);
  return ['src/assets/index.ts'];
}

async function writeStorybookGalleries(workspaceRoot: string): Promise<string[]> {
  if (!(await exists(resolve(workspaceRoot, '.storybook')))) return [];
  const assets = await collectWorkspaceAssets(workspaceRoot);
  const changed: string[] = [];
  const groups = [
    { kind: 'icons' as const, title: 'Assets/Icons', path: 'src/stories/assets/Icons.stories.tsx' },
    {
      kind: 'illustrations' as const,
      title: 'Assets/Illustrations',
      path: 'src/stories/assets/Illustrations.stories.tsx',
    },
  ];
  for (const group of groups) {
    const items = assets.filter((asset) => asset.kind === group.kind);
    if (items.length === 0) continue;
    await writeWorkspaceText(
      workspaceRoot,
      group.path,
      storyContents(group.title, group.path, items),
    );
    changed.push(group.path);
  }
  return changed;
}

function storyContents(title: string, storyPath: string, assets: ImportedAsset[]): string {
  const storyDir = dirname(storyPath);
  const imports = assets.map(
    (asset) =>
      `import ${asset.variableName} from '${relativeImport(storyDir, asset.targetFilePath)}';`,
  );
  const records = assets.map(
    (asset) =>
      `  { name: '${escapeTs(asset.name)}', filePath: '${escapeTs(asset.targetFilePath)}', src: ${asset.variableName} },`,
  );
  return `${imports.join('\n')}

const meta = {
  title: '${title}',
};

export default meta;

const assets = [
${records.join('\n')}
];

export const Gallery = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16 }}>
      {assets.map((asset) => (
        <figure key={asset.filePath} style={{ display: 'grid', gap: 8, margin: 0, padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 96, background: '#f8fafc', borderRadius: 6 }}>
            <img src={asset.src} alt={asset.name} style={{ maxWidth: 96, maxHeight: 96, objectFit: 'contain' }} />
          </div>
          <figcaption style={{ display: 'grid', gap: 2 }}>
            <strong style={{ fontSize: 12 }}>{asset.name}</strong>
            <code style={{ fontSize: 11, color: '#64748b', wordBreak: 'break-all' }}>{asset.filePath}</code>
          </figcaption>
        </figure>
      ))}
    </div>
  ),
};
`;
}

async function collectWorkspaceAssets(workspaceRoot: string): Promise<ImportedAsset[]> {
  const files: ImportedAsset[] = [];
  for (const kind of ['icons', 'illustrations'] as const) {
    const root = resolve(workspaceRoot, 'src', 'assets', kind);
    await collectWorkspaceAssetFiles(workspaceRoot, root, kind, files);
  }
  return files.sort((a, b) => a.targetFilePath.localeCompare(b.targetFilePath));
}

async function collectWorkspaceAssetFiles(
  workspaceRoot: string,
  dir: string,
  kind: AssetPackKind,
  files: ImportedAsset[],
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectWorkspaceAssetFiles(workspaceRoot, abs, kind, files);
      continue;
    }
    if (!entry.isFile() || !ASSET_RE.test(entry.name)) continue;
    const targetFilePath = normalize(relative(workspaceRoot, abs));
    const base = stripExtension(entry.name);
    files.push({
      name: humanize(base),
      variableName: `${camel(base)}Url`,
      sourceFilePath: targetFilePath,
      targetFilePath,
      kind,
    });
  }
}

async function writeImportedPackManifest(
  workspaceRoot: string,
  input: {
    name: string;
    sourceLabel: string;
    assetCount: number;
    contentHash: string;
    assets: { filePath: string; kind: AssetPackKind; name: string; importName: string }[];
  },
): Promise<string> {
  const filePath = '.sber-designer/assets/imported-packs.json';
  const abs = resolveInside(workspaceRoot, filePath);
  await mkdir(dirname(abs), { recursive: true });
  const existing = await readJson<{ version?: number; packs?: unknown[] }>(abs);
  const next = {
    version: 1,
    packs: [
      ...((existing?.packs ?? []) as unknown[]),
      {
        id: `pack-${slug(input.name)}-${randomUUID().slice(0, 8)}`,
        name: input.name,
        importedAt: Date.now(),
        sourceKind: 'local-folder',
        sourceLabel: input.sourceLabel,
        assetCount: input.assetCount,
        contentHash: input.contentHash,
        assets: input.assets,
      },
    ],
  };
  await writeFile(abs, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return filePath;
}

async function resolveAllowedSource(sourcePath: string): Promise<string> {
  if (!sourcePath.startsWith('/')) throw new Error('sourcePath must be absolute.');
  const canonical = await realpath(resolve(sourcePath));
  const roots = await Promise.all(
    [homedir(), tmpdir(), ...extraAllowedRoots()].map(async (root) => {
      const resolved = resolve(root);
      return realpath(resolved).catch(() => resolved);
    }),
  );
  if (!roots.some((root) => canonical === root || canonical.startsWith(root + sep))) {
    throw new Error(
      `sourcePath is outside allowed local roots (${roots.join(', ')}). Set SBER_DESIGNER_FS_ROOTS to extend.`,
    );
  }
  const entry = await stat(canonical);
  if (!entry.isDirectory()) throw new Error('sourcePath must be a directory.');
  return canonical;
}

function classifyAsset(
  relPath: string,
  ext: string,
  selectedKinds: Set<AssetPackKind>,
): AssetPackKind | null {
  if (selectedKinds.size === 1) return selectedKinds.values().next().value ?? null;
  const lower = relPath.toLowerCase();
  if (/(^|\/)icons?\//.test(lower) && selectedKinds.has('icons')) return 'icons';
  if (/(^|\/)(illustrations?|images?)\//.test(lower) && selectedKinds.has('illustrations')) {
    return 'illustrations';
  }
  if (ext === '.svg' && selectedKinds.has('icons')) return 'icons';
  if (selectedKinds.has('illustrations')) return 'illustrations';
  return null;
}

function targetPathFor(sourceRel: string, kind: AssetPackKind): string {
  const name = safeFileName(sourceRel.split('/').at(-1) ?? 'asset');
  return `src/assets/${kind}/${name}`;
}

function safeFileName(fileName: string): string {
  const ext = extension(fileName);
  const base = stripExtension(fileName);
  return `${slug(base) || 'asset'}${ext}`;
}

async function writeWorkspaceText(
  workspaceRoot: string,
  filePath: string,
  contents: string,
): Promise<void> {
  const abs = resolveInside(workspaceRoot, filePath);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, contents, 'utf8');
}

function resolveInside(workspaceRoot: string, filePath: string): string {
  const root = resolve(workspaceRoot);
  const abs = resolve(root, filePath);
  if (abs !== root && !abs.startsWith(root + sep)) {
    throw new Error(`Refused to access path outside workspace: ${filePath}`);
  }
  return abs;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

function relativeImport(fromDir: string, targetFilePath: string): string {
  const rel = normalize(relative(fromDir, targetFilePath));
  return rel.startsWith('.') ? rel : `./${rel}`;
}

function extraAllowedRoots(): string[] {
  return (process.env.SBER_DESIGNER_FS_ROOTS ?? '')
    .split(':')
    .map((root) => root.trim())
    .filter(Boolean);
}

function isInside(root: string, path: string): boolean {
  return path === root || path.startsWith(root + sep);
}

function extension(filePath: string): string {
  const match = filePath.match(/\.[^.]+$/);
  return match?.[0]?.toLowerCase() ?? '';
}

function stripExtension(value: string): string {
  return value.replace(/\.(svg|png|jpe?g|webp|avif)$/i, '');
}

function humanize(value: string): string {
  const [first, ...rest] = words(value);
  if (!first) return 'Asset';
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}

function camel(value: string): string {
  const parts = words(value);
  return parts
    .map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join('');
}

function slug(value: string): string {
  return words(value).join('-');
}

function words(value: string): string[] {
  return value
    .replace(/\.(svg|png|jpe?g|webp|avif)$/i, '')
    .split(/[^A-Za-z0-9]+/)
    .flatMap((part) => part.split(/(?=[A-Z])/))
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function escapeTs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function normalize(path: string): string {
  return path.split('\\').join('/');
}
