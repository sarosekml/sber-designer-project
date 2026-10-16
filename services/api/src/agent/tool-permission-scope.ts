import type { AgentToolPermissionDecision } from '../agent-kit/permissions';
import type { ToolContext } from './types';
import { isPlanDocumentPath } from '../session-mode';

interface ApplyRunPermissionScopeInput {
  decision: AgentToolPermissionDecision;
  toolName: string;
  input: unknown;
  toolContext: ToolContext;
}

export function applyRunPermissionScope(
  input: ApplyRunPermissionScopeInput,
): AgentToolPermissionDecision {
  const touchedFiles = toolWriteTargets(input.toolName, input.input);
  if (input.toolContext.sessionMode === 'plan' && touchedFiles.length > 0) {
    if (touchedFiles.every(isPlanDocumentPath)) {
      return {
        ...input.decision,
        action: 'allow',
        category: 'edit',
        pattern: '.sber-designer/plans/**',
        reasonCode: 'active_screen_scope_auto_allow',
      };
    }
    return {
      ...input.decision,
      action: 'deny',
      category: 'edit',
      pattern: '.sber-designer/plans/**',
      reasonCode: 'permission_denied',
    };
  }
  if (input.decision.category !== 'edit' || input.decision.action !== 'ask') {
    return input.decision;
  }
  if (touchedFiles.length === 0) return input.decision;

  const allowedTargets = runAllowedWriteTargets(input.toolContext);
  if (allowedTargets.size === 0) return input.decision;

  const allTouchedFilesAreRunTargets = touchedFiles.every((file) => {
    const normalized = normalizeRunTargetPath(file);
    return Array.from(allowedTargets).some((target) => matchesRunTarget(target, normalized));
  });
  if (!allTouchedFilesAreRunTargets) return input.decision;

  return {
    ...input.decision,
    action: 'allow',
    pattern: 'run-target',
    reasonCode: 'active_screen_scope_auto_allow',
  };
}

function matchesRunTarget(target: string, file: string): boolean {
  if (target === file) return true;
  if (!target.endsWith('/**')) return false;
  const prefix = target.slice(0, -3).replace(/\/$/u, '');
  return file === prefix || file.startsWith(`${prefix}/`);
}

function runAllowedWriteTargets(ctx: ToolContext): Set<string> {
  const targets = new Set<string>();
  for (const target of ctx.runAllowedWriteTargets ?? []) addPath(targets, target);
  if (targets.size > 0) return targets;
  addPath(targets, ctx.activeScreen?.implementationFilePath);
  addPath(targets, ctx.activeScreen?.filePath);
  const intent = ctx.assistantTaskIntent;
  if (intent?.kind === 'create-screen-from-story' || intent?.kind === 'fill-generated-screen') {
    addPath(targets, intent.targetImplementationFilePath);
    addPath(targets, intent.targetStoryFilePath);
  }
  return targets;
}

function toolWriteTargets(toolName: string, input: unknown): string[] {
  const data = asRecord(input);
  if (!data) return [];
  if (toolName === 'apply_project_restructure') {
    return [`project-restructure:${String(data.planDigest ?? '*')}`];
  }
  if (toolName === 'write_file') {
    return typeof data.path === 'string' ? [data.path] : [];
  }
  if (toolName === 'apply_patch' && Array.isArray(data.ops)) {
    return Array.from(
      new Set(
        data.ops
          .map((op) => asRecord(op)?.file)
          .filter((value): value is string => typeof value === 'string' && value.length > 0),
      ),
    );
  }
  return [];
}

function addPath(targets: Set<string>, path: string | null | undefined): void {
  if (typeof path !== 'string' || path.length === 0) return;
  targets.add(normalizeRunTargetPath(path));
}

function normalizeWorkspacePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.?\//u, '');
}

function normalizeRunTargetPath(path: string): string {
  const normalized = normalizeWorkspacePath(path);
  const parts = normalized.split('/');
  const fileName = parts.at(-1);
  if (fileName?.toLowerCase() === 'design.md') {
    parts[parts.length - 1] = 'Design.md';
    return parts.join('/');
  }
  return normalized;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
