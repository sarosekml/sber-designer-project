import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import type { AgentRuntimeKind } from './types';

export const RUNTIME_TRACE_CONTRACT_VERSION = 1;

const RUNTIME_ORDER: AgentRuntimeKind[] = ['claude-code', 'codex', 'gigacode', 'kimi', 'opencode'];

const RUNTIME_TRACE_STDOUT_FILES: Record<AgentRuntimeKind, string> = {
  'claude-code': 'stdout.stream-jsonl',
  codex: 'stdout.jsonl',
  gigacode: 'stdout.stream-jsonl',
  kimi: 'stdout.stream-jsonl',
  opencode: 'stdout.jsonl',
};

export interface RuntimeTraceMeta {
  version: typeof RUNTIME_TRACE_CONTRACT_VERSION;
  runtime: AgentRuntimeKind;
  command: string;
  argsSnapshot: string[];
  exitCode: number;
  durationMs?: number;
  notes?: string;
}

export interface RuntimeTraceFixture {
  id: string;
  dir: string;
  runtime: AgentRuntimeKind;
  meta: RuntimeTraceMeta;
  stdoutPath: string;
  stderrPath?: string;
}

export type RuntimeTraceOutcome = 'success' | 'error' | 'timeout' | 'needs_review';

export interface RuntimeTraceManifestEntry {
  traceId: string;
  runtime: AgentRuntimeKind;
  outcome: RuntimeTraceOutcome;
  sha256: string;
  bytes: number;
  skills: string[];
  multiTurn: boolean;
  captured: 'manual' | 'recorded';
  protocol: string;
  anonymization: 'none' | 'redacted';
}

export interface RuntimeTraceManifest {
  version: typeof RUNTIME_TRACE_CONTRACT_VERSION;
  traces: RuntimeTraceManifestEntry[];
}

export function runtimeTraceStdoutFile(runtime: string): string {
  if (!isAgentRuntimeKind(runtime)) {
    throw new Error(`Unsupported runtime trace runtime: ${formatValue(runtime)}`);
  }

  return RUNTIME_TRACE_STDOUT_FILES[runtime];
}

export function loadRuntimeTraceFixture(dir: string): RuntimeTraceFixture {
  const traceId = basename(dir);
  const runtimeDir = basename(dirname(dir));

  if (!traceId) {
    throw new Error(`Runtime trace fixture path has no trace id: ${dir}`);
  }

  if (!isAgentRuntimeKind(runtimeDir)) {
    throw new Error(`Runtime trace fixture parent directory is not a known runtime: ${runtimeDir}`);
  }

  const meta = readRuntimeTraceMeta(join(dir, 'meta.json'));
  if (meta.runtime !== runtimeDir) {
    throw new Error(
      `Runtime trace fixture ${runtimeDir}/${traceId} meta runtime ${meta.runtime} does not match directory ${runtimeDir}`,
    );
  }

  const stdoutPath = join(dir, runtimeTraceStdoutFile(runtimeDir));
  assertReadableFile(
    stdoutPath,
    `Runtime trace fixture ${runtimeDir}/${traceId} is missing stdout trace`,
  );
  if (readFileSync(stdoutPath, 'utf8').length === 0) {
    throw new Error(`Runtime trace fixture ${runtimeDir}/${traceId} stdout trace is empty`);
  }

  const stderrCandidate = join(dir, 'stderr.txt');
  const stderrPath = existsSync(stderrCandidate) ? stderrCandidate : undefined;
  if (stderrPath) {
    assertReadableFile(
      stderrPath,
      `Runtime trace fixture ${runtimeDir}/${traceId} has invalid stderr trace`,
    );
  }

  return {
    id: traceId,
    dir,
    runtime: runtimeDir,
    meta,
    stdoutPath,
    ...(stderrPath ? { stderrPath } : {}),
  };
}

