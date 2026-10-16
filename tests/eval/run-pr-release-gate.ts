import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

import {
  evalReleaseGateExitCode,
  runEvalReleaseGate,
  type EvalReleaseGateStatus,
  type EvalReleaseGateThresholds,
} from './run-release-gate';

const DEFAULT_REGISTRY_PATH = 'tests/eval/baselines/manifest.json';

export type PrEvalGateStatus = 'not_required' | EvalReleaseGateStatus;

export interface EvalBaselineRegistryEntry {
  id: string;
  description: string;
  status: 'pending' | 'active';
  baselineScorecard: string | null;
  currentScorecard: string;
  appliesTo: string[];
  thresholds: EvalReleaseGateThresholds;
}

export interface EvalBaselineRegistry {
  version: 1;
  entries: EvalBaselineRegistryEntry[];
}

export interface PrEvalGateEntryResult {
  id: string;
  description: string;
  status: EvalReleaseGateStatus;
  matchedFiles: string[];
  detail: string;
  baselineScorecard: string | null;
  currentScorecard: string;
  evalDiffJson: string | null;
  evalDiffMarkdown: string | null;
}

export interface PrEvalGateReport {
  version: 1;
  generatedAt: string;
  status: PrEvalGateStatus;
  registryPath: string;
  changedFiles: string[];
  entries: PrEvalGateEntryResult[];
  summary: {
    matchedEntries: number;
    passed: number;
    regressions: number;
    blocked: number;
  };
}

export interface RunPrEvalGateInput {
  changedFiles: string[];
  workspaceRoot?: string;
  registryPath?: string;
  outputDir?: string;
  generatedAt?: string;
}

export interface RunPrEvalGateResult {
  report: PrEvalGateReport;
  jsonPath: string;
  markdownPath: string;
}

export async function runPrEvalGate(input: RunPrEvalGateInput): Promise<RunPrEvalGateResult> {
  const workspaceRoot = resolve(input.workspaceRoot ?? process.cwd());
  const registryPath = normalizeWorkspacePath(input.registryPath ?? DEFAULT_REGISTRY_PATH);
  const registry = parseRegistry(
    JSON.parse(
      await readFile(resolveWorkspaceFile(workspaceRoot, registryPath), 'utf8'),
    ) as unknown,
  );
  const changedFiles = [
    ...new Set(input.changedFiles.map(normalizeWorkspacePath).filter(Boolean)),
  ].sort((left, right) => left.localeCompare(right));
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const outputDir = resolve(
    input.outputDir ??
      join(tmpdir(), 'sber-designer-pr-eval-gate', generatedAt.replace(/[:.]/gu, '-')),
  );
  const entryResults: PrEvalGateEntryResult[] = [];

  for (const entry of registry.entries) {
    const matchedFiles = changedFiles.filter((file) =>
      entry.appliesTo.some((pattern) => matchesProtectedPath(pattern, file)),
    );
    if (matchedFiles.length === 0) continue;
    entryResults.push(
      await evaluateRegistryEntry({
        entry,
        matchedFiles,
        changedFiles,
        workspaceRoot,
        outputDir,
        generatedAt,
      }),
    );
  }

  const status = overallStatus(entryResults);
  const report: PrEvalGateReport = {
    version: 1,
    generatedAt,
    status,
    registryPath,
    changedFiles,
    entries: entryResults,
    summary: {
      matchedEntries: entryResults.length,
      passed: entryResults.filter((entry) => entry.status === 'passed').length,
      regressions: entryResults.filter((entry) => entry.status === 'regression').length,
      blocked: entryResults.filter((entry) => entry.status === 'blocked').length,
    },
  };
  await mkdir(outputDir, { recursive: true });
  const jsonPath = join(outputDir, 'pr-eval-gate.json');
  const markdownPath = join(outputDir, 'pr-eval-gate.md');
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(markdownPath, renderPrEvalGateMarkdown(report), 'utf8'),
  ]);
  return { report, jsonPath, markdownPath };
}

export function prEvalGateExitCode(status: PrEvalGateStatus): 0 | 1 | 2 {
  return status === 'not_required' ? 0 : evalReleaseGateExitCode(status);
}

export function renderPrEvalGateMarkdown(report: PrEvalGateReport): string {
  const rows = report.entries.map(
    (entry) =>
      `| ${entry.id} | ${entry.status} | ${entry.matchedFiles.length} | ${escapeTable(entry.detail)} |`,
  );
  return [
    '# PR eval release gate',
    '',
    `**Status: ${report.status.toUpperCase()}**`,
    '',
    `- Registry: \`${report.registryPath}\``,
    `- Changed files: ${report.changedFiles.length}`,
    `- Matched gates: ${report.summary.matchedEntries}`,
    '',
    ...(rows.length > 0
      ? ['| Gate | Status | Matched files | Detail |', '| --- | --- | ---: | --- |', ...rows]
      : ['No protected prompt/skill/craft paths changed.']),
    '',
  ].join('\n');
}

