import { readdir, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import type { IconIndexFile } from './types';

const ICON_ROOTS = ['src/icons', 'src/components/icons', 'components/icons', 'icons'];
const ICON_RE = /\.(tsx|jsx|svg)$/;

export async function scanProjectIcons(
  workspaceRoot: string,
): Promise<IconIndexFile['projectIcons']> {
  const files: string[] = [];
  for (const root of ICON_ROOTS) {
    await collectFiles(workspaceRoot, root, files);
  }
  return files
    .sort()
    .slice(0, 500)
    .map((abs) => {
      const filePath = normalize(relative(workspaceRoot, abs));
      const name = iconName(filePath);
      return {
        id: slug(filePath),
        name,
        importName: name,
        filePath,
      };
    });
}

async function collectFiles(
  workspaceRoot: string,
  relPath: string,
  files: string[],
): Promise<void> {
  const abs = resolve(workspaceRoot, relPath);
  let entry;
  try {
    entry = await stat(abs);
  } catch {
    return;
  }
  if (entry.isFile()) {
    if (ICON_RE.test(abs)) files.push(abs);
    return;
  }
  if (!entry.isDirectory()) return;
  const entries = await readdir(abs, { withFileTypes: true });
  for (const child of entries) {
    const childAbs = join(abs, child.name);
    if (child.isDirectory())
      await collectFiles(workspaceRoot, normalize(relative(workspaceRoot, childAbs)), files);
    if (child.isFile() && ICON_RE.test(child.name)) files.push(childAbs);
  }
}

function iconName(filePath: string): string {
  const base = filePath
    .split('/')
    .at(-1)
    ?.replace(/\.(tsx|jsx|svg)$/, '');
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Icon';
}

function slug(value: string): string {
  return (
    value
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'icon'
  );
}

function normalize(path: string): string {
  return path.split('\\').join('/');
}
