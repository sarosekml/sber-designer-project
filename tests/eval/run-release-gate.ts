import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

export type EvalReleaseGateStatus = 'passed' | 'regression' | 'blocked';
export type EvalReleaseGateMetric =
  | 'componentReuseScore'
  | 'craftBlockingCount'
  | 'languageFactFidelityScore';

interface EvalScorecardCounts {
  cells: number;
  completed: number;
  failed: number;
  planned: number;
}

interface EvalScorecardForGate {
  generatedAt: string;
  totals: EvalScorecardCounts;
  byProfile: Record<string, EvalScorecardCounts>;
  byModel: Record<string, EvalScorecardCounts>;
  byFixture: Record<string, EvalScorecardCounts>;
  averages: Record<EvalReleaseGateMetric, number | null> & Record<string, unknown>;
}

export interface EvalReleaseGateThresholds {
  maxFidelityDrop: number;
  maxReuseDrop: number;
  maxCraftIncrease: number;
}

export interface EvalReleaseGateMetricResult {
  metric: EvalReleaseGateMetric;
  label: string;
  direction: 'higher-is-better' | 'lower-is-better';
  baseline: number | null;
  current: number | null;
  delta: number | null;
  allowedRegression: number;
  status: 'passed' | 'regression' | 'insufficient_data';
  detail: string;
}

export interface EvalReleaseGateReport {
  version: 1;
  generatedAt: string;
  status: EvalReleaseGateStatus;
  baselinePath: string;
  currentPath: string;
  thresholds: EvalReleaseGateThresholds;
  coverage: {
    status: 'passed' | 'blocked';
    baseline: EvalScorecardCounts;
    current: EvalScorecardCounts;
    differences: string[];
  };
  metrics: Record<EvalReleaseGateMetric, EvalReleaseGateMetricResult>;
  summary: {
    regressions: EvalReleaseGateMetric[];
    insufficientData: EvalReleaseGateMetric[];
  };
}

export interface CompareEvalScorecardsInput {
  baseline: unknown;
  current: unknown;
  baselinePath?: string;
  currentPath?: string;
  thresholds?: Partial<EvalReleaseGateThresholds>;
  generatedAt?: string;
}

export interface RunEvalReleaseGateInput {
  baselinePath: string;
  currentPath: string;
  outputDir?: string;
  thresholds?: Partial<EvalReleaseGateThresholds>;
  generatedAt?: string;
}

export interface RunEvalReleaseGateResult {
  report: EvalReleaseGateReport;
  jsonPath: string;
  markdownPath: string;
}

export const DEFAULT_EVAL_RELEASE_GATE_THRESHOLDS: EvalReleaseGateThresholds = {
  maxFidelityDrop: 0.02,
  maxReuseDrop: 0.05,
  maxCraftIncrease: 0,
};

const METRIC_RULES: Record<
  EvalReleaseGateMetric,
  {
    label: string;
    direction: EvalReleaseGateMetricResult['direction'];
    threshold: keyof EvalReleaseGateThresholds;
  }
> = {
  languageFactFidelityScore: {
    label: 'Language/fact fidelity',
    direction: 'higher-is-better',
    threshold: 'maxFidelityDrop',
  },
  componentReuseScore: {
    label: 'Component reuse',
    direction: 'higher-is-better',
    threshold: 'maxReuseDrop',
  },
  craftBlockingCount: {
    label: 'Craft blocking findings',
    direction: 'lower-is-better',
    threshold: 'maxCraftIncrease',
  },
};

