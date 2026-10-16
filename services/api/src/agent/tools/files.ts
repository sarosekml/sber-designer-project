import { definedJson } from '../../defined-json';
/**
 * File tools: apply_patch (AST ops with rollback), read_file, write_file,
 * plus their import/source-health validation and the craft post-check.
 */
import { z } from 'zod';
import { applyOps, OpSchema } from '@sber-designer/ast-bridge';
import { Project, SyntaxKind } from 'ts-morph';
import { HTML_DESIGN_SYSTEM_PATHS } from '@sber-designer/shared-types';

import {
  deleteWorkspaceFile,
  readWorkspaceFile,
  renameWorkspaceFile,
  workspaceFileExistsExact,
  writeWorkspaceFile,
} from '../../safe-fs';
import {
  validateScreenCraft,
  type ScreenCraftFinding,
  type ScreenCraftResult,
} from '../../screen-craft';
import { markStorybookReloadPendingForPath } from '../../storybook-reload';
import { validateGeneratedSourceHealth } from '../generated-source-health';
import { recordToolReceiptSafely } from '../run-recorder';
import type {
  ToolMutationRollbackReason,
  ToolMutationTransaction,
} from '../tool-mutation-transaction';
import type { ServerTool, ToolContext } from '../types';
import { validateWorkspaceRelativeImports } from '../workspace-import-validation';
import { assertCurrentScreenWriteScope, normalizeWorkspacePath } from './shared';

const ApplyPatchInput = z
  .object({
    ops: z.array(OpSchema).min(1).max(64),
  })
  .strict();

interface PatchDiff {
  path: string;
  before: string;
  after: string;
}

function splitPreservingNewlines(contents: string): string[] {
  const parts = contents.match(/[^\n]*(?:\n|$)/gu) ?? [];
  return parts.filter((part) => part.length > 0);
}

export const applyPatch: ServerTool<
  z.infer<typeof ApplyPatchInput>,
  {
    ok: true;
    changedFiles: string[];
    ops: { kind: string; file: string }[];
    diffs: PatchDiff[];
  }
> = {
  name: 'apply_patch',
  description:
    'Apply structured AST operations atomically against the connected workspace. Use this for targeted existing JSX edits — set/remove JSX props, add imports, swap or wrap components, set children text. If a patch/replace-text operation reports not found/not unique, reread the target file before retrying. When the result is ok and changedFiles contains the target, trust the returned diff and do not reread only to confirm it; finish after non-blocking craft evidence. Do not repeat the same failed patch unchanged. For freshly generated screen files or broad generated-screen repairs, prefer write_file over a fragile text patch when local context is stale. JSX elements are addressed by source location (file + line + column). All ops succeed or none do. Returns per-file before/after diffs for the editor to surface.',
  inputSchema: ApplyPatchInput,
  handler: async (input, ctx) => {
    if (!ctx.workspacePath) {
      throw new Error('No workspace connected. Ask the user to connect a project.');
    }
    // Snapshot every touched file before applying so the result includes
    // a structured before/after for the UI's DiffEditor.
    const touchedPaths = Array.from(new Set(input.ops.map((op) => op.file)));
    assertCurrentScreenWriteScope(ctx, touchedPaths, 'apply_patch');
    const before = new Map<string, string | null>();
    for (const p of touchedPaths) {
      try {
        before.set(p, await readWorkspaceFile(ctx.workspacePath, p));
      } catch {
        before.set(p, null);
      }
    }
    const transaction = ctx.beginToolMutation?.({
      toolName: 'apply_patch',
      changedFiles: touchedPaths,
      rollback: () => rollbackChangedFiles(ctx.workspacePath!, before),
      afterRollback: (reason) =>
        recordMutationRollbackReceipt(ctx, 'apply_patch', touchedPaths, reason),
    });
    await transaction?.checkpoint();
    let result: Awaited<ReturnType<typeof applyOps>>;
    try {
      transaction?.markMutationStarted();
      result = await applyOps({ workspaceRoot: ctx.workspacePath, ops: definedJson(input.ops) });
      await transaction?.markMutated();
    } catch (err) {
      await transaction?.rollback('handler_error');
      throw err;
    }
    try {
      await validateChangedImports(ctx.workspacePath, result.changedFiles);
      await validateGeneratedSourceHealthOrThrow(ctx, result.changedFiles);
    } catch (err) {
      if (transaction) await transaction.rollback('handler_error');
      else await rollbackChangedFiles(ctx.workspacePath, before);
      throw err;
    }
    const diffs: PatchDiff[] = [];
    for (const filePath of result.changedFiles) {
      const after = await readWorkspaceFile(ctx.workspacePath, filePath).catch(() => '');
      diffs.push({ path: filePath, before: before.get(filePath) ?? '', after });
    }
    await runOrDeferMutationEffect(transaction, async () => {
      for (const filePath of result.changedFiles) {
        markStorybookReloadPendingForPath(filePath, before.get(filePath) === null);
      }
      await recordToolReceiptSafely({
        workspacePath: ctx.workspacePath,
        runId: ctx.runId,
        tool: 'apply_patch',
        status: 'ok',
        changedFiles: result.changedFiles,
        summary: `Applied ${input.ops.length} AST operation${input.ops.length === 1 ? '' : 's'}.`,
        metadata: {
          opCount: input.ops.length,
          diffCount: diffs.length,
        },
      });
    });
    const craft = await runCraftPostCheckSafely(ctx, result.changedFiles, transaction);
    await transaction?.checkpoint();
    return { ...result, diffs, ...(craft ? { craft } : {}) };
  },
};

