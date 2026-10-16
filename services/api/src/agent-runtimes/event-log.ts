import { mkdir, appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { resolveInside } from '@sber-designer/ast-bridge';

import type { AgentStreamEvent } from '../agent/stream';
import { runRoot } from '../agent/run-record/store';

export function runtimeEventLogPath(runId: string): string {
  return `.sber-designer/runs/${runId}/external-runtime/events.jsonl`;
}

export async function appendRuntimeEventLog(input: {
  workspacePath: string | null;
  runId: string | null | undefined;
  runtime: string;
  event: AgentStreamEvent;
}): Promise<void> {
  if (!input.workspacePath || !input.runId) return;
  const path = resolveInside(
    runRoot(input.workspacePath, input.runId),
    'external-runtime/events.jsonl',
  );
  await mkdir(dirname(path), { recursive: true });
  await appendFile(
    path,
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      runtime: input.runtime,
      event: input.event,
    })}\n`,
    'utf8',
  );
}

export async function appendRuntimeEventLogSafely(input: {
  workspacePath: string | null;
  runId: string | null | undefined;
  runtime: string;
  event: AgentStreamEvent;
}): Promise<void> {
  await appendRuntimeEventLog(input).catch(() => undefined);
}