export function compareEvalScorecards(input: CompareEvalScorecardsInput): EvalReleaseGateReport {
  const baseline = parseScorecard(input.baseline, 'baseline');
  const current = parseScorecard(input.current, 'current');
  const thresholds = normalizeThresholds(input.thresholds);
  const coverageDifferences = compareCoverage(baseline, current);
  const metrics = Object.fromEntries(
    (Object.keys(METRIC_RULES) as EvalReleaseGateMetric[]).map((metric) => [
      metric,
      compareMetric(metric, baseline.averages[metric], current.averages[metric], thresholds),
    ]),
  ) as Record<EvalReleaseGateMetric, EvalReleaseGateMetricResult>;
  const regressions = (Object.keys(metrics) as EvalReleaseGateMetric[]).filter(
    (metric) => metrics[metric].status === 'regression',
  );
  const insufficientData = (Object.keys(metrics) as EvalReleaseGateMetric[]).filter(
    (metric) => metrics[metric].status === 'insufficient_data',
  );
  const status: EvalReleaseGateStatus =
    regressions.length > 0
      ? 'regression'
      : coverageDifferences.length > 0 || insufficientData.length > 0
        ? 'blocked'
        : 'passed';

  return {
    version: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status,
    baselinePath: input.baselinePath ?? 'baseline-scorecard.json',
    currentPath: input.currentPath ?? 'current-scorecard.json',
    thresholds,
    coverage: {
      status: coverageDifferences.length > 0 ? 'blocked' : 'passed',
      baseline: baseline.totals,
      current: current.totals,
      differences: coverageDifferences,
    },
    metrics,
    summary: { regressions, insufficientData },
  };
}

export async function runEvalReleaseGate(
  input: RunEvalReleaseGateInput,
): Promise<RunEvalReleaseGateResult> {
  const baselinePath = resolve(input.baselinePath);
  const currentPath = resolve(input.currentPath);
  const [baseline, current] = await Promise.all([
    readFile(baselinePath, 'utf8').then((source) => JSON.parse(source) as unknown),
    readFile(currentPath, 'utf8').then((source) => JSON.parse(source) as unknown),
  ]);
  const report = compareEvalScorecards({
    baseline,
    current,
    baselinePath: displayPath(baselinePath),
    currentPath: displayPath(currentPath),
    ...(input.thresholds ? { thresholds: input.thresholds } : {}),
    ...(input.generatedAt ? { generatedAt: input.generatedAt } : {}),
  });
  const outputDir = resolve(input.outputDir ?? join(dirname(currentPath), 'eval-diff'));
  const jsonPath = join(outputDir, 'eval-diff.json');
  const markdownPath = join(outputDir, 'eval-diff.md');
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(markdownPath, renderEvalReleaseGateMarkdown(report), 'utf8'),
  ]);
  return { report, jsonPath, markdownPath };
}

export function evalReleaseGateExitCode(status: EvalReleaseGateStatus): 0 | 1 | 2 {
  if (status === 'passed') return 0;
  if (status === 'regression') return 1;
  return 2;
}

export function renderEvalReleaseGateMarkdown(report: EvalReleaseGateReport): string {
  const statusLabel =
    report.status === 'passed'
      ? 'PASSED'
      : report.status === 'regression'
        ? 'REGRESSION'
        : 'BLOCKED';
  const metricRows = (Object.keys(METRIC_RULES) as EvalReleaseGateMetric[]).map((metric) => {
    const result = report.metrics[metric];
    return `| ${result.label} | ${formatMetric(result.baseline)} | ${formatMetric(result.current)} | ${formatDelta(result.delta)} | ${formatMetric(result.allowedRegression)} | ${result.status} |`;
  });
  const coverage =
    report.coverage.differences.length > 0
      ? report.coverage.differences.map((difference) => `- ${difference}`)
      : ['- Matrix coverage matches and both scorecards are complete.'];
  return [
    '# Eval release gate',
    '',
    `**Status: ${statusLabel}**`,
    '',
    `- Baseline: \`${report.baselinePath}\``,
    `- Current: \`${report.currentPath}\``,
    `- Generated: ${report.generatedAt}`,
    '',
    '## Metric diff',
    '',
    '| Metric | Baseline | Current | Delta | Allowed regression | Status |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    ...metricRows,
    '',
    'Delta is `current - baseline`. Fidelity and reuse are higher-is-better; craft blocking findings are lower-is-better.',
    '',
    '## Coverage',
    '',
    ...coverage,
    '',
  ].join('\n');
}