// ---------- read_file ---------------------------------------------------

const ReadFileInput = z
  .object({
    path: z.string().min(1).describe('Workspace-relative path.'),
    startLine: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Optional 1-based line to start reading from. Defaults to 1.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(2_000)
      .optional()
      .describe('Optional maximum number of lines to return for source peeks.'),
  })
  .strict();

export const readFile: ServerTool<
  z.infer<typeof ReadFileInput>,
  {
    path: string;
    contents: string;
    jsxLocations?: JsxLocationHint[];
    truncated?: boolean;
    startLine?: number;
    endLine?: number;
    totalLines?: number;
  }
> = {
  name: 'read_file',
  description:
    'Read a file from the connected workspace. Path is relative to the project root. Refuses paths outside the workspace. TSX/JSX results include exact jsxLocations for AST patch loc values; use the matching tag/dataTestId anchor and never guess a line. Use optional startLine/limit for concise source peeks instead of reading large files.',
  inputSchema: ReadFileInput,
  handler: async (input, ctx) => {
    if (!ctx.workspacePath) {
      throw new Error('No workspace connected.');
    }
    const path = await resolveReadFilePath(ctx, input.path);
    const contents = await readWorkspaceFile(ctx.workspacePath, path).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('ENOENT') || message.includes('no such file')) {
        throw new Error(
          [
            `File not found: ${input.path}.`,
            'Do not guess nearby filenames.',
            'Use search_project_index or get_indexed_component and read the returned source/import paths.',
          ].join(' '),
        );
      }
      throw err;
    });
    if (input.limit === undefined && input.startLine === undefined) {
      const jsxLocations = collectJsxLocationHints(path, contents);
      return { path, contents, ...(jsxLocations.length > 0 ? { jsxLocations } : {}) };
    }
    const lines = splitPreservingNewlines(contents);
    const totalLines = lines.length;
    const startLine = input.startLine ?? 1;
    const startIndex = Math.max(startLine - 1, 0);
    const selected = lines.slice(startIndex, startIndex + (input.limit ?? totalLines));
    const endLine = selected.length > 0 ? startLine + selected.length - 1 : startLine - 1;
    const truncated = startIndex > 0 || endLine < totalLines;
    return {
      path,
      contents: selected.join(''),
      ...jsxLocationHintsInRange(path, contents, startLine, endLine),
      truncated,
      startLine,
      endLine,
      totalLines,
    };
  },
};

