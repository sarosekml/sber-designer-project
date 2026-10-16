import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import type { StorybookIndexFile } from './types';

const CONFIG_RE = /^main\.(js|jsx|ts|tsx|mjs|cjs)$/;

export async function scanStorybook(workspaceRoot: string): Promise<StorybookIndexFile> {
  const configPaths: string[] = [];
  const storiesGlobs = new Set<string>();
  const dir = resolve(workspaceRoot, '.storybook');

  try {
    const dirStat = await stat(dir);
    if (!dirStat.isDirectory()) throw new Error('not directory');
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !CONFIG_RE.test(entry.name)) continue;
      const rel = normalize(relative(workspaceRoot, join(dir, entry.name)));
      configPaths.push(rel);
      for (const glob of extractStories(await readFile(join(dir, entry.name), 'utf8'))) {
        storiesGlobs.add(glob);
      }
    }
  } catch {
    return { exists: false, configPaths: [], storiesGlobs: [], source: 'not-found' };
  }

  return {
    exists: configPaths.length > 0,
    configPaths: configPaths.sort(),
    storiesGlobs: Array.from(storiesGlobs).sort(),
    source: configPaths.length > 0 ? 'detected' : 'not-found',
  };
}

function extractStories(contents: string): string[] {
  const match = /stories\s*:\s*\[([\s\S]*?)\]/m.exec(contents);
  if (!match?.[1]) return [];
  return Array.from(match[1].matchAll(/['"`]([^'"`]+)['"`]/g)).map((item) => item[1] ?? '');
}

function normalize(path: string): string {
  return path.split('\\').join('/');
}
