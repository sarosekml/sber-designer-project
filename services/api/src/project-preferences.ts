import { createHash } from 'node:crypto';

import type { TaskRelevantComponentPack } from './component-intelligence/component-pack';
import { readWorkspaceFile, writeWorkspaceFile } from './safe-fs';

export const PROJECT_PREFERENCES_ROOT = '.sber-designer/preferences';
export const PREFERENCE_EVENTS_PATH = `${PROJECT_PREFERENCES_ROOT}/events.jsonl`;
export const PROJECT_PREFERENCES_PATH = `${PROJECT_PREFERENCES_ROOT}/preferences.md`;

export const MAX_PROJECT_STYLE_MEMORY_LINES = 8;

const DERIVED_START = '<!-- sber-designer:project-style-memory:start -->';
const DERIVED_END = '<!-- sber-designer:project-style-memory:end -->';
const MAX_PROMPT_CHARS = 6_000;

type ProjectStyleMemoryTaskKind = TaskRelevantComponentPack['taskKind'];
type PreferenceSentiment = 'accept' | 'reject';

interface RunFeedbackPreferenceEvent {
  version: 1;
  type: 'run_feedback';
  created_at: string;
  run_id: string;
  sentiment: PreferenceSentiment;
  reason: string | null;
}

interface AutomaticSourcePreferenceEvent {
  version: 1;
  type: 'follow_up_edit' | 'source_revert';
  created_at: string;
  run_id: string;
  reverted_run_id: string | null;
  preference: {
    kind: 'prefer' | 'avoid';
    text: string;
  } | null;
}

type ProjectPreferenceEvent = RunFeedbackPreferenceEvent | AutomaticSourcePreferenceEvent;