function compareMetric(
  metric: EvalReleaseGateMetric,
  baseline: number | null,
  current: number | null,
  thresholds: EvalReleaseGateThresholds,
): EvalReleaseGateMetricResult {
  const rule = METRIC_RULES[metric];
  const allowedRegression = thresholds[rule.threshold];
  if (baseline === null || current === null) {
    return {
      metric,
      label: rule.label,
      direction: rule.direction,
      baseline,
      current,
      delta: null,
      allowedRegression,
      status: 'insufficient_data',
      detail: `${rule.label} requires numeric values in both scorecards.`,
    };
  }
  const delta = roundMetric(current - baseline);
  const regressionAmount =
    rule.direction === 'higher-is-better' ? baseline - current : current - baseline;
  const regression = regressionAmount > allowedRegression + Number.EPSILON;
  return {
    metric,
    label: rule.label,
    direction: rule.direction,
    baseline,
    current,
    delta,
    allowedRegression,
    status: regression ? 'regression' : 'passed',
    detail: regression
      ? `${rule.label} regressed by ${roundMetric(regressionAmount)}, above the allowed ${allowedRegression}.`
      : `${rule.label} is within the allowed regression budget.`,
  };
}

function compareCoverage(baseline: EvalScorecardForGate, current: EvalScorecardForGate): string[] {
  const differences: string[] = [];
  validateCompleteMatrix('Baseline', baseline.totals, differences);
  validateCompleteMatrix('Current', current.totals, differences);
  if (baseline.totals.cells !== current.totals.cells) {
    differences.push(
      `Matrix cell count changed: baseline ${baseline.totals.cells}, current ${current.totals.cells}.`,
    );
  }
  for (const [label, baselineGroup, currentGroup] of [
    ['fixture', baseline.byFixture, current.byFixture],
    ['profile', baseline.byProfile, current.byProfile],
    ['model', baseline.byModel, current.byModel],
  ] as const) {
    compareCoverageGroup(label, baselineGroup, currentGroup, differences);
  }
  return differences;
}

function validateCompleteMatrix(
  label: string,
  counts: EvalScorecardCounts,
  differences: string[],
): void {
  if (counts.cells <= 0) differences.push(`${label} scorecard has no eval cells.`);
  if (counts.completed !== counts.cells || counts.failed > 0 || counts.planned > 0) {
    differences.push(
      `${label} scorecard is incomplete: ${counts.completed}/${counts.cells} completed, ${counts.failed} failed, ${counts.planned} planned.`,
    );
  }
}

function compareCoverageGroup(
  label: string,
  baseline: Record<string, EvalScorecardCounts>,
  current: Record<string, EvalScorecardCounts>,
  differences: string[],
): void {
  const keys = [...new Set([...Object.keys(baseline), ...Object.keys(current)])].sort();
  for (const key of keys) {
    const baselineCells = baseline[key]?.cells ?? null;
    const currentCells = current[key]?.cells ?? null;
    if (baselineCells !== currentCells) {
      differences.push(
        `${capitalize(label)} coverage changed for "${key}": baseline ${baselineCells ?? 'missing'}, current ${currentCells ?? 'missing'}.`,
      );
    }
  }
}

function parseScorecard(value: unknown, label: string): EvalScorecardForGate {
  if (!value || typeof value !== 'object') throw new Error(`Invalid ${label} scorecard.`);
  const scorecard = value as Partial<EvalScorecardForGate>;
  if (
    typeof scorecard.generatedAt !== 'string' ||
    !isCounts(scorecard.totals) ||
    !isCountsRecord(scorecard.byProfile) ||
    !isCountsRecord(scorecard.byModel) ||
    !isCountsRecord(scorecard.byFixture) ||
    !scorecard.averages ||
    typeof scorecard.averages !== 'object'
  ) {
    throw new Error(`Invalid ${label} scorecard.`);
  }
  const averages = scorecard.averages as Record<string, unknown>;
  for (const metric of Object.keys(METRIC_RULES) as EvalReleaseGateMetric[]) {
    const value = averages[metric];
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
      throw new Error(`Invalid ${label} scorecard metric "${metric}".`);
    }
  }
  return scorecard as EvalScorecardForGate;
}

