import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveInside } from '@sber-designer/ast-bridge';

import { loadAgentKit, resetAgentKitCache } from '../../services/api/src/agent-kit/loader';
import { buildAgentKitHandoff } from '../../services/api/src/agent-runtimes/agent-kit-handoff';
import { completeAgentRun, createAgentRun } from '../../services/api/src/agent/run-record/manifest';
import { recordToolReceipt } from '../../services/api/src/agent/run-record/receipts';
import {
  ensureProjectPreferencesDerived,
  loadProjectStyleMemoryPrompt,
  PREFERENCE_EVENTS_PATH,
  PROJECT_PREFERENCES_PATH,
} from '../../services/api/src/project-preferences';
import { buildSystemPrompt } from '../../services/api/src/prompt-builder';
import { patchState, resetState } from '../../services/api/src/state-store';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE_PATH = join(
  SCRIPT_DIR,
  '..',
  'fixtures',
  '0114-style-memory',
  'fixture.json',
);

interface StyleMemoryEvalFixtureScreen {
  id: string;
  name: string;
  targetPath: string;
  before: string;
  after: string;
}

interface StyleMemoryEvalFixture {
  version: 1;
  expectedRule: string;
  screens: StyleMemoryEvalFixtureScreen[];
}

export interface StyleMemoryEvalChecks {
  twoDensityFollowUpEvents: boolean;
  mediumPreferenceDerived: boolean;
  apiGenerationPromptContainsRule: boolean;
  cliGenerationPromptContainsRule: boolean;
  cliStableDigestChanged: boolean;
}

export interface StyleMemoryEvalRecord {
  version: 1;
  id: string;
  createdAt: string;
  status: 'passed' | 'failed';
  fixturePath: string;
  workspacePath: string;
  expectedRule: string;
  baselineRunIds: string[];
  followUpRunIds: string[];
  checks: StyleMemoryEvalChecks;
  evidence: {
    preferenceEventsPath: string;
    preferencesPath: string;
    rawEventCount: number;
    derivedConfidence: string | null;
    cliStableDigestBefore: string;
    cliStableDigestAfter: string;
  };
}

export interface StyleMemoryEvalScorecard {
  version: 1;
  generatedAt: string;
  totals: { scenarios: 1; passed: number; failed: number };
  checks: StyleMemoryEvalChecks;
}

export interface RunStyleMemoryEvalInput {
  fixturePath?: string;
  outputDir?: string;
  createdAt?: string;
}

export interface RunStyleMemoryEvalResult {
  record: StyleMemoryEvalRecord;
  scorecard: StyleMemoryEvalScorecard;
  workspacePath: string;
  recordsPath: string;
  scorecardPath: string;
}

/**
 * CI-safe B4 eval. It exercises real run finalization, receipts, automatic
 * signals, derivation, and API/CLI prompt builders without calling an LLM.
 */
