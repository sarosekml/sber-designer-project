import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import type { RouteRecord } from './types';

const MAX_FILES = 1_000;
const ROUTE_FILE_RE = /\.(tsx|jsx)$/;

export interface ScanRoutesOptions {
  frameworks?: readonly string[];
}

export async function scanRoutes(
  workspaceRoot: string,
  options: ScanRoutesOptions = {},
): Promise<RouteRecord[]> {
  const hasNext = options.frameworks?.includes('next') ?? false;
  const files: string[] = [];
  for (const root of hasNext ? ['src/app', 'app', 'src/pages', 'pages'] : ['src/app', 'app']) {
    await collectFiles(workspaceRoot, root, files);
  }
  const reactRouterFiles: string[] = [];
  await collectFiles(workspaceRoot, 'src', reactRouterFiles);
  const routes = files
    .sort()
    .slice(0, MAX_FILES)
    .flatMap((filePath) => routeFromFile(workspaceRoot, filePath, { hasNext }));
  for (const filePath of reactRouterFiles.sort().slice(0, MAX_FILES)) {
    routes.push(...(await reactRouterRoutesFromFile(workspaceRoot, filePath)));
  }
  return dedupeById(routes).sort(
    (a, b) => a.routePath.localeCompare(b.routePath) || a.filePath.localeCompare(b.filePath),
  );
}

function routeFromFile(
  workspaceRoot: string,
  abs: string,
  options: { hasNext: boolean },
): RouteRecord[] {
  const filePath = normalize(relative(workspaceRoot, abs));
  if (!ROUTE_FILE_RE.test(filePath)) return [];
  const isAppRoute = filePath.includes('/app/') || filePath.startsWith('app/');
  const source = isAppRoute ? (options.hasNext ? 'next-app' : 'file-system') : 'next-pages';
  if (source === 'next-pages' && !options.hasNext) return [];
  if (source === 'next-pages' && !/^src\/pages\/|^pages\//.test(filePath)) return [];
  if ((source === 'next-app' || source === 'file-system') && !/\/page\.(tsx|jsx)$/.test(filePath))
    return [];
  if (source === 'next-pages' && /\/(_app|_document|api)\./.test(filePath)) return [];
  const routePath =
    source === 'next-app' || source === 'file-system'
      ? appRoutePath(filePath)
      : pagesRoutePath(filePath.replace(/^src\//, ''));
  if (!routePath) return [];
  return [
    {
      id: `route-${slug(filePath)}`,
      routePath,
      filePath,
      source,
    },
  ];
}

async function reactRouterRoutesFromFile(
  workspaceRoot: string,
  abs: string,
): Promise<RouteRecord[]> {
  const filePath = normalize(relative(workspaceRoot, abs));
  if (!ROUTE_FILE_RE.test(filePath)) return [];
  const contents = await readFile(abs, 'utf8').catch(() => '');
  if (!contents.includes('Route') && !contents.includes('path')) return [];
  const routePaths = new Set<string>();
  for (const match of contents.matchAll(/<Route\b[^>]*\bpath=["'`]([^"'`]+)["'`]/g)) {
    const routePath = normalizeRoutePath(match[1]);
    if (routePath) routePaths.add(routePath);
  }
  for (const match of contents.matchAll(/\bpath\s*:\s*["'`]([^"'`]+)["'`]/g)) {
    const routePath = normalizeRoutePath(match[1]);
    if (routePath) routePaths.add(routePath);
  }
  return Array.from(routePaths).map((routePath) => ({
    id: `route-${slug(`${filePath}-${routePath}`)}`,
    routePath,
    filePath,
    source: 'react-router',
  }));
}

function appRoutePath(filePath: string): string {
  const parts = filePath
    .replace(/^src\/app\//, '')
    .replace(/^app\//, '')
    .replace(/\/page\.(tsx|jsx)$/, '')
    .split('/')
    .filter((part) => part && !part.startsWith('('));
  return `/${parts.map(normalizeSegment).filter(Boolean).join('/')}`.replace(/\/+$/, '') || '/';
}

function pagesRoutePath(filePath: string): string {
  const parts = filePath
    .replace(/^pages\//, '')
    .replace(/\.(tsx|jsx)$/, '')
    .split('/')
    .filter((part) => part !== 'index');
  return `/${parts.map(normalizeSegment).filter(Boolean).join('/')}`.replace(/\/+$/, '') || '/';
}

function normalizeSegment(segment: string): string {
  return segment.replace(/^\[(.+?)\]$/, ':$1');
}

function normalizeRoutePath(routePath: string | undefined): string | null {
  if (!routePath || routePath === '*') return null;
  const normalized = routePath.startsWith('/') ? routePath : `/${routePath}`;
  return normalized.replace(/\/+$/, '') || '/';
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
    files.push(abs);
    return;
  }
  if (!entry.isDirectory()) return;
  const entries = await readdir(abs, { withFileTypes: true });
  for (const child of entries) {
    if (child.name.startsWith('.') || child.name === 'node_modules') continue;
    const childAbs = join(abs, child.name);
    if (child.isFile()) {
      if (ROUTE_FILE_RE.test(child.name)) {
        const contents = await readFile(childAbs, 'utf8').catch(() => '');
        if (contents.includes('export default') || contents.includes('function'))
          files.push(childAbs);
      }
      continue;
    }
    if (child.isDirectory())
      await collectFiles(workspaceRoot, normalize(relative(workspaceRoot, childAbs)), files);
    if (files.length >= MAX_FILES) return;
  }
}

function slug(value: string): string {
  return (
    value
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'root'
  );
}

function normalize(path: string): string {
  return path.split('\\').join('/');
}

function dedupeById<T extends { id: string }>(records: T[]): T[] {
  return Array.from(new Map(records.map((record) => [record.id, record])).values());
}