interface JsxLocationHint {
  line: number;
  column: number;
  tag: string;
  dataTestId?: string;
  title?: string;
  name?: string;
}

function jsxLocationHintsInRange(
  path: string,
  contents: string,
  startLine: number,
  endLine: number,
): { jsxLocations?: JsxLocationHint[] } {
  const jsxLocations = collectJsxLocationHints(path, contents).filter(
    (item) => item.line >= startLine && item.line <= endLine,
  );
  return jsxLocations.length > 0 ? { jsxLocations } : {};
}

function collectJsxLocationHints(path: string, contents: string): JsxLocationHint[] {
  if (!/\.[cm]?[jt]sx$/u.test(path)) return [];
  try {
    const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
    const sourceFile = project.createSourceFile(path, contents, { overwrite: true });
    const openings = [
      ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
    ];
    return openings
      .map((opening) => {
        const location = sourceFile.getLineAndColumnAtPos(opening.getStart());
        const openingText = opening.getText();
        return {
          line: location.line,
          column: location.column,
          tag: opening.getTagNameNode().getText(),
          ...stringJsxAttributeHints(openingText),
        };
      })
      .sort((a, b) => a.line - b.line || a.column - b.column);
  } catch {
    return [];
  }
}

function stringJsxAttributeHints(
  openingText: string,
): Pick<JsxLocationHint, 'dataTestId' | 'title' | 'name'> {
  const values = (['dataTestId', 'title', 'name'] as const).flatMap((attribute) => {
    const match = openingText.match(new RegExp(`\\b${attribute}=["']([^"']+)["']`, 'u'));
    return match?.[1] ? [[attribute, match[1]] as const] : [];
  });
  return Object.fromEntries(values);
}

// ---------- write_file --------------------------------------------------

const WriteFileInput = z
  .object({
    path: z.string().min(1).describe('Workspace-relative path.'),
    contents: z.string().optional().describe('Full file contents to write.'),
    contentsLines: z
      .preprocess(
        (value) => (typeof value === 'string' ? value.split(/\r?\n/u) : value),
        z.array(z.string()).min(1),
      )
      .optional()
      .describe(
        'Alternative model-friendly multiline payload. Pass either an array of lines or one multiline string; lines are joined with "\\n". Use this instead of contents when escaping a large multiline string is risky.',
      ),
  })
  .strict()
  .superRefine((input, ctx) => {
    const hasContents = input.contents !== undefined;
    const hasLines = input.contentsLines !== undefined;
    if (hasContents === hasLines) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide exactly one of contents or contentsLines.',
        path: ['contents'],
      });
    }
  });

export const writeFile: ServerTool<
  z.infer<typeof WriteFileInput>,
  {
    ok: true;
    path: string;
    before: string | null;
    after: string;
    diffs: PatchDiff[];
  },
  z.input<typeof WriteFileInput>
