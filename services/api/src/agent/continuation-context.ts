import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveInside } from '@sber-designer/ast-bridge';
import type {
  PersistedAssistantAttachment,
  PromptAttachmentEvidence,
  RunContinuationContextSnapshot,
} from '@sber-designer/shared-types';

const RUNS_ROOT = '.sber-designer/runs';
const SOURCE_PROMPT_MAX_CHARS = 4000;

export interface ContinuationContextMessage {
  id?: string;
  role: string;
  content: unknown;
  attachments?: PersistedAssistantAttachment[];
}

export interface ContinuationContextActiveTarget {
  screenId?: string;
  screenName?: string;
  implementationFilePath?: string;
  storyFilePath?: string;
}

export interface ContinuationContextToolReceipt {
  tool: string;
  status: string;
  changedFiles?: string[];
  summary?: string | null;
}

export interface WriteRunContinuationContextSnapshotInput {
  workspacePath: string;
  runId: string;
  sessionId?: string;
  screenId?: string;
  messages: ContinuationContextMessage[];
  taskSummary?: string | null;
  activeTarget?: ContinuationContextActiveTarget | null;
  attachments?: PromptAttachmentEvidence[];
  changedFiles?: string[];
  lastToolCalls?: RunContinuationContextSnapshot['lastToolCalls'];
  runStatus?: RunContinuationContextSnapshot['runStatus'];
  runSummary?: string | null;
}

export async function writeRunContinuationContextSnapshot(
  input: WriteRunContinuationContextSnapshotInput,
): Promise<RunContinuationContextSnapshot> {
  const snapshot = buildRunContinuationContextSnapshot(input);
  await writeFile(
    resolveInside(input.workspacePath, runContinuationContextPath(input.runId)),
    `${JSON.stringify(snapshot, null, 2)}\n`,
    'utf8',
  );
  return snapshot;
}

export function buildRunContinuationContextSnapshot(
  input: WriteRunContinuationContextSnapshotInput,
): RunContinuationContextSnapshot {
  const sourcePrompt = latestRealUserPrompt(input.messages);
  const snapshot: RunContinuationContextSnapshot = {
    version: 1,
    runId: requireRunId(input.runId),
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(input.screenId ? { screenId: input.screenId } : {}),
    sourcePrompt,
    ...(input.taskSummary?.trim() ? { taskSummary: input.taskSummary.trim() } : {}),
    ...(input.activeTarget ? { activeTarget: compactActiveTarget(input.activeTarget) } : {}),
    attachments: input.attachments ?? [],
    changedFiles: uniqueSorted(input.changedFiles ?? []),
    lastToolCalls: input.lastToolCalls ?? [],
    ...(input.runStatus ? { runStatus: input.runStatus } : {}),
    ...(input.runSummary?.trim() ? { runSummary: input.runSummary.trim() } : {}),
  };
  return snapshot;
}

export async function updateRunContinuationContextSnapshotOnComplete(input: {
  workspacePath: string;
  runId: string;
  status: Exclude<RunContinuationContextSnapshot['runStatus'], 'queued' | 'running'>;
  summary?: string | null;
  receipts: ContinuationContextToolReceipt[];
}): Promise<RunContinuationContextSnapshot | null> {
  const current = await readRunContinuationContextSnapshot(input.workspacePath, input.runId);
  if (!current) return null;
  const next: RunContinuationContextSnapshot = {
    ...current,
    runStatus: input.status,
    ...(input.summary?.trim() ? { runSummary: input.summary.trim() } : {}),
    changedFiles: uniqueSorted(input.receipts.flatMap((receipt) => receipt.changedFiles ?? [])),
    lastToolCalls: input.receipts.slice(-8).map((receipt) => ({
      name: receipt.tool,
      status: toContinuationToolCallStatus(receipt.status),
      summary: compactLine(receipt.summary ?? receipt.status, 260),
    })),
  };
  await writeFile(
    resolveInside(input.workspacePath, runContinuationContextPath(input.runId)),
    `${JSON.stringify(next, null, 2)}\n`,
    'utf8',
  );
  return next;
}

export async function readRunContinuationContextSnapshot(
  workspacePath: string,
  runId: string,
): Promise<RunContinuationContextSnapshot | null> {
  try {
    return JSON.parse(
      await readFile(resolveInside(workspacePath, runContinuationContextPath(runId)), 'utf8'),
    ) as RunContinuationContextSnapshot;
  } catch {
    return null;
  }
}