export async function runStyleMemoryEval(
  input: RunStyleMemoryEvalInput = {},
): Promise<RunStyleMemoryEvalResult> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const fixturePath = input.fixturePath ?? DEFAULT_FIXTURE_PATH;
  const fixture = await readFixture(fixturePath);
  const fixtureRoot = dirname(fixturePath);
  const workspacePath = await mkdtemp(join(tmpdir(), 'sd-0114-style-memory-eval-'));
  const batchId = `0114-style-memory-${createdAt.replace(/[:.]/gu, '-')}`;
  const outputDir = input.outputDir ?? join(tmpdir(), 'sber-designer-eval', batchId);
  const baselineRunIds: string[] = [];
  const followUpRunIds: string[] = [];

  for (const screen of fixture.screens) {
    const before = await readFile(resolveInside(fixtureRoot, screen.before), 'utf8');
    const after = await readFile(resolveInside(fixtureRoot, screen.after), 'utf8');
    const baselineRunId = await completeFixtureBaseline({ workspacePath, screen, source: before });
    const followUpRunId = await completeFixtureFollowUp({ workspacePath, screen, source: after });
    baselineRunIds.push(baselineRunId);
    followUpRunIds.push(followUpRunId);
  }

  const [eventsSource, preferences, promptEvidence] = await Promise.all([
    readFile(join(workspacePath, PREFERENCE_EVENTS_PATH), 'utf8'),
    ensureProjectPreferencesDerived(workspacePath),
    buildThirdRunPromptEvidence(workspacePath),
  ]);
  const events = jsonLines(eventsSource);
  const densityEvents = events.filter(
    (event) =>
      event.type === 'follow_up_edit' &&
      Array.isArray(event.changed_categories) &&
      event.changed_categories.includes('density'),
  );
  const expectedEntry = preferences.entries.find(
    (entry) => entry.kind === 'prefer' && entry.text === fixture.expectedRule,
  );
  const checks: StyleMemoryEvalChecks = {
    twoDensityFollowUpEvents: densityEvents.length === 2 && events.length === 2,
    mediumPreferenceDerived: expectedEntry?.signals === 2 && expectedEntry.confidence === 'medium',
    apiGenerationPromptContainsRule: promptEvidence.apiPrompt.includes(fixture.expectedRule),
    cliGenerationPromptContainsRule: promptEvidence.cliPrompt.includes(fixture.expectedRule),
    cliStableDigestChanged:
      promptEvidence.cliStableDigestBefore !== promptEvidence.cliStableDigestAfter,
  };
  const passed = Object.values(checks).every(Boolean);
  const record: StyleMemoryEvalRecord = {
    version: 1,
    id: batchId,
    createdAt,
    status: passed ? 'passed' : 'failed',
    fixturePath,
    workspacePath,
    expectedRule: fixture.expectedRule,
    baselineRunIds,
    followUpRunIds,
    checks,
    evidence: {
      preferenceEventsPath: join(workspacePath, PREFERENCE_EVENTS_PATH),
      preferencesPath: join(workspacePath, PROJECT_PREFERENCES_PATH),
      rawEventCount: events.length,
      derivedConfidence: expectedEntry?.confidence ?? null,
      cliStableDigestBefore: promptEvidence.cliStableDigestBefore,
      cliStableDigestAfter: promptEvidence.cliStableDigestAfter,
    },
  };
  const scorecard: StyleMemoryEvalScorecard = {
    version: 1,
    generatedAt: createdAt,
    totals: { scenarios: 1, passed: passed ? 1 : 0, failed: passed ? 0 : 1 },
    checks,
  };
  await mkdir(outputDir, { recursive: true });
  const recordsPath = join(outputDir, 'records.jsonl');
  const scorecardPath = join(outputDir, 'scorecard.json');
  await Promise.all([
    writeFile(recordsPath, `${JSON.stringify(record)}\n`, 'utf8'),
    writeFile(scorecardPath, `${JSON.stringify(scorecard, null, 2)}\n`, 'utf8'),
  ]);
  return { record, scorecard, workspacePath, recordsPath, scorecardPath };
}

async function completeFixtureBaseline(input: {
  workspacePath: string;
  screen: StyleMemoryEvalFixtureScreen;
  source: string;
}): Promise<string> {
  const run = await createAgentRun({
    route: 'manual',
    user: '0114-style-memory-eval',
    provider: 'deterministic-fixture',
    model: 'none',
    workspacePath: input.workspacePath,
    activeScreen: activeScreen(input.screen),
    assistantTaskIntent: {
      kind: 'fill-generated-screen',
      targetScreenId: input.screen.id,
      targetName: input.screen.name,
      targetFolder: 'Eval',
      targetStoryFilePath: input.screen.targetPath.replace(/\.tsx$/u, '.stories.tsx'),
      targetImplementationFilePath: input.screen.targetPath,
      targetStoryId: `eval-${input.screen.id}--default`,
    },
  });
  await writeTargetAndReceipt(
    input.workspacePath,
    run.runId,
    input.screen.targetPath,
    input.source,
  );
  await completeAgentRun({
    workspacePath: input.workspacePath,
    runId: run.runId,
    status: 'complete',
    summary: 'Deterministic baseline generated.',
  });
  return run.runId;
}

async function completeFixtureFollowUp(input: {
  workspacePath: string;
  screen: StyleMemoryEvalFixtureScreen;
  source: string;
}): Promise<string> {
  const run = await createAgentRun({
    route: 'manual',
    user: '0114-style-memory-eval',
    provider: 'deterministic-fixture',
    model: 'none',
    workspacePath: input.workspacePath,
    activeScreen: activeScreen(input.screen),
    assistantTaskIntent: { kind: 'edit-current-screen', targetScreenId: input.screen.id },
  });
  await writeTargetAndReceipt(
    input.workspacePath,
    run.runId,
    input.screen.targetPath,
    input.source,
  );
  await completeAgentRun({
    workspacePath: input.workspacePath,
    runId: run.runId,
    status: 'complete',
    summary: 'Deterministic density follow-up applied.',
  });
  return run.runId;
}