export function listRuntimeTraceFixtures(root: string): RuntimeTraceFixture[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isAgentRuntimeKind(entry.name))
    .sort((left, right) => compareRuntimeKinds(left.name, right.name))
    .flatMap((runtimeEntry) => {
      const runtimeRoot = join(root, runtimeEntry.name);
      return readdirSync(runtimeRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((traceEntry) => loadRuntimeTraceFixture(join(runtimeRoot, traceEntry.name)));
    });
}

export function loadRuntimeTraceManifest(root: string): RuntimeTraceManifest {
  const manifestPath = join(root, 'manifest.json');
  assertReadableFile(manifestPath, `Runtime trace corpus is missing manifest.json`);

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Runtime trace manifest is invalid JSON: ${formatError(error)}`);
  }

  if (!isPlainObject(raw)) {
    throw new Error(`Runtime trace manifest must be a JSON object`);
  }
  if (raw.version !== RUNTIME_TRACE_CONTRACT_VERSION) {
    throw new Error(
      `Runtime trace manifest version must be ${RUNTIME_TRACE_CONTRACT_VERSION}, got ${formatValue(
        raw.version,
      )}`,
    );
  }
  if (!Array.isArray(raw.traces)) {
    throw new Error(`Runtime trace manifest traces must be an array`);
  }

  const traces = raw.traces.map((entry, index) => readManifestEntry(root, entry, index));
  const ids = new Set<string>();
  for (const trace of traces) {
    if (ids.has(trace.traceId)) {
      throw new Error(`Runtime trace manifest contains duplicate traceId: ${trace.traceId}`);
    }
    ids.add(trace.traceId);
  }

  return { version: RUNTIME_TRACE_CONTRACT_VERSION, traces };
}

function readRuntimeTraceMeta(path: string): RuntimeTraceMeta {
  assertReadableFile(path, `Runtime trace fixture is missing meta.json`);

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Runtime trace fixture meta.json is invalid JSON: ${formatError(error)}`);
  }

  if (!isPlainObject(raw)) {
    throw new Error(`Runtime trace fixture meta.json must be a JSON object`);
  }

  if (raw.version !== RUNTIME_TRACE_CONTRACT_VERSION) {
    throw new Error(
      `Runtime trace fixture meta.json version must be ${RUNTIME_TRACE_CONTRACT_VERSION}, got ${formatValue(
        raw.version,
      )}`,
    );
  }

  const runtime = raw.runtime;
  if (!isAgentRuntimeKind(runtime)) {
    throw new Error(`Runtime trace fixture meta.json runtime is invalid: ${formatValue(runtime)}`);
  }

  const command = raw.command;
  if (!isNonEmptyString(command)) {
    throw new Error(`Runtime trace fixture meta.json command must be a non-empty string`);
  }

  const argsSnapshot = raw.argsSnapshot;
  if (!isStringArray(argsSnapshot)) {
    throw new Error(`Runtime trace fixture meta.json argsSnapshot must be an array of strings`);
  }

  const exitCode = raw.exitCode;
  if (
    typeof exitCode !== 'number' ||
    !Number.isInteger(exitCode) ||
    exitCode < 0 ||
    exitCode > 255
  ) {
    throw new Error(`Runtime trace fixture meta.json exitCode must be an integer from 0 to 255`);
  }

  const durationMs = raw.durationMs;
  if (
    durationMs !== undefined &&
    (typeof durationMs !== 'number' || !Number.isInteger(durationMs) || durationMs < 0)
  ) {
    throw new Error(`Runtime trace fixture meta.json durationMs must be a non-negative integer`);
  }

  const notes = raw.notes;
  if (notes !== undefined && typeof notes !== 'string') {
    throw new Error(`Runtime trace fixture meta.json notes must be a string when present`);
  }

  return {
    version: RUNTIME_TRACE_CONTRACT_VERSION,
    runtime,
    command,
    argsSnapshot,
    exitCode,
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
}