async function evaluateRegistryEntry(input: {
  entry: EvalBaselineRegistryEntry;
  matchedFiles: string[];
  changedFiles: string[];
  workspaceRoot: string;
  outputDir: string;
  generatedAt: string;
}): Promise<PrEvalGateEntryResult> {
  const base = {
    id: input.entry.id,
    description: input.entry.description,
    matchedFiles: input.matchedFiles,
    baselineScorecard: input.entry.baselineScorecard,
    currentScorecard: input.entry.currentScorecard,
  };
  if (input.entry.status === 'pending' || !input.entry.baselineScorecard) {
    return {
      ...base,
      status: 'blocked',
      detail:
        'Accepted baseline is pending. Run the live eval on main, review it, and activate this registry entry.',
      evalDiffJson: null,
      evalDiffMarkdown: null,
    };
  }

  if (!input.changedFiles.includes(input.entry.currentScorecard)) {
    return {
      ...base,
      status: 'blocked',
      detail: `Current scorecard must be added or updated in this PR: ${input.entry.currentScorecard}.`,
      evalDiffJson: null,
      evalDiffMarkdown: null,
    };
  }

  const baselinePath = resolveWorkspaceFile(input.workspaceRoot, input.entry.baselineScorecard);
  const currentPath = resolveWorkspaceFile(input.workspaceRoot, input.entry.currentScorecard);
  const missing = await missingScorecards([
    [input.entry.baselineScorecard, baselinePath],
    [input.entry.currentScorecard, currentPath],
  ]);
  if (missing.length > 0) {
    return {
      ...base,
      status: 'blocked',
      detail: `Required scorecard missing: ${missing.join(', ')}.`,
      evalDiffJson: null,
      evalDiffMarkdown: null,
    };
  }

  const entryOutputDir = join(input.outputDir, 'entries', input.entry.id);
  const result = await runEvalReleaseGate({
    baselinePath,
    currentPath,
    outputDir: entryOutputDir,
    thresholds: input.entry.thresholds,
    generatedAt: input.generatedAt,
  });
  return {
    ...base,
    status: result.report.status,
    detail:
      result.report.status === 'passed'
        ? 'Current scorecard is within the accepted regression budgets.'
        : result.report.status === 'regression'
          ? `Regressed metrics: ${result.report.summary.regressions.join(', ')}.`
          : `Scorecard comparison blocked: ${[
              ...result.report.coverage.differences,
              ...result.report.summary.insufficientData.map((metric) => `${metric} is missing`),
            ].join(' ')}`,
    evalDiffJson: relative(input.outputDir, result.jsonPath).replace(/\\/gu, '/'),
    evalDiffMarkdown: relative(input.outputDir, result.markdownPath).replace(/\\/gu, '/'),
  };
}

async function missingScorecards(entries: Array<[string, string]>): Promise<string[]> {
  const missing: string[] = [];
  for (const [displayPath, absolutePath] of entries) {
    const exists = await access(absolutePath)
      .then(() => true)
      .catch(() => false);
    if (!exists) missing.push(displayPath);
  }
  return missing;
}

function overallStatus(entries: PrEvalGateEntryResult[]): PrEvalGateStatus {
  if (entries.length === 0) return 'not_required';
  if (entries.some((entry) => entry.status === 'regression')) return 'regression';
  if (entries.some((entry) => entry.status === 'blocked')) return 'blocked';
  return 'passed';
}

function parseRegistry(value: unknown): EvalBaselineRegistry {
  if (!value || typeof value !== 'object') throw new Error('Invalid eval baseline registry.');
  const registry = value as Partial<EvalBaselineRegistry>;
  if (
    registry.version !== 1 ||
    !Array.isArray(registry.entries) ||
    registry.entries.length === 0 ||
    !registry.entries.every(isRegistryEntry)
  ) {
    throw new Error('Invalid eval baseline registry.');
  }
  const ids = registry.entries.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate eval baseline registry id.');
  return registry as EvalBaselineRegistry;
}

function isRegistryEntry(value: unknown): value is EvalBaselineRegistryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<EvalBaselineRegistryEntry>;
  return (
    typeof entry.id === 'string' &&
    /^[a-z0-9][a-z0-9-]*$/u.test(entry.id) &&
    typeof entry.description === 'string' &&
    (entry.status === 'pending' || entry.status === 'active') &&
    (entry.baselineScorecard === null || isBaselineScorecardPath(entry.baselineScorecard)) &&
    isCurrentScorecardPath(entry.currentScorecard) &&
    entry.baselineScorecard !== entry.currentScorecard &&
    Array.isArray(entry.appliesTo) &&
    entry.appliesTo.length > 0 &&
    entry.appliesTo.every(isProtectedPattern) &&
    isThresholds(entry.thresholds) &&
    (entry.status !== 'active' || typeof entry.baselineScorecard === 'string')
  );
}