> = {
  name: 'write_file',
  description:
    'Create or overwrite a workspace file. Use this when creating a brand-new generated screen/story file or replacing freshly generated screen files after stale patch failures. For small targeted edits to stable existing JSX, prefer apply_patch; for broad generated-screen repairs, write_file is safer than a fragile text patch. Provide either contents or contentsLines; contentsLines is safer for large multiline files because it avoids one giant escaped JSON string. Relative imports in TypeScript/JS files are validated and rejected if they cannot resolve from the target file path.',
  inputSchema: WriteFileInput,
  handler: async (input, ctx) => {
    if (!ctx.workspacePath) {
      throw new Error('No workspace connected.');
    }
    const contents = input.contents ?? input.contentsLines?.join('\n') ?? '';
    const target = await resolveWriteFilePath(ctx, input.path);
    assertCurrentScreenWriteScope(ctx, [target.path], 'write_file');
    await validateWorkspaceRelativeImports(ctx.workspacePath, target.path, contents);
    const targetBefore = await readWorkspaceFile(ctx.workspacePath, target.path).catch(() => null);
    const migrateFromBefore = target.migrateFrom
      ? await readWorkspaceFile(ctx.workspacePath, target.migrateFrom).catch(() => null)
      : null;
    const before = targetBefore ?? migrateFromBefore;
    const transaction = ctx.beginToolMutation?.({
      toolName: 'write_file',
      changedFiles: [target.path],
      rollback: async () => {
        await restoreWorkspaceFileSnapshot(ctx.workspacePath!, target.path, targetBefore);
        if (target.migrateFrom) {
          await restoreWorkspaceFileSnapshot(
            ctx.workspacePath!,
            target.migrateFrom,
            migrateFromBefore,
          );
        }
      },
      afterRollback: (reason) =>
        recordMutationRollbackReceipt(ctx, 'write_file', [target.path], reason),
    });
    await transaction?.checkpoint();
    try {
      transaction?.markMutationStarted();
      if (target.migrateFrom) {
        await migrateHtmlFirstDesignAlias(ctx.workspacePath, target.migrateFrom, target.path);
      }
      await writeWorkspaceFile(ctx.workspacePath, target.path, contents);
      await transaction?.markMutated();
    } catch (err) {
      await transaction?.rollback('handler_error');
      throw err;
    }
    await runOrDeferMutationEffect(transaction, async () => {
      markStorybookReloadPendingForPath(target.path, before === null);
      await recordToolReceiptSafely({
        workspacePath: ctx.workspacePath,
        runId: ctx.runId,
        tool: 'write_file',
        status: 'ok',
        changedFiles: [target.path],
        summary: before === null ? `Created ${target.path}.` : `Updated ${target.path}.`,
        metadata: {
          beforeExists: before !== null,
          beforeBytes: before === null ? 0 : Buffer.byteLength(before, 'utf8'),
          afterBytes: Buffer.byteLength(contents, 'utf8'),
        },
      });
    });
    const craft = await runCraftPostCheckSafely(ctx, [target.path], transaction);
    await transaction?.checkpoint();
    return {
      ok: true,
      path: target.path,
      before,
      after: contents,
      diffs: [{ path: target.path, before: before ?? '', after: contents }],
      ...(craft ? { craft } : {}),
    };
  },
};

interface ResolvedWritePath {
  path: string;
  migrateFrom?: string;
}

async function resolveReadFilePath(ctx: ToolContext, path: string): Promise<string> {
  const designAlias = await resolveHtmlFirstDesignMdAlias(ctx, path);
  if (!designAlias) return path;
  if (!ctx.workspacePath) return designAlias.path;
  if (await workspaceFileExistsExact(ctx.workspacePath, designAlias.path)) return designAlias.path;
  if (
    designAlias.migrateFrom &&
    (await workspaceFileExistsExact(ctx.workspacePath, designAlias.migrateFrom))
  ) {
    return designAlias.migrateFrom;
  }
  return designAlias.path;
}

async function resolveWriteFilePath(ctx: ToolContext, path: string): Promise<ResolvedWritePath> {
  const designAlias = await resolveHtmlFirstDesignMdAlias(ctx, path);
  return designAlias ?? { path };
}

async function resolveHtmlFirstDesignMdAlias(
  ctx: ToolContext,
  path: string,
): Promise<ResolvedWritePath | null> {
  if (!ctx.workspacePath || !(await isHtmlFirstWorkspace(ctx.workspacePath))) return null;
  const normalized = normalizeWorkspacePath(path);
  const lower = normalized.toLowerCase();
  if (lower !== 'design.md' && lower !== 'design/design.md') return null;
  return {
    path: HTML_DESIGN_SYSTEM_PATHS.designMd,
  };
}

