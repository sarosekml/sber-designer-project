// @sber-designer/ast-bridge — public surface (ADR-0013).
export { applyOps } from './apply';
export { locateJsxAttributeElements } from './locate';
export { ApplyPatchInputSchema, OpSchema } from './schema';
export { canonicalizeInside, resolveInside, WorkspaceEscape } from './safe-path';
export type { ResolvedWorkspacePath } from './safe-path';
export type {
  AddImportOp,
  AppliedOpResult,
  ApplyPatchInput,
  ApplyPatchResult,
  Op,
  RemoveStylePropOp,
  RemovePropOp,
  ReplaceTextOp,
  SetClassNameOp,
  SetChildrenTextOp,
  SetPropOp,
  SetStylePropOp,
  SourceLocation,
  SwapComponentOp,
  WrapWithOp,
} from './types';

/** Format a SourceLocation as the "file:line:col" string used by data-sd-loc. */
export function formatLoc(loc: { file?: string; line: number; column: number }): string {
  return loc.file ? `${loc.file}:${loc.line}:${loc.column}` : `${loc.line}:${loc.column}`;
}

/** Inverse of formatLoc — parses "file:line:col" or just "line:col". */
export function parseLoc(s: string): { file?: string; line: number; column: number } | null {
  // file:line:col → file may itself contain colons on Windows ("C:/..."), so
  // we anchor by the trailing pattern (\d+):(\d+).
  const tail = /:(\d+):(\d+)$/.exec(s);
  if (!tail) {
    const noFile = /^(\d+):(\d+)$/.exec(s);
    if (!noFile) return null;
    return { line: Number(noFile[1]), column: Number(noFile[2]) };
  }
  const file = s.slice(0, tail.index);
  return {
    ...(file ? { file } : {}),
    line: Number(tail[1]),
    column: Number(tail[2]),
  };
}