export async function readPromptAttachmentEvidenceFromContinuationMessages(input: {
  workspacePath: string;
  messages: ContinuationContextMessage[];
}): Promise<PromptAttachmentEvidence[]> {
  for (const path of continuationContextPathsFromMessages(input.messages)) {
    const snapshot = await readRunContinuationContextSnapshotAtPath(input.workspacePath, path);
    if (snapshot?.attachments.length) return snapshot.attachments;
  }
  return [];
}

export function runContinuationContextPath(runId: string): string {
  return join(RUNS_ROOT, requireRunId(runId), 'continuation-context.json').split('\\').join('/');
}

export function isContinueRunDirective(content: string): boolean {
  const normalized = content.replace(/\s+/gu, ' ').trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized === 'continue the previous run.' ||
    normalized === 'continue previous run.' ||
    normalized.includes('continue the previous agent run') ||
    normalized.includes('continue previous agent run')
  );
}

function latestRealUserPrompt(
  messages: ContinuationContextMessage[],
): RunContinuationContextSnapshot['sourcePrompt'] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== 'user') continue;
    const text = contentToText(message.content).trim();
    if (!text || isContinueRunDirective(text)) continue;
    const compacted = text.length > SOURCE_PROMPT_MAX_CHARS;
    return {
      ...(message.id ? { messageId: message.id } : {}),
      text: compacted ? `${text.slice(0, SOURCE_PROMPT_MAX_CHARS - 3)}...` : text,
      compacted,
    };
  }
  const compactContextPrompt = latestCompactContextSourcePrompt(messages);
  if (compactContextPrompt) return compactContextPrompt;
  return { text: '', compacted: false };
}

function latestCompactContextSourcePrompt(
  messages: ContinuationContextMessage[],
): RunContinuationContextSnapshot['sourcePrompt'] | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== 'system') continue;
    const text = contentToText(message.content);
    if (!text.includes('Compact assistant task context')) continue;
    const match =
      /Source prompt:\s*\n([\s\S]*?)(?:\n\n(?:Task summary:|Active target:|Last run:|Prompt attachments:)|$)/u.exec(
        text,
      );
    const source = match?.[1]?.trim();
    if (!source || source.startsWith('_No non-continue user prompt')) continue;
    const compacted = source.length > SOURCE_PROMPT_MAX_CHARS;
    return {
      text: compacted ? `${source.slice(0, SOURCE_PROMPT_MAX_CHARS - 3)}...` : source,
      compacted,
    };
  }
  return null;
}

async function readRunContinuationContextSnapshotAtPath(
  workspacePath: string,
  relativePath: string,
): Promise<RunContinuationContextSnapshot | null> {
  const normalized = relativePath.trim().split('\\').join('/');
  if (
    !/^\.sber-designer\/runs\/run-[a-z0-9_.:-]+\/continuation-context\.json$/iu.test(normalized)
  ) {
    return null;
  }
  try {
    return JSON.parse(
      await readFile(resolveInside(workspacePath, normalized), 'utf8'),
    ) as RunContinuationContextSnapshot;
  } catch {
    return null;
  }
}

function continuationContextPathsFromMessages(messages: ContinuationContextMessage[]): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const text = contentToText(messages[index]?.content);
    for (const match of text.matchAll(/continuationContext:\s*([^\s`]+)/giu)) {
      if (!match[1] || seen.has(match[1])) continue;
      seen.add(match[1]);
      paths.push(match[1]);
    }
  }
  return paths;
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function compactActiveTarget(
  target: ContinuationContextActiveTarget,
): RunContinuationContextSnapshot['activeTarget'] {
  return {
    ...(target.screenId ? { screenId: target.screenId } : {}),
    ...(target.screenName ? { screenName: target.screenName } : {}),
    ...(target.implementationFilePath
      ? { implementationFilePath: target.implementationFilePath }
      : {}),
    ...(target.storyFilePath ? { storyFilePath: target.storyFilePath } : {}),
  };
}

function requireRunId(runId: string): string {
  const clean = runId.trim();
  if (!/^run-[a-z0-9_.:-]+$/iu.test(clean)) {
    throw new Error(`Invalid run id: ${runId}`);
  }
  return clean;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function toContinuationToolCallStatus(
  status: string,
): RunContinuationContextSnapshot['lastToolCalls'][number]['status'] {
  if (
    status === 'error' ||
    status === 'skipped' ||
    status === 'needs_review' ||
    status === 'warning' ||
    status === 'unavailable'
  ) {
    return status;
  }
  return 'ok';
}

function compactLine(value: string, maxLength: number): string {
  const compacted = value.replace(/\s+/gu, ' ').trim();
  if (compacted.length <= maxLength) return compacted;
  return `${compacted.slice(0, Math.max(0, maxLength - 3))}...`;
}