export interface ProjectStyleMemoryEntry {
  kind: 'prefer' | 'avoid';
  text: string;
  signals: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface ProjectStyleMemorySnapshot {
  entries: ProjectStyleMemoryEntry[];
  markdown: string;
  promptBlock: string;
  sourceDigest: string;
}

/** Targeted edits collect evidence, but memory is injected only into broad screen work. */
export function supportsProjectStyleMemory(taskKind: ProjectStyleMemoryTaskKind): boolean {
  return (
    taskKind === 'screen-generation' ||
    taskKind === 'screen-redesign' ||
    taskKind === 'image-to-screen'
  );
}

/**
 * Rebuild the managed section from the append-only event log while preserving
 * every user-owned line outside the managed markers.
 */
export async function ensureProjectPreferencesDerived(
  workspacePath: string,
): Promise<ProjectStyleMemorySnapshot> {
  const [eventsSource, currentMarkdown] = await Promise.all([
    readWorkspaceFile(workspacePath, PREFERENCE_EVENTS_PATH).catch(() => ''),
    readWorkspaceFile(workspacePath, PROJECT_PREFERENCES_PATH).catch(() => ''),
  ]);
  const entries = deriveProjectStyleMemoryEntries(eventsSource);
  const sourceDigest = digestEntries(entries);
  if (!eventsSource.trim() && !currentMarkdown.trim()) {
    return { entries, markdown: '', promptBlock: '', sourceDigest };
  }
  const managedBlock = renderManagedBlock(entries, sourceDigest);
  const markdown = mergeManagedBlock(currentMarkdown, managedBlock);

  if (markdown !== currentMarkdown) {
    await writeWorkspaceFile(workspacePath, PROJECT_PREFERENCES_PATH, markdown);
  }

  return {
    entries,
    markdown,
    promptBlock: renderProjectStyleMemoryPrompt(entries, manualPreferenceContent(markdown)),
    sourceDigest,
  };
}

/** Load the compact block used by API prompts and CLI stable handoffs. */
export async function loadProjectStyleMemoryPrompt(
  workspacePath: string | null | undefined,
  taskKind: ProjectStyleMemoryTaskKind,
  options: { enabled?: boolean } = {},
): Promise<string> {
  if (!workspacePath || options.enabled === false || !supportsProjectStyleMemory(taskKind)) {
    return '';
  }
  const snapshot = await ensureProjectPreferencesDerived(workspacePath).catch(() => null);
  return snapshot?.promptBlock ?? '';
}

export function deriveProjectStyleMemoryEntries(eventsSource: string): ProjectStyleMemoryEntry[] {
  const latestByRun = new Map<string, { event: RunFeedbackPreferenceEvent; order: number }>();
  const automaticEvents: Array<{ event: AutomaticSourcePreferenceEvent; order: number }> = [];
  const lines = eventsSource.split(/\r?\n/u);
  for (const [order, line] of lines.entries()) {
    const event = parsePreferenceEvent(line);
    if (!event) continue;
    if (event.type === 'run_feedback') latestByRun.set(event.run_id, { event, order });
    else automaticEvents.push({ event, order });
  }

  const revertedAutomaticRunIds = new Set(
    automaticEvents
      .filter(({ event }) => event.type === 'source_revert' && event.reverted_run_id)
      .map(({ event }) => event.reverted_run_id as string),
  );
  const signals: Array<{
    runId: string;
    kind: ProjectStyleMemoryEntry['kind'];
    text: string;
    order: number;
    createdAt: string;
  }> = [];
  for (const { event, order } of latestByRun.values()) {
    const text = normalizePreferenceText(event.reason);
    if (!text) continue;
    signals.push({
      runId: event.run_id,
      kind: event.sentiment === 'accept' ? 'prefer' : 'avoid',
      text,
      order,
      createdAt: event.created_at,
    });
  }
  for (const { event, order } of automaticEvents) {
    if (!event.preference || revertedAutomaticRunIds.has(event.run_id)) continue;
    const text = normalizePreferenceText(event.preference.text);
    if (!text) continue;
    signals.push({
      runId: event.run_id,
      kind: event.preference.kind,
      text,
      order,
      createdAt: event.created_at,
    });
  }

  const grouped = new Map<
    string,
    {
      kind: ProjectStyleMemoryEntry['kind'];
      text: string;
      signals: number;
      runIds: Set<string>;
      lastOrder: number;
      lastCreatedAt: string;
    }
  >();
  for (const signal of signals) {
    const key = `${signal.kind}:${normalizePreferenceKey(signal.text)}`;
    const current = grouped.get(key);
    if (current?.runIds.has(signal.runId)) continue;
    grouped.set(key, {
      kind: signal.kind,
      text: signal.text,
      signals: (current?.signals ?? 0) + 1,
      runIds: new Set([...(current?.runIds ?? []), signal.runId]),
      lastOrder: Math.max(current?.lastOrder ?? -1, signal.order),
      lastCreatedAt:
        !current || signal.createdAt >= current.lastCreatedAt
          ? signal.createdAt
          : current.lastCreatedAt,
    });
  }

  return [...grouped.values()]
    .sort(
      (left, right) =>
        right.signals - left.signals ||
        right.lastCreatedAt.localeCompare(left.lastCreatedAt) ||
        right.lastOrder - left.lastOrder ||
        left.text.localeCompare(right.text),
    )
    .slice(0, MAX_PROJECT_STYLE_MEMORY_LINES)
    .map(({ kind, text, signals }) => ({
      kind,
      text,
      signals,
      confidence: confidenceForSignals(signals),
    }));
}

function parsePreferenceEvent(line: string): ProjectPreferenceEvent | null {
  if (!line.trim()) return null;
  try {
    const value = JSON.parse(line) as Record<string, unknown>;
    if (
      value.version === 1 &&
      (value.type === 'follow_up_edit' || value.type === 'source_revert') &&
      typeof value.created_at === 'string' &&
      typeof value.run_id === 'string' &&
      value.run_id.trim() &&
      (value.reverted_run_id === null ||
        value.reverted_run_id === undefined ||
        typeof value.reverted_run_id === 'string')
    ) {
      const preference = parseAutomaticPreferenceCandidate(value.preference);
      if (value.preference !== null && value.preference !== undefined && !preference) return null;
      return {
        version: 1,
        type: value.type,
        created_at: value.created_at,
        run_id: value.run_id,
        reverted_run_id: typeof value.reverted_run_id === 'string' ? value.reverted_run_id : null,
        preference,
      };
    }
    if (
      value.version !== 1 ||
      value.type !== 'run_feedback' ||
      typeof value.created_at !== 'string' ||
      typeof value.run_id !== 'string' ||
      !value.run_id.trim() ||
      (value.sentiment !== 'accept' && value.sentiment !== 'reject') ||
      (value.reason !== null && value.reason !== undefined && typeof value.reason !== 'string')
    ) {
      return null;
    }
    return {
      version: 1,
      type: 'run_feedback',
      created_at: value.created_at,
      run_id: value.run_id,
      sentiment: value.sentiment,
      reason: typeof value.reason === 'string' ? value.reason : null,
    };
  } catch {
    return null;
  }
}

function parseAutomaticPreferenceCandidate(
  value: unknown,
): AutomaticSourcePreferenceEvent['preference'] {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { kind?: unknown; text?: unknown };
  if (
    (candidate.kind !== 'prefer' && candidate.kind !== 'avoid') ||
    typeof candidate.text !== 'string' ||
    !candidate.text.trim()
  ) {
    return null;
  }
  return { kind: candidate.kind, text: candidate.text };
}

function normalizePreferenceText(reason: string | null): string | null {
  if (!reason) return null;
  const normalized = replaceControlCharacters(reason)
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/u, '')
    .replace(/\s+/gu, ' ')
    .trim();
  return normalized || null;
}