function readManifestEntry(root: string, raw: unknown, index: number): RuntimeTraceManifestEntry {
  if (!isPlainObject(raw)) {
    throw new Error(`Runtime trace manifest entry ${index} must be an object`);
  }

  const traceId = raw.traceId;
  if (!isNonEmptyString(traceId) || traceId.includes('..') || traceId.startsWith('/')) {
    throw new Error(`Runtime trace manifest entry ${index} traceId is invalid`);
  }

  const runtime = raw.runtime;
  if (!isAgentRuntimeKind(runtime)) {
    throw new Error(`Runtime trace manifest entry ${traceId} runtime is invalid`);
  }

  const outcome = raw.outcome;
  if (!isRuntimeTraceOutcome(outcome)) {
    throw new Error(`Runtime trace manifest entry ${traceId} outcome is invalid`);
  }

  const sha256 = raw.sha256;
  if (!isSha256(sha256)) {
    throw new Error(`Runtime trace manifest entry ${traceId} sha256 is invalid`);
  }

  const bytes = raw.bytes;
  if (typeof bytes !== 'number' || !Number.isInteger(bytes) || bytes <= 0) {
    throw new Error(`Runtime trace manifest entry ${traceId} bytes must be a positive integer`);
  }

  const skills = raw.skills;
  if (!isStringArray(skills)) {
    throw new Error(`Runtime trace manifest entry ${traceId} skills must be an array of strings`);
  }

  const multiTurn = raw.multiTurn;
  if (typeof multiTurn !== 'boolean') {
    throw new Error(`Runtime trace manifest entry ${traceId} multiTurn must be a boolean`);
  }

  const captured = raw.captured;
  if (captured !== 'manual' && captured !== 'recorded') {
    throw new Error(`Runtime trace manifest entry ${traceId} captured is invalid`);
  }

  const protocol = raw.protocol;
  if (!isNonEmptyString(protocol)) {
    throw new Error(`Runtime trace manifest entry ${traceId} protocol must be a non-empty string`);
  }

  const anonymization = raw.anonymization;
  if (anonymization !== 'none' && anonymization !== 'redacted') {
    throw new Error(`Runtime trace manifest entry ${traceId} anonymization is invalid`);
  }

  const fixture = loadRuntimeTraceFixture(join(root, traceId));
  if (fixture.runtime !== runtime) {
    throw new Error(
      `Runtime trace manifest entry ${traceId} runtime ${runtime} does not match fixture ${fixture.runtime}`,
    );
  }

  const stdout = readFileSync(fixture.stdoutPath);
  const actualSha = createHash('sha256').update(stdout).digest('hex');
  if (actualSha !== sha256) {
    throw new Error(`Runtime trace manifest entry ${traceId} sha256 does not match stdout bytes`);
  }
  if (stdout.byteLength !== bytes) {
    throw new Error(`Runtime trace manifest entry ${traceId} bytes does not match stdout bytes`);
  }

  return {
    traceId,
    runtime,
    outcome,
    sha256,
    bytes,
    skills,
    multiTurn,
    captured,
    protocol,
    anonymization,
  };
}

function compareRuntimeKinds(left: string, right: string): number {
  return runtimeRank(left) - runtimeRank(right);
}

function runtimeRank(runtime: string): number {
  const index = RUNTIME_ORDER.indexOf(runtime as AgentRuntimeKind);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function assertReadableFile(path: string, message: string): void {
  if (!existsSync(path)) {
    throw new Error(`${message}: ${path}`);
  }

  if (!statSync(path).isFile()) {
    throw new Error(`${message}: ${path}`);
  }
}

function isAgentRuntimeKind(value: unknown): value is AgentRuntimeKind {
  return (
    value === 'claude-code' ||
    value === 'codex' ||
    value === 'gigacode' ||
    value === 'kimi' ||
    value === 'opencode'
  );
}

function isRuntimeTraceOutcome(value: unknown): value is RuntimeTraceOutcome {
  return (
    value === 'success' || value === 'error' || value === 'timeout' || value === 'needs_review'
  );
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatValue(value: unknown): string {
  return typeof value === 'string' ? `"${value}"` : String(value);
}
