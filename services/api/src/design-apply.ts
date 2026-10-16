import { createHash } from 'node:crypto';
import { applyOps, type Op } from '@sber-designer/ast-bridge';
import { z } from 'zod';
import type { AssistantActiveRun } from '@sber-designer/shared-types';

import { readWorkspaceFile } from './safe-fs';
import { markStorybookReloadPendingForPath } from './storybook-reload';
import { touchScreensForWorkspacePaths } from './project-store';
import { parseLoc, toWorkspaceRelativePath, type DesignTarget } from './design-inspector';

const SourceLocationSchema = z
  .object({
    line: z.number().int().positive(),
    column: z.number().int().nonnegative(),
  })
  .strict();

const DesignTargetSchema = z
  .object({
    id: z.string().min(1),
    loc: z.string(),
    filePath: z.string().nullable(),
    line: z.number().int().positive().nullable(),
    column: z.number().int().nonnegative().nullable(),
    tagName: z.string(),
    componentName: z.string().optional(),
    componentLoc: z.string().optional(),
    selector: z.string().optional(),
    text: z.string().optional(),
    attributes: z.record(z.string()).optional(),
    rect: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    }),
    sourceKind: z.enum(['react-source', 'sd-loc', 'dom-fallback']),
    domPath: z.string().optional(),
    componentPath: z.array(z.string()).optional(),
    selectionNotice: z.string().optional(),
    inspectId: z.string().optional(),
    computedStyles: z.record(z.string()).optional(),
  })
  .strict();

const VisualChangeSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('set-prop'),
      targetId: z.string(),
      filePath: z.string(),
      loc: SourceLocationSchema,
      name: z.string().min(1),
      value: z.string(),
      label: z.string(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('remove-prop'),
      targetId: z.string(),
      filePath: z.string(),
      loc: SourceLocationSchema,
      name: z.string().min(1),
      label: z.string(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('set-children-text'),
      targetId: z.string(),
      filePath: z.string(),
      loc: SourceLocationSchema,
      text: z.string(),
      label: z.string(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('set-style'),
      targetId: z.string(),
      filePath: z.string(),
      loc: SourceLocationSchema,
      property: z.string().min(1),
      value: z.string(),
      label: z.string(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('remove-style'),
      targetId: z.string(),
      filePath: z.string(),
      loc: SourceLocationSchema,
      property: z.string().min(1),
      label: z.string(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('set-class-token'),
      targetId: z.string(),
      filePath: z.string(),
      loc: SourceLocationSchema,
      tokenGroup: z.string().min(1),
      previousClass: z.string().optional(),
      nextClass: z.string(),
      label: z.string(),
    })
    .strict(),
]);

export const DesignApplyInputSchema = z
  .object({
    workspacePath: z.string().optional(),
    screenId: z.string().min(1).optional(),
    target: DesignTargetSchema,
    changes: z.array(VisualChangeSchema).min(1).max(64),
    baseline: z
      .object({
        filePath: z.string(),
        hash: z.string().min(1),
      })
      .strict()
      .optional(),
  })
  .strict();

export type VisualChange = z.infer<typeof VisualChangeSchema>;

export async function applyDesignChanges(input: {
  workspaceRoot: string;
  target: DesignTarget;
  changes: VisualChange[];
  baseline?: { filePath: string; hash: string };
}): Promise<{
  ok: true;
  changedFiles: string[];
  ops: Array<{ kind: string; file: string }>;
  diffs: Array<{ path: string; before: string; after: string }>;
  baselines: Array<{ filePath: string; hash: string }>;
}> {
  if (!input.target.filePath || !input.target.line) {
    throw new Error('Selected visual target is not editable.');
  }
  if (input.baseline) {
    if (input.changes.some((change) => change.filePath !== input.baseline?.filePath)) {
      throw new Error('Visual change baseline must guard every changed source file.');
    }
    const current = await readWorkspaceFile(input.workspaceRoot, input.baseline.filePath);
    const currentHash = sha256(current);
    if (currentHash !== input.baseline.hash) {
      const conflict = new Error(
        'Source changed since this visual draft was created. Reload selection before applying.',
      );
      (conflict as Error & { status?: number }).status = 409;
      throw conflict;
    }
  }

  const ops = input.changes.map((change) => changeToOp(input.workspaceRoot, input.target, change));
  const touchedPaths = Array.from(new Set(ops.map((op) => op.file)));
  const before = new Map<string, string>();
  for (const path of touchedPaths) {
    before.set(path, await readWorkspaceFile(input.workspaceRoot, path).catch(() => ''));
  }

  const result = await applyOps({ workspaceRoot: input.workspaceRoot, ops });
  const diffs = await Promise.all(
    result.changedFiles.map(async (path) => {
      markStorybookReloadPendingForPath(path, !before.has(path));
      return {
        path,
        before: before.get(path) ?? '',
        after: await readWorkspaceFile(input.workspaceRoot, path).catch(() => ''),
      };
    }),
  );
  await touchScreensForWorkspacePaths(input.workspaceRoot, result.changedFiles).catch(
    () => undefined,
  );

  return {
    ok: true,
    changedFiles: result.changedFiles,
    ops: result.ops,
    diffs,
    baselines: diffs.map((diff) => ({ filePath: diff.path, hash: sha256(diff.after) })),
  };
}

/**
 * Visual writes must not race an assistant lease targeting the same screen or
 * file. The baseline remains the final compare-and-apply guard; this check
 * gives the user an actionable conflict before AST mutation starts.
 */
export function findDesignApplyRunConflict(input: {
  activeRuns: AssistantActiveRun[];
  screenId?: string;
  changedFiles: string[];
}): AssistantActiveRun | null {
  const changedFiles = new Set(input.changedFiles.map((filePath) => normalizePath(filePath)));
  return (
    input.activeRuns.find((run) => {
      if (input.screenId && run.screenId === input.screenId) return true;
      return (run.targetPaths ?? []).some((pattern) =>
        Array.from(changedFiles).some((filePath) => targetPatternMatches(pattern, filePath)),
      );
    }) ?? null
  );
}

function changeToOp(workspaceRoot: string, target: DesignTarget, change: VisualChange): Op {
  validateTargetConsistency(workspaceRoot, target, change);
  switch (change.kind) {
    case 'set-prop':
      return {
        kind: 'set-prop',
        file: change.filePath,
        loc: change.loc,
        name: change.name,
        value: change.value,
      };
    case 'remove-prop':
      return {
        kind: 'remove-prop',
        file: change.filePath,
        loc: change.loc,
        name: change.name,
      };
    case 'set-children-text':
      return {
        kind: 'set-children-text',
        file: change.filePath,
        loc: change.loc,
        text: change.text,
      };
    case 'set-style':
      return {
        kind: 'set-style-prop',
        file: change.filePath,
        loc: change.loc,
        name: change.property,
        value: JSON.stringify(change.value),
      };
    case 'remove-style':
      return {
        kind: 'remove-style-prop',
        file: change.filePath,
        loc: change.loc,
        name: change.property,
      };
    case 'set-class-token':
      return {
        kind: 'set-class-name',
        file: change.filePath,
        loc: change.loc,
        value: change.nextClass,
      };
    default: {
      const exhaustive: never = change;
      throw new Error(`Unsupported visual change: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * A change may address either the selected element or the component usage the
 * selection belongs to (task 0133): clicking a library component lands inside
 * its own source, while its props are edited at the `<Component …>` usage site
 * that `componentLoc` reports. Both locations travel inside the validated
 * target, so neither widens what a caller can reach.
 */
function validateTargetConsistency(
  workspaceRoot: string,
  target: DesignTarget,
  change: VisualChange,
): void {
  if (change.targetId !== target.id) {
    throw new Error('Visual change target does not match the current selection.');
  }
  const instance = componentInstanceLocation(workspaceRoot, target);
  if (change.filePath !== target.filePath && change.filePath !== instance?.filePath) {
    throw new Error('Visual change points to a different source file than the selected target.');
  }
  const matchesTarget =
    change.filePath === target.filePath &&
    change.loc.line === target.line &&
    change.loc.column === (target.column ?? 0);
  const matchesInstance =
    Boolean(instance) &&
    change.filePath === instance?.filePath &&
    change.loc.line === instance.line &&
    change.loc.column === instance.column;
  if (!matchesTarget && !matchesInstance) {
    throw new Error('Visual change source location no longer matches the selected target.');
  }
}

function componentInstanceLocation(
  workspaceRoot: string,
  target: DesignTarget,
): { filePath: string; line: number; column: number } | null {
  if (!target.componentLoc) return null;
  const parsed = parseLoc(target.componentLoc);
  if (!parsed) return null;
  try {
    return {
      filePath: toWorkspaceRelativePath(workspaceRoot, parsed.file),
      line: parsed.line,
      column: parsed.column,
    };
  } catch {
    return null;
  }
}

function sha256(contents: string): string {
  return createHash('sha256').update(contents).digest('hex');
}

function normalizePath(value: string): string {
  return value.replace(/\\/gu, '/').replace(/^\.\//u, '');
}

function targetPatternMatches(pattern: string, filePath: string): boolean {
  const normalized = normalizePath(pattern);
  if (normalized === filePath) return true;
  if (normalized.endsWith('/**')) return filePath.startsWith(normalized.slice(0, -2));
  return false;
}
