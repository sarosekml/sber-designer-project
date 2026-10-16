import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolveInside } from '@sber-designer/ast-bridge';

import type { AgentToolPermissionDecision } from '../agent-kit/permissions';
import type { AgentPermissionRequest, AgentPermissionResponse } from './stream';
import type { AgentDevRunLogger } from './dev-log';
import type { ToolContext } from './types';

/** Decide when a screen run must leave reconnaissance and write the target. */
export function decideScreenBudgetNudge(input: {
  iteration: number;
  max: number;
  reconSoftLimit: number;
  finalizeReserve: number;
  reconNudged: boolean;
  finalizeNudged: boolean;
}): 'recon' | 'finalize' | null {
  if (input.max - input.iteration <= input.finalizeReserve && !input.finalizeNudged) {
    return 'finalize';
  }
  if (input.iteration > input.reconSoftLimit && !input.reconNudged) return 'recon';
  return null;
}

export function isScreenWriteIntent(intent: ToolContext['assistantTaskIntent']): boolean {
  const kind = intent?.kind;
  return (
    kind === 'edit-current-screen' ||
    kind === 'create-screen-from-story' ||
    kind === 'fill-generated-screen'
  );
}

export function isScreenGenerationTask(
  taskKind: NonNullable<ToolContext['componentPack']>['taskKind'] | undefined,
): boolean {
  return (
    taskKind === 'image-to-screen' ||
    taskKind === 'screen-generation' ||
    taskKind === 'screen-redesign' ||
    taskKind === 'screen-edit'
  );
}

export function screenWriteTargets(activeScreen: ToolContext['activeScreen']): string[] {
  return [activeScreen?.implementationFilePath, activeScreen?.filePath]
    .filter((path): path is string => typeof path === 'string' && path.length > 0)
    .map(normalizeStreamPath);
}

export function normalizeStreamPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.?\//u, '');
}

export function budgetReconNudge(target: string, remaining: number): string {
  return `[sber-designer · auto] Enough exploring — write the active screen now to ${target} (compact, <=120 lines) using the task component pack, then validate. ${remaining} iteration(s) remain; avoid further read_file / get_indexed_icon unless strictly required.`;
}

export function budgetFinalizeNudge(target: string, remaining: number): string {
  return `[sber-designer · auto] Only ${remaining} iteration(s) remain and the active screen is not written yet. Immediately call write_file for ${target} with a compact, valid screen (contentsLines, <=120 lines). Do not read more files or look up more icons.`;
}

export function noWriteStopRecoveryNudge(target: string): string {
  return `[sber-designer · auto] Your previous response did not change the active screen. This is a Design run: do not return source code in chat. Immediately call write_file (prefer contentsLines, compact and <=120 lines) or apply_patch for exactly ${target}. Do not create another screen or file. After the write succeeds, validate the same target and finish with a concise summary.`;
}

export function changedFilesFromToolResult(toolName: string, resultContent: string): string[] {
  try {
    const parsed = JSON.parse(resultContent) as unknown;
    if (!parsed || typeof parsed !== 'object') return [];
    const record = parsed as Record<string, unknown>;
    if (Array.isArray(record.changedFiles)) {
      return record.changedFiles.filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      );
    }
    if (
      (toolName === 'write_file' || toolName === 'apply_patch') &&
      typeof record.path === 'string'
    ) {
      return [record.path];
    }
    return [];
  } catch {
    return [];
  }
}

