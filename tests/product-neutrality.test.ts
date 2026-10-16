import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative } from 'node:path';
import { expect, test } from 'bun:test';

const UNIVERSAL_ROOTS = ['services/api/src', 'packages', 'apps/web/src'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  'fixtures',
  'fixture',
  'test-fixtures',
  'builtin-icons',
]);
const SKIP_FILE_PATTERNS = [/\.test\.[cm]?[tj]sx?$/u, /\.spec\.[cm]?[tj]sx?$/u];
const BASE_TERMS_PATH = join(process.cwd(), 'tests/fixtures/product-neutrality/terms.json');

interface NeutralityTermConfig {
  label: string;
  pattern: string;
  flags?: string;
}

interface NeutralityTerm {
  label: string;
  pattern: RegExp;
}

test('universal source does not hardcode customer project names', async () => {
  const files = await collectSourceFiles(process.cwd(), UNIVERSAL_ROOTS);
  const terms = await loadNeutralityTerms({
    baseTermsPath: BASE_TERMS_PATH,
    localTermsPath: process.env.SD_NEUTRALITY_LOCAL_TERMS,
  });

  expect(await scanNeutralityViolations(process.cwd(), files, terms)).toEqual([]);
});

test('product-neutrality guard merges uncommitted local terms from env path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sd-product-neutrality-'));
  const sourcePath = join(root, 'services/api/src/example.ts');
  const localTermsPath = join(root, 'tests/fixtures/product-neutrality/private.local.json');
  await mkdir(dirname(sourcePath), { recursive: true });
  await mkdir(dirname(localTermsPath), { recursive: true });
  await writeFile(sourcePath, 'export const componentName = "PrivateCustomerWidget";\n', 'utf8');
  await writeFile(
    localTermsPath,
    JSON.stringify(
      {
        terms: [
          {
            label: 'local customer component name',
            pattern: '\\bPrivateCustomerWidget\\b',
            flags: 'u',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  const files = await collectSourceFiles(root, ['services/api/src']);
  const terms = await loadNeutralityTerms({ localTermsPath });

  expect(await scanNeutralityViolations(root, files, terms)).toEqual([
    'services/api/src/example.ts: local customer component name',
  ]);
});

async function loadNeutralityTerms(input: {
  baseTermsPath?: string | undefined;
  localTermsPath?: string | undefined;
}): Promise<NeutralityTerm[]> {
  const configs = [
    ...(await readTermConfigs(input.baseTermsPath)),
    ...(await readTermConfigs(input.localTermsPath)),
  ];
  return configs.map((term) => ({
    label: term.label,
    pattern: new RegExp(term.pattern, normalizeRegexFlags(term.flags)),
  }));
}

async function readTermConfigs(path: string | undefined): Promise<NeutralityTermConfig[]> {
  if (!path) return [];
  const raw = await readFile(path, 'utf8').catch(() => null);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) return parsed.flatMap(coerceTermConfig);
  if (isRecord(parsed) && Array.isArray(parsed.terms)) {
    return parsed.terms.flatMap(coerceTermConfig);
  }
  throw new Error(`Invalid product-neutrality terms file: ${path}`);
}

function coerceTermConfig(value: unknown): NeutralityTermConfig[] {
  if (isRecord(value) && typeof value.label === 'string' && typeof value.pattern === 'string') {
    return [
      {
        label: value.label,
        pattern: value.pattern,
        ...(typeof value.flags === 'string' ? { flags: value.flags } : {}),
      },
    ];
  }
  return [];
}

function normalizeRegexFlags(flags: string | undefined): string {
  return [...new Set((flags || 'iu').replace(/g/gu, '').split(''))].join('');
}

async function scanNeutralityViolations(
  root: string,
  files: string[],
  terms: NeutralityTerm[],
): Promise<string[]> {
  const violations: string[] = [];
  for (const filePath of files) {
    const source = await readFile(filePath, 'utf8');
    for (const term of terms) {
      term.pattern.lastIndex = 0;
      if (term.pattern.test(source)) {
        violations.push(`${relative(root, filePath)}: ${term.label}`);
      }
    }
  }
  return violations;
}

async function collectSourceFiles(root: string, relativeRoots: string[]): Promise<string[]> {
  const files: string[] = [];
  for (const relativeRoot of relativeRoots) {
    await walk(join(root, relativeRoot), files);
  }
  return files.sort();
}

async function walk(dir: string, files: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(path, files);
      continue;
    }
    if (!entry.isFile() || !SOURCE_EXTENSIONS.has(extname(entry.name))) continue;
    const normalized = path.replace(/\\/gu, '/');
    if (SKIP_FILE_PATTERNS.some((pattern) => pattern.test(normalized))) continue;
    files.push(path);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