function isCounts(value: unknown): value is EvalScorecardCounts {
  if (!value || typeof value !== 'object') return false;
  const counts = value as Partial<EvalScorecardCounts>;
  return [counts.cells, counts.completed, counts.failed, counts.planned].every(
    (count) => typeof count === 'number' && Number.isInteger(count) && count >= 0,
  );
}

function isCountsRecord(value: unknown): value is Record<string, EvalScorecardCounts> {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    Object.values(value).every((counts) => isCounts(counts))
  );
}

function normalizeThresholds(
  thresholds: Partial<EvalReleaseGateThresholds> | undefined,
): EvalReleaseGateThresholds {
  const normalized = { ...DEFAULT_EVAL_RELEASE_GATE_THRESHOLDS, ...thresholds };
  for (const [key, value] of Object.entries(normalized)) {
    if (!Number.isFinite(value) || value < 0)
      throw new Error(`Invalid release-gate threshold ${key}.`);
  }
  return normalized;
}

function formatMetric(value: number | null): string {
  return value === null ? '—' : String(roundMetric(value));
}

function formatDelta(value: number | null): string {
  if (value === null) return '—';
  const rounded = roundMetric(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function displayPath(path: string): string {
  const workspaceRelative = relative(process.cwd(), path).replace(/\\/gu, '/');
  return workspaceRelative && !workspaceRelative.startsWith('../') ? workspaceRelative : path;
}

export function parseEvalReleaseGateArgs(args: string[]): RunEvalReleaseGateInput {
  const input: Partial<RunEvalReleaseGateInput> = {};
  const thresholds: Partial<EvalReleaseGateThresholds> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = () => {
      index += 1;
      if (index >= args.length) throw new Error(`${arg} requires a value`);
      return args[index]!;
    };
    if (arg === '--baseline') input.baselinePath = next();
    else if (arg === '--current') input.currentPath = next();
    else if (arg === '--output') input.outputDir = next();
    else if (arg === '--max-fidelity-drop') thresholds.maxFidelityDrop = Number(next());
    else if (arg === '--max-reuse-drop') thresholds.maxReuseDrop = Number(next());
    else if (arg === '--max-craft-increase') thresholds.maxCraftIncrease = Number(next());
    else if (arg === '--help' || arg === '-h') throw new Error(usage());
    else throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
  }
  if (!input.baselinePath || !input.currentPath) throw new Error(usage());
  return {
    baselinePath: input.baselinePath,
    currentPath: input.currentPath,
    ...(input.outputDir ? { outputDir: input.outputDir } : {}),
    ...(Object.keys(thresholds).length > 0 ? { thresholds } : {}),
  };
}

function usage(): string {
  return [
    'Usage: bun run eval:release-gate --baseline <scorecard.json> --current <scorecard.json> [options]',
    '',
    'Options:',
    '  --output <path>              Output directory for eval-diff.json and eval-diff.md',
    '  --max-fidelity-drop <n>      Default 0.02',
    '  --max-reuse-drop <n>         Default 0.05',
    '  --max-craft-increase <n>     Default 0',
  ].join('\n');
}

if (import.meta.main) {
  try {
    const result = await runEvalReleaseGate(parseEvalReleaseGateArgs(process.argv.slice(2)));
    console.log(`eval release gate: ${result.report.status}`);
    console.log(`eval diff JSON: ${result.jsonPath}`);
    console.log(`eval diff Markdown: ${result.markdownPath}`);
    process.exitCode = evalReleaseGateExitCode(result.report.status);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
