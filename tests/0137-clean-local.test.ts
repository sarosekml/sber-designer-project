import { expect, test } from 'bun:test';
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { applyCleanup, collectCleanupCandidates } from '../scripts/clean-local';

test('0137 clean:local lists only known generated outputs and removes them on apply', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sd-clean-local-'));
  await mkdir(path.join(root, 'coverage'), { recursive: true });
  await mkdir(path.join(root, 'apps', 'web', 'dist'), { recursive: true });
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, 'coverage', 'lcov.info'), 'generated');
  await writeFile(path.join(root, 'apps', 'web', 'dist', 'index.html'), 'generated');
  await writeFile(path.join(root, 'src', 'cache.tsbuildinfo'), 'generated');
  await writeFile(path.join(root, 'src', 'keep.ts'), 'source');

  const candidates = await collectCleanupCandidates(root);
  expect(candidates.map((candidate) => candidate.path)).toEqual([
    'apps/web/dist',
    'coverage',
    'src/cache.tsbuildinfo',
  ]);

  await applyCleanup(root, candidates);
  expect(await readFile(path.join(root, 'src', 'keep.ts'), 'utf8')).toBe('source');
  expect(await Bun.file(path.join(root, 'coverage', 'lcov.info')).exists()).toBe(false);
  expect(await Bun.file(path.join(root, 'apps', 'web', 'dist', 'index.html')).exists()).toBe(false);
});

test('0137 clean:local refuses a generated path that resolves through an external symlink', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sd-clean-boundary-root-'));
  const outside = await mkdtemp(path.join(tmpdir(), 'sd-clean-boundary-outside-'));
  await writeFile(path.join(outside, 'marker.txt'), 'keep');
  await symlink(outside, path.join(root, 'coverage'));

  const candidates = await collectCleanupCandidates(root);
  expect(candidates.map((candidate) => candidate.path)).toEqual(['coverage']);
  expect(applyCleanup(root, candidates)).rejects.toThrow('symlink cleanup candidate');
  expect(await readFile(path.join(outside, 'marker.txt'), 'utf8')).toBe('keep');
});

test('0137 clean:local never follows a generated-path symlink inside the repository', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sd-clean-internal-symlink-'));
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'keep.ts'), 'keep');
  await symlink(path.join(root, 'src'), path.join(root, 'coverage'));

  const candidates = await collectCleanupCandidates(root);
  expect(applyCleanup(root, candidates)).rejects.toThrow('symlink cleanup candidate');
  expect(await readFile(path.join(root, 'src', 'keep.ts'), 'utf8')).toBe('keep');
});