export async function localEditValidationFingerprint(input: {
  toolName: string;
  resultContent: string;
  toolContext: ToolContext;
}): Promise<{ fingerprint: string; blocking: number; findingIds: string[] } | null> {
  if (!['apply_patch', 'validate_screen_craft', 'write_file'].includes(input.toolName)) return null;
  const parsed = parseJsonObject(input.resultContent);
  if (!parsed) return null;
  const craft =
    input.toolName === 'validate_screen_craft'
      ? parsed
      : parsed.craft && typeof parsed.craft === 'object' && !Array.isArray(parsed.craft)
        ? (parsed.craft as Record<string, unknown>)
        : null;
  if (!craft) return null;
  const blocking = typeof craft.blocking === 'number' ? craft.blocking : 0;
  const findingIds = sortedCraftFindingIds(craft.findings);
  const checkedFiles = Array.isArray(craft.checkedFiles)
    ? craft.checkedFiles.filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      )
    : [];
  const target = checkedFiles[0] ?? input.toolContext.activeScreen?.implementationFilePath ?? null;
  const sourceHash = target
    ? await workspaceSourceHash(input.toolContext.workspacePath, target)
    : 'no-source';
  return {
    fingerprint: createHash('sha256')
      .update([normalizeStreamPath(target ?? 'no-target'), sourceHash, ...findingIds].join('\n'))
      .digest('hex'),
    blocking,
    findingIds,
  };
}

function sortedCraftFindingIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const record = item as Record<string, unknown>;
          const ruleId = typeof record.ruleId === 'string' ? record.ruleId : 'unknown-rule';
          const filePath = typeof record.filePath === 'string' ? record.filePath : '';
          return `${ruleId}${filePath ? `@${normalizeStreamPath(filePath)}` : ''}`;
        })
        .filter((item): item is string => Boolean(item)),
    ),
  ).sort();
}

async function workspaceSourceHash(
  workspacePath: string | null | undefined,
  filePath: string,
): Promise<string> {
  if (!workspacePath) return 'no-workspace';
  try {
    const source = await readFile(resolveInside(workspacePath, filePath), 'utf8');
    return createHash('sha256').update(source, 'utf8').digest('hex');
  } catch {
    return 'unreadable-source';
  }
}

export function localEditLoopFinalizedNotice(findingIds: string[]): string {
  const findings = findingIds.length ? findingIds.join(', ') : 'none';
  return `[sber-designer · auto] Change already applied; validation findings are unchanged and non-blocking (${findings}). Finish now with a concise summary instead of running another patch cycle.`;
}

export function localEditLoopFinalizedFinalResponse(findingIds: string[]): string {
  const findings = findingIds.length ? findingIds.join(', ') : 'none';
  return `I applied the change, then stopped because the same non-blocking validation findings repeated without source changes (${findings}). The screen is ready for review; I did not run another patch loop.`;
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function logDev(
  logger: AgentDevRunLogger | null | undefined,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  await logger?.log(event, data).catch(() => undefined);
}

export function permissionResult(decision: AgentToolPermissionDecision): Record<string, unknown> {
  const detail = `Agent permission ${decision.action} for ${String(decision.category)} "${decision.resource}" via pattern "${decision.pattern}".`;
  if (decision.action === 'deny') {
    return {
      error: decision.reasonCode ?? 'agent_permission_denied',
      detail,
      permission: decision,
    };
  }
  return { status: 'permission_required', detail, permission: decision };
}

export function throwIfRunAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new Error('Agent run cancelled.');
}

export function permissionRequestForCall(input: {
  decision: AgentToolPermissionDecision;
  call: { id: string; name: string; arguments: string };
  iteration: number;
  runId: string | null;
}): AgentPermissionRequest {
  return {
    id: `perm-${Date.now().toString(36)}-${input.iteration}-${input.call.id}`,
    toolCallId: input.call.id,
    toolName: input.call.name,
    ...(input.runId ? { runId: input.runId } : {}),
    category: String(input.decision.category),
    resource: input.decision.resource,
    pattern: input.decision.pattern,
    arguments: input.call.arguments,
  };
}

export function isAgentPermissionResponse(value: unknown): value is AgentPermissionResponse {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    ((value as { decision?: unknown }).decision === 'allow' ||
      (value as { decision?: unknown }).decision === 'deny')
  );
}