async function isHtmlFirstWorkspace(workspacePath: string): Promise<boolean> {
  const raw = await readWorkspaceFile(workspacePath, '.sber-designer/project.sdproj').catch(
    () => null,
  );
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { projectKind?: unknown };
    return parsed.projectKind === 'html-first';
  } catch {
    return false;
  }
}

async function migrateHtmlFirstDesignAlias(
  workspacePath: string,
  fromPath: string,
  toPath: string,
): Promise<void> {
  if (fromPath === toPath) return;
  if (await workspaceFileExistsExact(workspacePath, toPath)) return;
  if (!(await workspaceFileExistsExact(workspacePath, fromPath))) return;
  await renameWorkspaceFile(workspacePath, fromPath, toPath);
}

async function validateChangedImports(workspacePath: string, paths: string[]): Promise<void> {
  for (const filePath of paths) {
    const contents = await readWorkspaceFile(workspacePath, filePath).catch(() => null);
    if (contents === null) continue;
    await validateWorkspaceRelativeImports(workspacePath, filePath, contents);
  }
}

async function rollbackChangedFiles(
  workspacePath: string,
  before: Map<string, string | null>,
): Promise<void> {
  for (const [filePath, contents] of before) {
    await restoreWorkspaceFileSnapshot(workspacePath, filePath, contents);
    markStorybookReloadPendingForPath(filePath, false);
  }
}

