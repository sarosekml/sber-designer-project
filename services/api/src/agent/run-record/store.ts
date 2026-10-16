/**
 * Low-level run store: paths under .sber-designer/runs, manifest and
 * timeline IO, id generation, and small shared utilities.
 */
import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveInside } from '@sber-designer/ast-bridge';
import type { ToolContext } from '../types';
import type { AgentRunManifest, CompactActiveScreen, TimelineEvent } from './types';

export const RUNS_ROOT = '.sber-designer/runs';

export function agentRunManifestPath(runId: string): string {
  return join(RUNS_ROOT, requireRunId(runId), 'run-manifest.json');
}

export function agentRunTimelinePath(runId: string): string {
  return join(RUNS_ROOT, requireRunId(runId), 'timeline.jsonl');
}

export function createRunId(now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-').replace(/Z$/, '');
  return `run-${stamp}-${randomUUID().slice(0, 8)}`;
}

export function createReceiptId(tool: string, now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-').replace(/Z$/, '');
  const safeTool = tool.replace(/[^a-z0-9_-]+/giu, '-').replace(/^-+|-+$/gu, '') || 'tool';
  return `${stamp}-${safeTool}-${randomUUID().slice(0, 8)}`;
}

export function runRoot(workspacePath: string, runId: string): string {
  return resolveInside(workspacePath, join(RUNS_ROOT, requireRunId(runId)));
}

export function requireWorkspacePath(workspacePath: string | null): string {
  if (!workspacePath) throw new Error('No workspace connected.');
  return workspacePath;
}

export function requireRunId(runId: string | null | undefined): string {
  if (!runId) throw new Error('No agent run id.');
  if (!/^[A-Za-z0-9._-]+$/u.test(runId)) throw new Error(`Invalid agent run id: ${runId}`);
  return runId;
}

export async function writeRunManifest(
  workspacePath: string,
  manifest: AgentRunManifest,
): Promise<void> {
  const root = runRoot(workspacePath, manifest.runId);
  await mkdir(root, { recursive: true });
  await writeJson(resolveInside(root, 'run-manifest.json'), manifest);
}

export async function readRunManifest(
  workspacePath: string,
  runId: string,
): Promise<AgentRunManifest | null> {
  try {
    return JSON.parse(
      await readFile(resolveInside(runRoot(workspacePath, runId), 'run-manifest.json'), 'utf8'),
    );
  } catch {
    return null;
  }
}

export async function touchManifest(
  workspacePath: string,
  runId: string,
  updatedAt: number,
): Promise<void> {
  const manifest = await readRunManifest(workspacePath, runId);
  if (!manifest) return;
  await writeRunManifest(workspacePath, { ...manifest, updatedAt });
}

export async function appendTimeline(
  workspacePath: string,
  runId: string,
  event: TimelineEvent,
): Promise<void> {
  const root = runRoot(workspacePath, runId);
  await mkdir(root, { recursive: true });
  await appendFile(resolveInside(root, 'timeline.jsonl'), `${JSON.stringify(event)}\n`, 'utf8');
}

export function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function compactActiveScreen(
  screen: ToolContext['activeScreen'] | null,
): CompactActiveScreen | null {
  if (!screen) return null;
  return {
    id: screen.id,
    name: screen.name,
    kind: screen.kind,
    ...(screen.surface === 'modal' ? { surface: screen.surface } : {}),
    ...(screen.storyId ? { storyId: screen.storyId } : {}),
    ...(screen.filePath ? { filePath: screen.filePath } : {}),
    ...(screen.implementationFilePath
      ? { implementationFilePath: screen.implementationFilePath }
      : {}),
    ...(screen.folder ? { folder: screen.folder } : {}),
    ...(screen.description ? { description: screen.description } : {}),
  };
}
