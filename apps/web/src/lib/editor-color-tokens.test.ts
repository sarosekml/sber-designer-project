import { describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const chromeRoots = ['apps/web/src/components/editor', 'apps/web/src/components/home'];
const sourceExtensions = new Set(['.ts', '.tsx']);
const rawPalettePattern =
  /\b(?:bg|border|text|ring|shadow)-(?:amber|emerald|red|blue|zinc)-\d{2,3}(?:\/\d{1,3})?\b/g;

describe('editor chrome color token usage', () => {
  test('does not use raw Tailwind palette utilities for status or brand colors', async () => {
    const offenders: string[] = [];

    for (const root of chromeRoots) {
      for (const filePath of await listSourceFiles(root)) {
        const source = await readFile(filePath, 'utf8');
        const matches = source.match(rawPalettePattern);
        if (matches) offenders.push(`${filePath}: ${Array.from(new Set(matches)).join(', ')}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) return listSourceFiles(fullPath);
      if (!entry.isFile()) return [];
      return sourceExtensions.has(extensionOf(entry.name)) ? [fullPath] : [];
    }),
  );
  return files.flat();
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot);
}
