#!/usr/bin/env bun
/**
 * Workspace typecheck gate (0078 follow-up).
 *
 * The root tsconfig.json is references-only (`include: []`), so a plain
 * `tsc -p tsconfig.json --noEmit` checks zero files and exits 0. This
 * script runs the real package-level `tsc --noEmit` for every project
 * referenced from the root tsconfig and compares the committed baseline
 * (`typecheck-baseline.json`) with what tsc reports now:
 *
 * - a diagnostic code in a file that is clean in the baseline, or more of
 *   that code in a file than the baseline records, fails the gate;
 * - fixed errors pass with a hint to shrink the baseline.
 *
 * 0136 R10 — the baseline records counts **per diagnostic code**, not one
 * number per file. Counting alone let a file swap one error for another and
 * stay green: fix a TS2379 and introduce a TS2345 in the same file and the
 * total never moved. Codes are coarse (they do not pin the line), but they
 * are stable across formatting and refactors, which a line number is not.
 *
 * The baseline exists to burn down pre-0078 type debt without letting
 * new debt in. Update it only when the totals go DOWN (or a known-debt
 * file moves) with: bun run typecheck --update-baseline
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Diagnostic code (e.g. `TS2345`) -> how many of them are in one file. */
export type FileDiagnostics = Record<string, number>;

export interface ProjectErrors {
  /** Repo-relative error file path -> diagnostic codes in that file. */
  files: Record<string, FileDiagnostics>;
  /** Raw `error TS...` lines for reporting regressions. */
  lines: string[];
  /** Set when tsc exited non-zero without reporting parseable errors. */
  crashed?: string;
}

/**
 * Project -> file -> diagnostic code -> count. A plain number is accepted for
 * a file entry so a baseline written before 0136 still loads; it means "this
 * many errors of any code", which is the weaker rule the gate used to have.
 */
export type Baseline = Record<string, Record<string, FileDiagnostics | number>>;

export interface BaselineComparison {
  regressions: string[];
  improvements: string[];
}

const ERROR_LINE = /^(.+?)\(\d+,\d+\): error (TS\d+): /;

