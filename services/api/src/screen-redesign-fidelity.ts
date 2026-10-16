import { createHash } from 'node:crypto';
import type { RunRedesignFidelitySummary } from '@sber-designer/shared-types';

import {
  readAgentRunReceipts,
  recordToolReceiptSafely,
  type AgentRunManifest,
} from './agent/run-recorder';
import { readWorkspaceFile } from './safe-fs';

export interface ScreenPreservationInventory {
  version: 1;
  filePath: string;
  sections: string[];
  facts: string[];
  actions: string[];
  states: string[];
  routes: string[];
  compositionDigest: string;
}

export function buildScreenPreservationInventory(
  source: string,
  filePath: string,
): ScreenPreservationInventory {
  const textValues = unique([
    ...matches(source, />\s*([^<>{}\n][^<>{}]*)\s*</gu),
    ...matches(
      source,
      /\b(?:label|title|heading|caption|placeholder|aria-label|name|value|status)\s*[:=]\s*["'`]([^"'`]{2,120})["'`]/giu,
    ),
  ]).filter(isPreservedText);
  return {
    version: 1,
    filePath,
    sections: unique([
      ...matches(source, /<h[1-6][^>]*>\s*([^<>{}]+)\s*<\/h[1-6]>/giu),
      ...matches(source, /(?:sectionTitle|heading|title)\s*[:=]\s*["'`]([^"'`]{2,120})["'`]/giu),
    ]).filter(isPreservedText),
    facts: textValues,
    actions: unique([
      ...matches(source, /<(?:button|a)[^>]*>\s*([^<>{}]+)\s*<\/(?:button|a)>/giu),
      ...matches(source, /aria-label\s*=\s*["']([^"']+)["']/giu),
    ]).filter(isPreservedText),
    states: ['loading', 'empty', 'error', 'selected', 'disabled'].filter((state) =>
      new RegExp(`\\b${state}\\b`, 'iu').test(source),
    ),
    routes: unique(matches(source, /(?:href|to)\s*=\s*["']([^"']+)["']/giu)),
    compositionDigest: compositionDigest(source),
  };
}

export function compareScreenRedesignFidelity(
  before: ScreenPreservationInventory,
  after: ScreenPreservationInventory,
): RunRedesignFidelitySummary {
  const missingSections = missing(before.sections, after.sections);
  const missingFacts = missing(before.facts, [...after.sections, ...after.facts]);
  const missingActions = missing(before.actions, after.actions);
  const missingStates = missing(before.states, after.states);
  const missingRoutes = missing(before.routes, after.routes);
  const changedComposition = before.compositionDigest !== after.compositionDigest;
  const failed =
    !changedComposition ||
    missingSections.length > 0 ||
    missingFacts.length > 0 ||
    missingActions.length > 0 ||
    missingStates.length > 0 ||
    missingRoutes.length > 0;
  return {
    status: failed ? 'failed' : 'passed',
    changedComposition,
    missingSections,
    missingFacts,
    missingActions,
    missingStates,
    missingRoutes,
  };
}

export async function recordScreenRedesignBaseline(input: {
  workspacePath: string | null;
  runId: string | null | undefined;
  agentRun: AgentRunManifest | null;
  taskKind: string;
}): Promise<ScreenPreservationInventory | null> {
  if (
    input.taskKind !== 'screen-redesign' ||
    !input.workspacePath ||
    !input.runId ||
    !input.agentRun
  ) {
    return null;
  }
  const filePath = activeImplementationPath(input.agentRun);
  if (!filePath) return null;
  const source = await readWorkspaceFile(input.workspacePath, filePath).catch(() => null);
  if (!source) return null;
  const inventory = buildScreenPreservationInventory(source, filePath);
  await recordToolReceiptSafely({
    workspacePath: input.workspacePath,
    runId: input.runId,
    tool: 'screen_redesign_baseline',
    status: 'ok',
    changedFiles: [],
    summary: `Captured preservation inventory for ${filePath}.`,
    metadata: { preservationInventory: inventory },
  });
  return inventory;
}

export async function recordScreenRedesignFidelity(input: {
  workspacePath: string | null;
  agentRun: AgentRunManifest | null;
  taskKind: string | null | undefined;
}): Promise<RunRedesignFidelitySummary | null> {
  if (input.taskKind !== 'screen-redesign' || !input.workspacePath || !input.agentRun?.runId) {
    return null;
  }
  const receipts = await readAgentRunReceipts(input.workspacePath, input.agentRun.runId).catch(
    () => [],
  );
  const baseline = [...receipts]
    .filter((receipt) => receipt.tool === 'screen_redesign_baseline')
    .sort((left, right) => left.createdAt - right.createdAt)
    .at(-1)?.metadata.preservationInventory;
  const before = normalizeInventory(baseline);
  const filePath = activeImplementationPath(input.agentRun);
  const source = filePath
    ? await readWorkspaceFile(input.workspacePath, filePath).catch(() => null)
    : null;
  const result: RunRedesignFidelitySummary =
    before && source && filePath
      ? compareScreenRedesignFidelity(before, buildScreenPreservationInventory(source, filePath))
      : {
          status: 'unavailable',
          changedComposition: false,
          missingSections: [],
          missingFacts: [],
          missingActions: [],
          missingStates: [],
          missingRoutes: [],
        };
  await recordToolReceiptSafely({
    workspacePath: input.workspacePath,
    runId: input.agentRun.runId,
    tool: 'screen_redesign_fidelity',
    status: result.status === 'failed' ? 'error' : result.status === 'passed' ? 'ok' : 'skipped',
    changedFiles: filePath ? [filePath] : [],
    summary:
      result.status === 'passed'
        ? 'Redesign changed composition and preserved the screen contract.'
        : result.status === 'failed'
          ? 'Redesign fidelity failed: composition or preserved screen content was lost.'
          : 'Redesign fidelity could not be compared because its baseline was unavailable.',
    metadata: { redesignFidelity: result },
  });
  return result;
}

function activeImplementationPath(agentRun: AgentRunManifest): string | null {
  return agentRun.activeScreen?.implementationFilePath ?? agentRun.activeScreen?.filePath ?? null;
}

function normalizeInventory(value: unknown): ScreenPreservationInventory | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<ScreenPreservationInventory>;
  if (record.version !== 1 || typeof record.filePath !== 'string') return null;
  if (typeof record.compositionDigest !== 'string') return null;
  return {
    version: 1,
    filePath: record.filePath,
    sections: stringArray(record.sections),
    facts: stringArray(record.facts),
    actions: stringArray(record.actions),
    states: stringArray(record.states),
    routes: stringArray(record.routes),
    compositionDigest: record.compositionDigest,
  };
}

function compositionDigest(source: string): string {
  const tags = matches(source, /<([A-Za-z][\w.]*)\b[^>]*>/gu)
    .map((tag) => tag.toLowerCase())
    .join('>');
  const layoutTokens = matches(
    source,
    /(?:className|class)\s*=\s*["'`]([^"'`]*(?:grid|flex|column|row|stack|layout|panel)[^"'`]*)["'`]/giu,
  ).join('|');
  return createHash('sha256').update(`${tags}\n${layoutTokens}`).digest('hex');
}

function matches(source: string, pattern: RegExp): string[] {
  return Array.from(source.matchAll(pattern), (match) => normalizeText(match[1] ?? ''));
}

function missing(expected: string[], actual: string[]): string[] {
  const normalizedActual = actual.map(normalizeComparison);
  const actualCorpus = normalizedActual.join(' ');
  return expected.filter((value) => {
    const normalizedExpected = normalizeComparison(value);
    if (
      normalizedActual.some(
        (candidate) =>
          candidate === normalizedExpected ||
          candidate.includes(normalizedExpected) ||
          normalizedExpected.includes(candidate),
      )
    ) {
      return false;
    }
    const meaningfulTokens = normalizedExpected.split(' ').filter((token) => token.length > 1);
    return !(
      meaningfulTokens.length > 0 && meaningfulTokens.every((token) => actualCorpus.includes(token))
    );
  });
}

function normalizeComparison(value: string): string {
  return normalizeText(value)
    .toLocaleLowerCase()
    .replace(/ё/gu, 'е')
    .replace(/\bпл\b/giu, 'плательщик')
    .replace(/\bпол\b/giu, 'получатель')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function normalizeText(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function isPreservedText(value: string): boolean {
  if (value.length < 2 || value.length > 120) return false;
  return !/^(?:true|false|null|undefined|div|span|main|section)$/iu.test(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(normalizeText).filter(Boolean))];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