async function restoreWorkspaceFileSnapshot(
  workspacePath: string,
  filePath: string,
  contents: string | null,
): Promise<void> {
  if (contents === null) {
    try {
      await deleteWorkspaceFile(workspacePath, filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    return;
  }
  await writeWorkspaceFile(workspacePath, filePath, contents);
}

async function validateGeneratedSourceHealthOrThrow(
  ctx: ToolContext,
  paths: string[],
): Promise<void> {
  if (!ctx.workspacePath) return;
  const candidatePaths = Array.from(new Set(paths.map(normalizeWorkspacePath))).filter((path) =>
    /\.[cm]?[jt]sx$/u.test(path),
  );
  if (candidatePaths.length === 0) return;

  const health = await validateGeneratedSourceHealth({
    workspaceRoot: ctx.workspacePath,
    filePaths: candidatePaths,
  });
  if (health.ok) return;
  const detail = health.findings
    .filter((finding) => finding.severity === 'error')
    .map((finding) => {
      const loc =
        finding.line !== undefined && finding.column !== undefined
          ? `${finding.filePath}:${finding.line}:${finding.column}`
          : finding.filePath;
      return `${finding.ruleId} at ${loc}: ${finding.message}`;
    })
    .join('\n');
  throw new Error(`generated_source_health_failed\n${detail}`);
}

async function runCraftPostCheckSafely(
  ctx: ToolContext,
  paths: string[],
  transaction?: ToolMutationTransaction,
): Promise<
  | {
      status: 'passed' | 'findings' | 'blocked' | 'missing';
      checkedFiles: string[];
      blocking: number;
      shouldFix: number;
      advisory: number;
      findings: ScreenCraftFinding[];
    }
  | undefined
> {
  if (ctx.agentCraftPostCheckEnabled === false) return undefined;
  if (!ctx.workspacePath) return undefined;
  const craftablePaths = Array.from(new Set(paths.map(normalizeWorkspacePath))).filter((path) =>
    /\.[cm]?[tj]sx?$/u.test(path),
  );
  if (craftablePaths.length === 0) return undefined;

  const results: ScreenCraftResult[] = [];
  for (const filePath of craftablePaths) {
    const result = await validateScreenCraft({
      workspaceRoot: ctx.workspacePath,
      screen: { implementationFilePath: filePath },
      componentPack: ctx.componentPack,
      screenReadiness: ctx.screenReadiness,
      profile: ctx.screenCraftProfile,
    }).catch(() => null);
    if (result) results.push(result);
  }
  await runOrDeferMutationEffect(transaction, () => recordCraftReceiptSafely(ctx, results));
  return compactCraftResult(results);
}

async function runOrDeferMutationEffect(
  transaction: ToolMutationTransaction | undefined,
  effect: () => Promise<void>,
): Promise<void> {
  if (transaction) {
    transaction.deferCommit(effect);
    return;
  }
  await effect();
}

async function recordMutationRollbackReceipt(
  ctx: ToolContext,
  tool: 'apply_patch' | 'write_file',
  attemptedFiles: string[],
  reason: ToolMutationRollbackReason,
): Promise<void> {
  if (reason === 'handler_error') return;
  await recordToolReceiptSafely({
    workspacePath: ctx.workspacePath,
    runId: ctx.runId,
    tool,
    status: 'skipped',
    changedFiles: [],
    summary:
      reason === 'cancelled'
        ? `Rolled back ${tool} because the run was cancelled before the tool result committed.`
        : `Rolled back ${tool} because the stream closed before the tool result committed.`,
    metadata: { rolledBack: true, rollbackReason: reason, attemptedFiles },
  });
}

function compactCraftResult(results: ScreenCraftResult[]):
  | {
      status: 'passed' | 'findings' | 'blocked' | 'missing';
      checkedFiles: string[];
      blocking: number;
      shouldFix: number;
      advisory: number;
      findings: ScreenCraftFinding[];
    }
  | undefined {
  if (results.length === 0) return undefined;
  const findings = results.flatMap((result) =>
    result.findings.map((finding) => findingWithResolvedFilePath(finding, result.target.filePath)),
  );
  const blocking = findings.filter((finding) => finding.severity === 'blocking').length;
  const shouldFix = findings.filter((finding) => finding.severity === 'should-fix').length;
  const advisory = findings.filter((finding) => finding.severity === 'advisory').length;
  const checkedFiles = Array.from(
    new Set(results.flatMap((result) => result.summary.checkedFiles)),
  );
  return {
    status: blocking > 0 ? 'blocked' : findings.length > 0 ? 'findings' : 'passed',
    checkedFiles,
    blocking,
    shouldFix,
    advisory,
    findings: compactCraftFindings(findings),
  };
}

export async function recordCraftReceiptSafely(
  ctx: ToolContext,
  results: ScreenCraftResult[],
): Promise<void> {
  if (!ctx.workspacePath || !ctx.runId || results.length === 0) return;
  const findings = results.flatMap((result) =>
    result.findings.map((finding) => findingWithResolvedFilePath(finding, result.target.filePath)),
  );
  const blocking = findings.filter((finding) => finding.severity === 'blocking').length;
  const shouldFix = findings.filter((finding) => finding.severity === 'should-fix').length;
  const advisory = findings.filter((finding) => finding.severity === 'advisory').length;
  const status = blocking > 0 ? 'blocked' : findings.length > 0 ? 'findings' : 'passed';
  const checkedFiles = Array.from(
    new Set(results.flatMap((result) => result.summary.checkedFiles)),
  );
  const componentReuse = mergeComponentReuseSummaries(results);
  await recordToolReceiptSafely({
    workspacePath: ctx.workspacePath,
    runId: ctx.runId,
    tool: 'validate_screen_craft',
    status: 'ok',
    changedFiles: checkedFiles,
    summary:
      findings.length === 0
        ? `Craft post-check passed for ${checkedFiles.length} file${checkedFiles.length === 1 ? '' : 's'}.`
        : `Craft post-check found ${blocking} blocking, ${shouldFix} should-fix, and ${advisory} advisory finding${findings.length === 1 ? '' : 's'}.`,
    metadata: {
      status,
      checkedFiles,
      blocking,
      shouldFix,
      advisory,
      findings: compactCraftFindings(findings),
      ...(componentReuse ? { componentReuse } : {}),
      profile: results.at(-1)?.readiness?.profile,
      categoryResults: mergeReadinessCategoryResults(results),
    },
  });
}

function mergeReadinessCategoryResults(results: ScreenCraftResult[]): unknown {
  const latest = [...results].reverse().find((result) => result.readiness?.categoryResults);
  return latest?.readiness?.categoryResults ?? {};
}

function findingWithResolvedFilePath(
  finding: ScreenCraftFinding,
  fallbackFilePath: string | null,
): ScreenCraftFinding {
  const filePath = finding.filePath ?? fallbackFilePath;
  return filePath ? { ...finding, filePath } : finding;
}

function mergeComponentReuseSummaries(results: ScreenCraftResult[]):
  | {
      expected: string[];
      used: string[];
      missing: string[];
      exact: string[];
      substituted: NonNullable<ScreenCraftResult['componentReuse']>['substituted'];
      skipped: NonNullable<ScreenCraftResult['componentReuse']>['skipped'];
      requiredRoles: string[];
      usedComponentIds: string[];
      missingRequiredRoles: string[];
      designSystemGaps: string[];
      optionalSkipped: NonNullable<ScreenCraftResult['componentReuse']>['skipped'];
      score: NonNullable<ScreenCraftResult['componentReuse']>['score'];
    }
  | undefined {
  const summaries = results.map((result) => result.componentReuse).filter(Boolean) as NonNullable<
    ScreenCraftResult['componentReuse']
  >[];
  if (summaries.length === 0) return undefined;
  return {
    expected: uniqueSorted(summaries.flatMap((summary) => summary.expected)),
    used: uniqueSorted(summaries.flatMap((summary) => summary.used)),
    missing: uniqueSorted(summaries.flatMap((summary) => summary.missing)),
    exact: uniqueSorted(summaries.flatMap((summary) => summary.exact)),
    substituted: uniqueComponentReuseObjects(summaries.flatMap((summary) => summary.substituted)),
    skipped: uniqueComponentReuseObjects(summaries.flatMap((summary) => summary.skipped)),
    requiredRoles: uniqueSorted(summaries.flatMap((summary) => summary.requiredRoles ?? [])),
    usedComponentIds: uniqueSorted(summaries.flatMap((summary) => summary.usedComponentIds ?? [])),
    missingRequiredRoles: uniqueSorted(
      summaries.flatMap((summary) => summary.missingRequiredRoles ?? []),
    ),
    designSystemGaps: uniqueSorted(summaries.flatMap((summary) => summary.designSystemGaps ?? [])),
    optionalSkipped: uniqueComponentReuseObjects(
      summaries.flatMap((summary) => summary.optionalSkipped ?? []),
    ),
    score: mergeComponentReuseScore(summaries),
  };
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function uniqueComponentReuseObjects<T extends { role: string; expected: string }>(
  values: T[],
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const value of values) {
    const key = `${value.role}\u0000${value.expected}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result.sort((a, b) => a.expected.localeCompare(b.expected));
}

function mergeComponentReuseScore(
  summaries: NonNullable<ScreenCraftResult['componentReuse']>[],
): NonNullable<ScreenCraftResult['componentReuse']>['score'] {
  const earned =
    Math.round(summaries.reduce((sum, summary) => sum + summary.score.earned, 0) * 10) / 10;
  const total = summaries.reduce((sum, summary) => sum + summary.score.total, 0);
  return {
    earned,
    total,
    label: `${Number.isInteger(earned) ? earned : earned.toFixed(1)}/${total}`,
  };
}

function compactCraftFindings(findings: ScreenCraftFinding[]): ScreenCraftFinding[] {
  return findings.slice(0, 20).map((finding) => ({
    severity: finding.severity,
    ruleId: finding.ruleId,
    message: finding.message,
    ...(finding.filePath ? { filePath: finding.filePath } : {}),
    ...(finding.fixHint ? { fixHint: finding.fixHint } : {}),
    ...(finding.componentRole ? { componentRole: finding.componentRole } : {}),
    ...(finding.repairStage ? { repairStage: finding.repairStage } : {}),
  }));
}

// ---------- list_components --------------------------------------------
