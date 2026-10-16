#!/usr/bin/env bun
/**
 * Remove reproducible local output without crossing the repository boundary.
 *
 * Dry-run is the default. Pass --apply to delete the printed paths. The
 * cleaner intentionally has no home-directory mode: user projects and
 * ~/.sber-designer are outside this command's ownership.
 */
import { lstat, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

import { canonicalizeInside } from '@sber-designer/ast-bridge';

const FIXED_OUTPUTS = [
  '.playwright-mcp',
  'coverage',
  'playwright-report',
  'smoke-artifacts',
  'test-results',
  'tmp',
] as const;

const SCANNED_ROOTS = ['apps', 'packages', 'services'] as const;
const NEVER_TRAVERSE = new Set(['.agents', '.git', 'node_modules']);

export interface CleanupCandidate {
  path: string;
  bytes: number;
  kind: 'directory' | 'file';
}

async function pathSize(absolutePath: string): Promise<number> {
  const stat = await lstat(absolutePath);
  if (!stat.isDirectory() || stat.isSymbolicLink()) return stat.size;

  let total = 0;
  for (const entry of await readdir(absolutePath, { withFileTypes: true })) {
    total += await pathSize(path.join(absolutePath, entry.name));
  }
  return total;
}

async function exists(absolutePath: string): Promise<boolean> {
  try {
    await lstat(absolutePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function collectNamedFiles(
  rootDir: string,
  relativeDir: string,
  output: Set<string>,
): Promise<void> {
  const absoluteDir = path.join(rootDir, relativeDir);
  if (!(await exists(absoluteDir))) return;

  for (const entry of await readdir(absoluteDir, { withFileTypes: true })) {
    if (NEVER_TRAVERSE.has(entry.name)) continue;
    const relativePath = path.posix.join(relativeDir.replaceAll(path.sep, '/'), entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      await collectNamedFiles(rootDir, relativePath, output);
      continue;
    }
    if (entry.name === '.DS_Store' || entry.name.endsWith('.tsbuildinfo')) {
      output.add(relativePath);
    }
  }
}

export async function collectCleanupCandidates(rootDir: string): Promise<CleanupCandidate[]> {
  const relativePaths = new Set<string>();

  for (const relativePath of FIXED_OUTPUTS) {
    if (await exists(path.join(rootDir, relativePath))) relativePaths.add(relativePath);
  }

  for (const parent of SCANNED_ROOTS) {
    const absoluteParent = path.join(rootDir, parent);
    if (!(await exists(absoluteParent))) continue;
    for (const entry of await readdir(absoluteParent, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const relativePath = path.posix.join(parent, entry.name, 'dist');
      if (await exists(path.join(rootDir, relativePath))) relativePaths.add(relativePath);
    }
  }

  await collectNamedFiles(rootDir, '.', relativePaths);

  const candidates: CleanupCandidate[] = [];
  const selectedDirectories: string[] = [];
  const orderedPaths = [...relativePaths].sort(
    (left, right) => left.split('/').length - right.split('/').length || left.localeCompare(right),
  );
  for (const relativePath of orderedPaths) {
    if (selectedDirectories.some((directory) => relativePath.startsWith(`${directory}/`))) {
      continue;
    }
    const absolutePath = path.join(rootDir, relativePath);
    const stat = await lstat(absolutePath);
    const candidate: CleanupCandidate = {
      path: relativePath.replace(/^\.\//u, ''),
      bytes: await pathSize(absolutePath),
      kind: stat.isDirectory() && !stat.isSymbolicLink() ? 'directory' : 'file',
    };
    candidates.push(candidate);
    if (candidate.kind === 'directory') selectedDirectories.push(candidate.path);
  }
  return candidates.sort((left, right) => left.path.localeCompare(right.path));
}

export async function applyCleanup(rootDir: string, candidates: CleanupCandidate[]): Promise<void> {
  for (const candidate of candidates) {
    const lexicalPath = path.resolve(rootDir, candidate.path);
    const lexicalStat = await lstat(lexicalPath);
    if (lexicalStat.isSymbolicLink()) {
      throw new Error(`Refusing to remove symlink cleanup candidate: ${candidate.path}`);
    }
    const resolved = canonicalizeInside(rootDir, candidate.path);
    if (resolved.canonicalPath === resolved.canonicalRoot) {
      throw new Error('Refusing to remove the repository root.');
    }
    await rm(resolved.canonicalPath, { force: true, recursive: candidate.kind === 'directory' });
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

async function main(): Promise<void> {
  const rootDir = path.resolve(import.meta.dir, '..');
  const apply = process.argv.includes('--apply');
  const unknown = process.argv.slice(2).filter((argument) => argument !== '--apply');
  if (unknown.length > 0) {
    throw new Error(`Unknown clean:local argument: ${unknown.join(', ')}`);
  }

  const candidates = await collectCleanupCandidates(rootDir);
  const totalBytes = candidates.reduce((sum, candidate) => sum + candidate.bytes, 0);
  console.log(`${apply ? 'Removing' : 'Would remove'} ${candidates.length} local artifact(s):`);
  for (const candidate of candidates) {
    console.log(`  ${candidate.path} (${formatBytes(candidate.bytes)})`);
  }
  console.log(`Total: ${formatBytes(totalBytes)}`);

  if (!apply) {
    console.log('Dry-run only. Re-run with --apply to remove these paths.');
    return;
  }
  await applyCleanup(rootDir, candidates);
  console.log('Local artifacts removed.');
}

if (import.meta.main) {
  await main();
}