function isBaselineScorecardPath(value: unknown): value is string {
  return (
    isSafeWorkspacePath(value) &&
    value.startsWith('tests/eval/baselines/') &&
    value !== DEFAULT_REGISTRY_PATH
  );
}

function isCurrentScorecardPath(value: unknown): value is string {
  return isSafeWorkspacePath(value) && value.startsWith('tests/eval/candidates/');
}

function isThresholds(value: unknown): value is EvalReleaseGateThresholds {
  if (!value || typeof value !== 'object') return false;
  const thresholds = value as Partial<EvalReleaseGateThresholds>;
  return [thresholds.maxFidelityDrop, thresholds.maxReuseDrop, thresholds.maxCraftIncrease].every(
    (threshold) => typeof threshold === 'number' && Number.isFinite(threshold) && threshold >= 0,
  );
}

function isProtectedPattern(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  const normalized = normalizeWorkspacePath(value);
  return (
    isSafeWorkspacePath(normalized.replace(/\/\*\*$/u, '')) &&
    !/[*?]/u.test(normalized.replace(/\/\*\*$/u, ''))
  );
}

function matchesProtectedPath(pattern: string, path: string): boolean {
  const normalizedPattern = normalizeWorkspacePath(pattern);
  if (normalizedPattern.endsWith('/**')) {
    const root = normalizedPattern.slice(0, -3);
    return path === root || path.startsWith(`${root}/`);
  }
  return path === normalizedPattern;
}

function isSafeWorkspacePath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    Boolean(value.trim()) &&
    !value.startsWith('/') &&
    !value.split(/[\\/]/u).includes('..')
  );
}

function normalizeWorkspacePath(value: string): string {
  return value
    .trim()
    .replace(/\\/gu, '/')
    .replace(/^\.\//u, '')
    .replace(/\/{2,}/gu, '/');
}

function resolveWorkspaceFile(workspaceRoot: string, path: string): string {
  const target = resolve(workspaceRoot, path);
  const rootPrefix = workspaceRoot.endsWith(sep) ? workspaceRoot : `${workspaceRoot}${sep}`;
  if (target !== workspaceRoot && !target.startsWith(rootPrefix)) {
    throw new Error(`Eval registry path escapes the workspace: ${path}`);
  }
  return target;
}

function escapeTable(value: string): string {
  return value.replace(/\|/gu, '\\|').replace(/\s+/gu, ' ').trim();
}

export function parsePrEvalGateArgs(args: string[]): {
  changedFilesPath: string;
  registryPath?: string;
  outputDir?: string;
} {
  const input: { changedFilesPath?: string; registryPath?: string; outputDir?: string } = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = () => {
      index += 1;
      if (index >= args.length) throw new Error(`${arg} requires a value`);
      return args[index]!;
    };
    if (arg === '--changed-files') input.changedFilesPath = next();
    else if (arg === '--registry') input.registryPath = next();
    else if (arg === '--output') input.outputDir = next();
    else if (arg === '--help' || arg === '-h') throw new Error(usage());
    else throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
  }
  if (!input.changedFilesPath) throw new Error(usage());
  return {
    changedFilesPath: input.changedFilesPath,
    ...(input.registryPath ? { registryPath: input.registryPath } : {}),
    ...(input.outputDir ? { outputDir: input.outputDir } : {}),
  };
}

function usage(): string {
  return [
    'Usage: bun run eval:pr-gate --changed-files <paths.txt> [options]',
    '',
    'Options:',
    `  --registry <path>       Default ${DEFAULT_REGISTRY_PATH}`,
    '  --output <path>         Output directory for PR gate reports',
  ].join('\n');
}

if (import.meta.main) {
  try {
    const cli = parsePrEvalGateArgs(process.argv.slice(2));
    const changedFiles = (await readFile(resolve(cli.changedFilesPath), 'utf8'))
      .split(/\r?\n/u)
      .filter(Boolean);
    const result = await runPrEvalGate({
      changedFiles,
      ...(cli.registryPath ? { registryPath: cli.registryPath } : {}),
      ...(cli.outputDir ? { outputDir: cli.outputDir } : {}),
    });
    console.log(`PR eval release gate: ${result.report.status}`);
    console.log(`PR gate JSON: ${result.jsonPath}`);
    console.log(`PR gate Markdown: ${result.markdownPath}`);
    process.exitCode = prEvalGateExitCode(result.report.status);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
