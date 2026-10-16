import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { expect, test } from 'bun:test';

import { parseMarkdownFrontmatter } from '../services/api/src/agent-kit/schema';

const AGENT_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SKILL_FRONTMATTER_KEYS = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'sd',
]);
const AGENT_FRONTMATTER_KEYS = new Set([
  'name',
  'description',
  'mode',
  'hidden',
  'temperature',
  'maxIterations',
  'tools',
  'skills',
  'permission',
]);

/**
 * 0140: rule 12 applies to both kits — the product kit inside the package and
 * the root development kit. A root that does not exist (yet) simply
 * contributes no files.
 */
const KIT_ROOTS = [join(process.cwd(), 'packages/agent-kit/kit'), join(process.cwd(), '.agents')];

test('D5.0 agent-kit skills stay compatible with open Agent Skills frontmatter', async () => {
  const files = await collectFiles(
    KIT_ROOTS.map((root) => join(root, 'skills')),
    'SKILL.md',
  );
  const violations: string[] = [];

  for (const file of files) {
    const parsed = parseMarkdownFrontmatter(await readFile(file, 'utf8'));
    const skillDir = basename(dirname(file));
    const name = stringField(parsed.frontmatter, 'name');
    const description = stringField(parsed.frontmatter, 'description');
    if (name !== skillDir) {
      violations.push(`${relativeToRepo(file)}: name must match skill folder "${skillDir}"`);
    }
    if (!name || !AGENT_NAME_RE.test(name) || name.length > 64) {
      violations.push(`${relativeToRepo(file)}: invalid Agent Skill name`);
    }
    if (!description) {
      violations.push(`${relativeToRepo(file)}: description is required`);
    }
    for (const key of Object.keys(parsed.frontmatter)) {
      if (!SKILL_FRONTMATTER_KEYS.has(key)) {
        violations.push(`${relativeToRepo(file)}: unsupported skill frontmatter key "${key}"`);
      }
    }
    const metadata = parsed.frontmatter.metadata;
    if (
      metadata !== undefined &&
      (!isRecord(metadata) || Object.values(metadata).some((value) => typeof value !== 'string'))
    ) {
      violations.push(`${relativeToRepo(file)}: metadata must be a string map`);
    }
  }

  expect(violations).toEqual([]);
  // The product kit must actually be found at its packaged location; an
  // empty scan would make this lint fail open (0140 §5.1).
  expect(files.some((file) => file.includes(join('packages', 'agent-kit')))).toBe(true);
});

test('D5.0 agent definitions stay compatible with opencode markdown agents', async () => {
  const files = await collectFiles(
    KIT_ROOTS.map((root) => join(root, 'agents')),
    '.md',
  );
  const violations: string[] = [];

  for (const file of files) {
    const parsed = parseMarkdownFrontmatter(await readFile(file, 'utf8'));
    const expectedName = basename(file, '.md');
    const name = stringField(parsed.frontmatter, 'name');
    const description = stringField(parsed.frontmatter, 'description');
    const mode = stringField(parsed.frontmatter, 'mode') ?? 'primary';
    if (name !== expectedName) {
      violations.push(`${relativeToRepo(file)}: name must match file "${expectedName}"`);
    }
    if (!name || !AGENT_NAME_RE.test(name) || name.length > 64) {
      violations.push(`${relativeToRepo(file)}: invalid agent name`);
    }
    if (!description) {
      violations.push(`${relativeToRepo(file)}: description is required`);
    }
    if (!['primary', 'subagent', 'all'].includes(mode)) {
      violations.push(`${relativeToRepo(file)}: unsupported mode "${mode}"`);
    }
    for (const key of Object.keys(parsed.frontmatter)) {
      if (!AGENT_FRONTMATTER_KEYS.has(key)) {
        violations.push(`${relativeToRepo(file)}: unsupported agent frontmatter key "${key}"`);
      }
    }
  }

  expect(violations).toEqual([]);
  expect(files.some((file) => file.includes(join('packages', 'agent-kit')))).toBe(true);
});

async function collectFiles(
  roots: string | string[],
  targetNameOrExtension: string,
): Promise<string[]> {
  const files: string[] = [];
  for (const root of Array.isArray(roots) ? roots : [roots]) {
    const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const path = join(root, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await collectFiles(path, targetNameOrExtension)));
        continue;
      }
      if (!entry.isFile()) continue;
      if (entry.name === targetNameOrExtension || entry.name.endsWith(targetNameOrExtension)) {
        files.push(path);
      }
    }
  }
  return files.sort();
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function relativeToRepo(path: string): string {
  return path.replace(`${process.cwd()}/`, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