function replaceControlCharacters(value: string): string {
  return [...value]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code <= 31 || code === 127 ? ' ' : character;
    })
    .join('');
}

function normalizePreferenceKey(text: string): string {
  return text
    .toLocaleLowerCase('en-US')
    .replace(/[.!?;:,]+$/u, '')
    .trim();
}

function confidenceForSignals(signals: number): ProjectStyleMemoryEntry['confidence'] {
  if (signals >= 3) return 'high';
  if (signals === 2) return 'medium';
  return 'low';
}

function digestEntries(entries: ProjectStyleMemoryEntry[]): string {
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}

function renderManagedBlock(entries: ProjectStyleMemoryEntry[], sourceDigest: string): string {
  const prefer = entries.filter((entry) => entry.kind === 'prefer');
  const avoid = entries.filter((entry) => entry.kind === 'avoid');
  return [
    DERIVED_START,
    '## Project style memory',
    '',
    '_Managed by sber-designer from explicit feedback and deterministic source comparisons._',
    `<!-- source-digest: ${sourceDigest} -->`,
    '',
    '### Prefer',
    '',
    ...(prefer.length > 0 ? prefer.map(renderEntry) : ['_No learned preferences yet._']),
    '',
    '### Avoid',
    '',
    ...(avoid.length > 0 ? avoid.map(renderEntry) : ['_No learned avoid rules yet._']),
    DERIVED_END,
  ].join('\n');
}

function renderEntry(entry: ProjectStyleMemoryEntry): string {
  const signalLabel = entry.signals === 1 ? 'signal' : 'signals';
  return `- [${entry.confidence} · ${entry.signals} ${signalLabel}] ${entry.text}`;
}

function mergeManagedBlock(currentMarkdown: string, managedBlock: string): string {
  const start = currentMarkdown.indexOf(DERIVED_START);
  const end = currentMarkdown.indexOf(DERIVED_END);
  if (start >= 0 && end >= start) {
    const afterEnd = end + DERIVED_END.length;
    return `${currentMarkdown.slice(0, start)}${managedBlock}${currentMarkdown.slice(afterEnd)}`;
  }

  const current = currentMarkdown.trim();
  if (current) return `${current}\n\n${managedBlock}\n`;
  return [
    '# Project preferences',
    '',
    managedBlock,
    '',
    '## Manual preferences',
    '',
    '<!-- Add project-owned Prefer/Avoid notes here. This section is never overwritten. -->',
    '',
  ].join('\n');
}

function manualPreferenceContent(markdown: string): string {
  const start = markdown.indexOf(DERIVED_START);
  const end = markdown.indexOf(DERIVED_END);
  const withoutManaged =
    start >= 0 && end >= start
      ? `${markdown.slice(0, start)}${markdown.slice(end + DERIVED_END.length)}`
      : markdown;
  const content = withoutManaged
    .replace(/^# Project preferences\s*$/gimu, '')
    .replace(/<!--[^]*?-->/gu, '')
    .trim();
  return /^## Manual preferences\s*$/iu.test(content) ? '' : content;
}

function renderProjectStyleMemoryPrompt(
  entries: ProjectStyleMemoryEntry[],
  manualContent: string,
): string {
  if (entries.length === 0 && !manualContent) return '';
  const prefer = entries.filter((entry) => entry.kind === 'prefer');
  const avoid = entries.filter((entry) => entry.kind === 'avoid');
  const source = [
    '## Project style memory',
    '',
    'Apply these project-local rules to this generation/redesign. They come from explicit run feedback, deterministic follow-up/revert source comparisons, or manual project preferences. The current user request wins if it conflicts with memory.',
    ...(prefer.length > 0 ? ['', '### Prefer', '', ...prefer.map(renderEntry)] : []),
    ...(avoid.length > 0 ? ['', '### Avoid', '', ...avoid.map(renderEntry)] : []),
    ...(manualContent ? ['', manualContent] : []),
  ].join('\n');
  if (source.length <= MAX_PROMPT_CHARS) return source;
  return `${source.slice(0, MAX_PROMPT_CHARS)}\n\n_Project style memory truncated._`;
}