export function listRootProjects(rootDir: string): string[] {
  const tsconfig = JSON.parse(readFileSync(path.join(rootDir, 'tsconfig.json'), 'utf8')) as {
    references?: { path: string }[];
  };
  return (tsconfig.references ?? []).map((ref) => ref.path.replace(/^\.\//u, ''));
}

export function parseTscOutput(output: string): ProjectErrors {
  const files: Record<string, FileDiagnostics> = {};
  const lines: string[] = [];
  for (const line of output.split('\n')) {
    const match = ERROR_LINE.exec(line);
    if (!match) continue;
    const file = normalizeErrorPath(match[1]!);
    const code = match[2]!;
    const byCode = (files[file] ??= {});
    byCode[code] = (byCode[code] ?? 0) + 1;
    lines.push(line.trimEnd());
  }
  return { files, lines };
}

export function totalFor(diagnostics: FileDiagnostics): number {
  return Object.values(diagnostics).reduce((sum, count) => sum + count, 0);
}

/** Normalize either baseline shape to the code-keyed one. */
export function toFileDiagnostics(entry: FileDiagnostics | number | undefined): {
  byCode: FileDiagnostics;
  legacyTotal: number | null;
} {
  if (entry === undefined) return { byCode: {}, legacyTotal: null };
  if (typeof entry === 'number') return { byCode: {}, legacyTotal: entry };
  return { byCode: entry, legacyTotal: null };
}

function normalizeErrorPath(file: string): string {
  return file.replace(/\\/gu, '/').replace(/^\.\//u, '');
}

export function compareWithBaseline(
  current: Record<string, ProjectErrors>,
  baseline: Baseline,
): BaselineComparison {
  const regressions: string[] = [];
  const improvements: string[] = [];
  for (const [project, errors] of Object.entries(current)) {
    const baselineFiles = baseline[project] ?? {};
    for (const [file, diagnostics] of Object.entries(errors.files)) {
      const { byCode, legacyTotal } = toFileDiagnostics(baselineFiles[file]);
      const total = totalFor(diagnostics);
      if (legacyTotal !== null) {
        // Pre-0136 baseline entry: only the total is known here.
        if (total > legacyTotal) {
          regressions.push(
            `${project}: ${file} has ${total} error${total === 1 ? '' : 's'} (baseline allows ${legacyTotal})`,
          );
        } else if (total < legacyTotal) {
          improvements.push(`${project}: ${file} is down to ${total} from ${legacyTotal}`);
        }
        continue;
      }
      for (const [code, count] of Object.entries(diagnostics)) {
        const allowed = byCode[code] ?? 0;
        if (count > allowed) {
          regressions.push(
            `${project}: ${file} has ${count} ${code} error${count === 1 ? '' : 's'} (baseline allows ${allowed})`,
          );
        } else if (count < allowed) {
          improvements.push(`${project}: ${file} is down to ${count} ${code} from ${allowed}`);
        }
      }
      for (const [code, allowed] of Object.entries(byCode)) {
        if (allowed > 0 && !(code in diagnostics)) {
          improvements.push(
            `${project}: ${file} no longer reports ${code} (baseline allows ${allowed})`,
          );
        }
      }
    }
    for (const [file, entry] of Object.entries(baselineFiles)) {
      const { byCode, legacyTotal } = toFileDiagnostics(entry);
      const allowed = legacyTotal ?? totalFor(byCode);
      if (allowed > 0 && !(file in errors.files)) {
        improvements.push(`${project}: ${file} is clean now (baseline allows ${allowed})`);
      }
    }
  }
  return { regressions, improvements };
}

export function toBaseline(current: Record<string, ProjectErrors>): Baseline {
  const baseline: Baseline = {};
  for (const project of Object.keys(current).sort()) {
    const files = current[project]!.files;
    if (Object.keys(files).length === 0) continue;
    baseline[project] = Object.fromEntries(
      Object.keys(files)
        .sort()
        .map((file) => [
          file,
          Object.fromEntries(
            Object.keys(files[file]!)
              .sort()
              .map((code) => [code, files[file]![code]!]),
          ),
        ]),
    );
  }
  return baseline;
}

async function runTsc(rootDir: string, project: string): Promise<ProjectErrors> {
  const proc = Bun.spawn(['bunx', 'tsc', '-p', project, '--noEmit', '--pretty', 'false'], {
    cwd: rootDir,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  const parsed = parseTscOutput(`${stdout}\n${stderr}`);
  if (exitCode !== 0 && parsed.lines.length === 0) {
    parsed.crashed = `tsc exited ${exitCode}: ${(stderr || stdout).trim().slice(0, 400)}`;
  }
  return parsed;
}

async function runAll(
  rootDir: string,
  projects: string[],
  concurrency: number,
): Promise<Record<string, ProjectErrors>> {
  const results: Record<string, ProjectErrors> = {};
  const queue = [...projects];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (let project = queue.shift(); project; project = queue.shift()) {
      results[project] = await runTsc(rootDir, project);
    }
  });
  await Promise.all(workers);
  return results;
}

function loadBaseline(baselinePath: string): Baseline {
  try {
    return JSON.parse(readFileSync(baselinePath, 'utf8')) as Baseline;
  } catch {
    return {};
  }
}

async function main(): Promise<void> {
  const rootDir = path.resolve(import.meta.dir, '..');
  const baselinePath = path.join(rootDir, 'typecheck-baseline.json');
  const updateBaseline = process.argv.includes('--update-baseline');

  const projects = listRootProjects(rootDir);
  const current = await runAll(rootDir, projects, 4);

  const crashed = Object.entries(current).filter(([, errors]) => errors.crashed);
  for (const [project, errors] of crashed) {
    console.error(`✗ ${project}: ${errors.crashed}`);
  }
  if (crashed.length > 0) process.exit(1);

  for (const project of projects) {
    const count = current[project]!.lines.length;
    console.log(`${count === 0 ? '✓' : '·'} ${project}: ${count} error${count === 1 ? '' : 's'}`);
  }

  if (updateBaseline) {
    await Bun.write(baselinePath, `${JSON.stringify(toBaseline(current), null, 2)}\n`);
    console.log(`\nBaseline written to ${path.relative(rootDir, baselinePath)}.`);
    return;
  }

  const { regressions, improvements } = compareWithBaseline(current, loadBaseline(baselinePath));
  if (improvements.length > 0) {
    console.log(`\nBetter than baseline (shrink it with --update-baseline):`);
    for (const line of improvements) console.log(`  ${line}`);
  }
  if (regressions.length > 0) {
    console.error(`\nNew type errors versus typecheck-baseline.json:`);
    for (const line of regressions) console.error(`  ${line}`);
    const offending = new Set(
      regressions.map((line) => line.slice(line.indexOf(': ') + 2, line.indexOf(' has '))),
    );
    console.error('');
    for (const errors of Object.values(current)) {
      for (const line of errors.lines) {
        const file = normalizeErrorPath(line.slice(0, line.indexOf('(')));
        if (offending.has(file)) console.error(`  ${line}`);
      }
    }
    process.exit(1);
  }
  console.log('\nTypecheck gate passed (no new errors versus baseline).');
}

if (import.meta.main) {
  await main();
}