async function writeTargetAndReceipt(
  workspacePath: string,
  runId: string,
  targetPath: string,
  source: string,
): Promise<void> {
  const absoluteTarget = resolveInside(workspacePath, targetPath);
  await mkdir(dirname(absoluteTarget), { recursive: true });
  await writeFile(absoluteTarget, source, 'utf8');
  await recordToolReceipt({
    workspacePath,
    runId,
    tool: 'fixture_write_file',
    status: 'ok',
    changedFiles: [targetPath],
    summary: 'Deterministic eval source write.',
  });
}

async function buildThirdRunPromptEvidence(workspacePath: string): Promise<{
  apiPrompt: string;
  cliPrompt: string;
  cliStableDigestBefore: string;
  cliStableDigestAfter: string;
}> {
  resetState();
  resetAgentKitCache();
  try {
    patchState({ workspacePath, projectName: '0114 style-memory eval' });
    const apiPrompt = await buildSystemPrompt({ taskKind: 'screen-generation' });
    const projectStyleMemory = await loadProjectStyleMemoryPrompt(
      workspacePath,
      'screen-generation',
    );
    const kit = await loadAgentKit();
    const handoffInput = {
      runtime: 'codex' as const,
      runtimeLabel: 'Codex CLI',
      model: null,
      messages: [{ role: 'user', content: 'Generate the third evaluation screen.' }],
      state: { workspacePath, projectName: '0114 style-memory eval' },
      kit,
      primaryAgentName: 'ai-product-designer',
      agentRunId: '0114-style-memory-third-run',
    };
    const withoutMemory = buildAgentKitHandoff(handoffInput);
    const withMemory = buildAgentKitHandoff({ ...handoffInput, projectStyleMemory });
    return {
      apiPrompt: apiPrompt.text,
      cliPrompt: withMemory.prompt,
      cliStableDigestBefore: withoutMemory.stableContextDigest,
      cliStableDigestAfter: withMemory.stableContextDigest,
    };
  } finally {
    resetState();
    resetAgentKitCache();
  }
}

function activeScreen(screen: StyleMemoryEvalFixtureScreen) {
  return {
    id: screen.id,
    name: screen.name,
    kind: 'page',
    filePath: screen.targetPath,
    implementationFilePath: screen.targetPath,
  };
}

async function readFixture(path: string): Promise<StyleMemoryEvalFixture> {
  const value = JSON.parse(await readFile(path, 'utf8')) as Partial<StyleMemoryEvalFixture>;
  if (
    value.version !== 1 ||
    typeof value.expectedRule !== 'string' ||
    !Array.isArray(value.screens) ||
    value.screens.length !== 2 ||
    !value.screens.every(isFixtureScreen)
  ) {
    throw new Error(`Invalid 0114 style-memory eval fixture: ${path}`);
  }
  return value as StyleMemoryEvalFixture;
}

function isFixtureScreen(value: unknown): value is StyleMemoryEvalFixtureScreen {
  if (!value || typeof value !== 'object') return false;
  const screen = value as Partial<StyleMemoryEvalFixtureScreen>;
  return (
    typeof screen.id === 'string' &&
    typeof screen.name === 'string' &&
    typeof screen.targetPath === 'string' &&
    screen.targetPath.endsWith('.tsx') &&
    typeof screen.before === 'string' &&
    typeof screen.after === 'string'
  );
}

function jsonLines(source: string): Array<Record<string, unknown>> {
  return source
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function parseArgs(args: string[]): RunStyleMemoryEvalInput {
  const input: RunStyleMemoryEvalInput = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = () => {
      index += 1;
      if (index >= args.length) throw new Error(`${arg} requires a value`);
      return args[index]!;
    };
    if (arg === '--fixture') input.fixturePath = next();
    else if (arg === '--output') input.outputDir = next();
    else if (arg === '--help' || arg === '-h') throw new Error(usage());
    else throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
  }
  return input;
}

function usage(): string {
  return [
    'Usage: bun run eval:style-memory [options]',
    '',
    'Options:',
    '  --fixture <path>  Style-memory fixture.json override',
    '  --output <path>   Output directory for records.jsonl and scorecard.json',
  ].join('\n');
}

if (import.meta.main) {
  try {
    const result = await runStyleMemoryEval(parseArgs(process.argv.slice(2)));
    console.log(`style-memory eval: ${result.record.status}`);
    console.log(`eval records: ${result.recordsPath}`);
    console.log(`eval scorecard: ${result.scorecardPath}`);
    console.log(`eval workspace: ${result.workspacePath}`);
    if (result.record.status !== 'passed') process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
