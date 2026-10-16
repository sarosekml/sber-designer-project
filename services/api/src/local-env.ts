import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOT_ENV_FILES = ['.env.local', '.env'];

export function readLocalEnvValue(name: string): string {
  if (process.env.SBER_DESIGNER_DISABLE_LOCAL_ENV_LOAD !== '1') {
    loadLocalEnvFiles();
  }
  return process.env[name]?.trim() ?? '';
}

export function loadLocalEnvFiles(extraRoots: string[] = []): void {
  if (process.env.SBER_DESIGNER_DISABLE_LOCAL_ENV_LOAD === '1') return;
  for (const root of localEnvRoots(extraRoots)) {
    for (const fileName of DOT_ENV_FILES) {
      loadDotEnvFile(join(root, fileName));
    }
  }
}

function localEnvRoots(extraRoots: string[]): string[] {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const apiRoot = resolve(moduleDir, '..');
  const repoRoot = resolve(moduleDir, '../../..');
  const cwd = process.cwd();
  return Array.from(new Set([...extraRoots, cwd, resolve(cwd, 'services/api'), apiRoot, repoRoot]));
}

function loadDotEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const parsed = parseDotEnvLine(line);
    if (!parsed) continue;
    const current = process.env[parsed.key];
    if (current !== undefined && current.trim() !== '') continue;
    process.env[parsed.key] = parsed.value;
  }
}

function parseDotEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const normalized = trimmed.startsWith('export ')
    ? trimmed.slice('export '.length).trim()
    : trimmed;
  const separator = normalized.indexOf('=');
  if (separator <= 0) return null;

  const key = normalized.slice(0, separator).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  let value = normalized.slice(separator + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  } else {
    value = value.replace(/\s+#.*$/, '').trim();
  }
  return { key, value };
}
