/**
 * Cross-group tool helpers: active-screen write-scope guards and the
 * workspace presence check. Leaf module for agent/tools/*.
 */
import type { ToolContext } from '../types';
import { isPlanDocumentPath } from '../../session-mode';

function isCurrentScreenEditScope(ctx: ToolContext): boolean {
  return ctx.assistantTaskIntent?.kind === 'edit-current-screen';
}

function currentScreenWriteTargets(ctx: ToolContext): string[] {
  return [ctx.activeScreen?.implementationFilePath, ctx.activeScreen?.filePath].filter(
    (path): path is string => Boolean(path),
  );
}

export function normalizeWorkspacePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//u, '');
}

export function assertCurrentScreenWriteScope(
  ctx: ToolContext,
  paths: string[],
  toolName: 'apply_patch' | 'write_file',
): void {
  if (ctx.sessionMode === 'plan') {
    const outsidePlan = paths.map(normalizeWorkspacePath).find((path) => !isPlanDocumentPath(path));
    if (outsidePlan) {
      throw new Error(
        `${toolName} is restricted by Plan session mode. Write only Markdown files under .sber-designer/plans/.`,
      );
    }
    return;
  }
  if (!isCurrentScreenEditScope(ctx)) return;
  const targets = currentScreenWriteTargets(ctx).map(normalizeWorkspacePath);
  const allowed = new Set(targets);
  const outside = paths.map(normalizeWorkspacePath).find((path) => !allowed.has(path));
  if (!outside) return;
  const target =
    normalizeWorkspacePath(ctx.activeScreen?.implementationFilePath ?? '') ||
    normalizeWorkspacePath(ctx.activeScreen?.filePath ?? '');
  throw new Error(
    [
      `${toolName === 'apply_patch' ? 'write_file' : toolName} target is outside the current screen scope.`,
      target
        ? `Use ${target} for this run, or switch Assistant target to New screen.`
        : 'Switch Assistant target to New screen, or select a screen with an implementation file.',
    ].join(' '),
  );
}

export function assertScreenCreateAllowed(ctx: ToolContext): void {
  if (!isCurrentScreenEditScope(ctx)) return;
  const target =
    normalizeWorkspacePath(ctx.activeScreen?.implementationFilePath ?? '') ||
    normalizeWorkspacePath(ctx.activeScreen?.filePath ?? '');
  throw new Error(
    [
      'screen_create is not allowed while editing the current screen.',
      target
        ? `Write to ${target} and validate the existing screen instead.`
        : 'Write to the active screen implementation file and validate the existing screen instead.',
    ].join(' '),
  );
}

export function assertScreenUpdateAllowed(ctx: ToolContext, screenId: string): void {
  if (!isCurrentScreenEditScope(ctx)) return;
  if (ctx.activeScreen?.id === screenId) return;
  throw new Error(
    'screen_update is only allowed for the active screen in current-screen edit scope.',
  );
}

export function requireWorkspace(ctx: { workspacePath: string | null }): string {
  if (!ctx.workspacePath) {
    throw new Error('No workspace connected.');
  }
  return ctx.workspacePath;
}
