import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, resolve, relative } from 'node:path';

const MAX_TRACKED_FILES = 1_500;
const TRACKED_ROOTS = [
  'DESIGN.md',
  '.sber-designer/descriptions',
  '.sber-designer/design-index/component-notes.jsonl',
  '.sber-designer/assets',
  '.storybook',
  'app',
  'components',
  'public/assets',
  'src',
  'src/assets',
  'src/stories/assets',
  'stories',
  'styles',
  'theme',
  'tokens',
] as const;

const TRACKED_EXTENSIONS = new Set([
  '.css',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.mdx',
  '.scss',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

const SKIPPED_DIRS = new Set([
  '.git',
  '.next',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'storybook-static',
]);

export interface FingerprintResult {
  value: string;
  trackedFiles: number;
  files: string[];
}

export async function fingerprintDesignIndex(workspaceRoot: string): Promise<FingerprintResult> {
  const root = resolve(workspaceRoot);
  const files = new Set<string>();
  for (const relPath of TRACKED_ROOTS) {
    await collect(root, relPath, files);
    if (files.size >= MAX_TRACKED_FILES) break;
  }
  const sorted = Array.from(files).sort().slice(0, MAX_TRACKED_FILES);
  const hash = createHash('sha256');
  for (const filePath of sorted) {
    hash.update(filePath);
    hash.update('\0');
    hash.update(await readFile(resolve(root, filePath), 'utf8').catch(() => ''));
    hash.update('\0');
  }
  return { value: hash.digest('hex'), trackedFiles: sorted.length, files: sorted };
}

async function collect(root: string, relPath: string, files: Set<string>): Promise<void> {
  const abs = resolve(root, relPath);
  if (!abs.startsWith(root)) return;

  let entry;
  try {
    entry = await stat(abs);
  } catch {
    return;
  }

  if (entry.isFile()) {
    if (shouldTrack(relPath)) files.add(normalize(relPath));
    return;
  }

  if (!entry.isDirectory()) return;
  const dirName = relPath.split('/').filter(Boolean).at(-1);
  if (dirName && SKIPPED_DIRS.has(dirName)) return;

  const children = await readdir(abs, { withFileTypes: true });
  for (const child of children) {
    if (SKIPPED_DIRS.has(child.name)) continue;
    const childRel = normalize(relative(root, resolve(abs, child.name)));
    await collect(root, childRel, files);
    if (files.size >= MAX_TRACKED_FILES) return;
  }
}

function shouldTrack(filePath: string): boolean {
  return TRACKED_EXTENSIONS.has(extname(filePath));
}

function normalize(filePath: string): string {
  return filePath.split('\\').join('/');
}
