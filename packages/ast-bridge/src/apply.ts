/**
 * Atomic patch application. Loads each touched file into an in-memory
 * ts-morph Project, applies every op, then writes the changed files in
 * one shot. If any op throws, nothing is written — Project.save runs
 * only after the whole loop succeeds.
 *
 * Per-call Project (no caching across calls) — keeps things simple at
 * PoC scale. Phase 3 may share a per-workspace Project for speed.
 */
import { existsSync } from 'node:fs';
import { Project, type SourceFile } from 'ts-morph';

import { applyAddImport } from './ops/add-import';
import { applyRemoveProp } from './ops/remove-prop';
import { applyReplaceText } from './ops/replace-text';
import { applySetClassName } from './ops/set-class-name';
import { applySetChildrenText } from './ops/set-children-text';
import { applySetProp } from './ops/set-prop';
import { applyRemoveStyleProp, applySetStyleProp } from './ops/style-prop';
import { applySwapComponent } from './ops/swap-component';
import { applyWrapWith } from './ops/wrap-with';
import { resolveInside } from './safe-path';
import type { ApplyPatchInput, ApplyPatchResult, AppliedOpResult, Op } from './types';

export async function applyOps(input: ApplyPatchInput): Promise<ApplyPatchResult> {
  const project = new Project({
    // Don't auto-resolve project-wide tsconfig — we only manipulate the
    // exact files mentioned in ops. This keeps memory bounded even on
    // a 5000-file repo.
    useInMemoryFileSystem: false,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    skipLoadingLibFiles: true,
  });

  const loaded = new Map<string, SourceFile>();
  const opResults: AppliedOpResult[] = [];

  const loadFile = (relPath: string): SourceFile => {
    const cached = loaded.get(relPath);
    if (cached) return cached;
    const abs = resolveInside(input.workspaceRoot, relPath);
    if (!existsSync(abs)) {
      throw new Error(`File not found in workspace: ${relPath}`);
    }
    const source = project.addSourceFileAtPath(abs);
    loaded.set(relPath, source);
    return source;
  };

  for (const op of input.ops) {
    runOne(op, loadFile);
    opResults.push({ kind: op.kind, file: op.file });
  }

  // All ops succeeded — write changed files.
  await project.save();

  return {
    ok: true,
    changedFiles: [...loaded.keys()],
    ops: opResults,
  };
}

function runOne(op: Op, load: (path: string) => SourceFile): void {
  switch (op.kind) {
    case 'set-prop': {
      applySetProp(load(op.file), op);
      return;
    }
    case 'remove-prop': {
      applyRemoveProp(load(op.file), op);
      return;
    }
    case 'set-style-prop': {
      applySetStyleProp(load(op.file), op);
      return;
    }
    case 'remove-style-prop': {
      applyRemoveStyleProp(load(op.file), op);
      return;
    }
    case 'set-class-name': {
      applySetClassName(load(op.file), op);
      return;
    }
    case 'add-import': {
      applyAddImport(load(op.file), op);
      return;
    }
    case 'swap-component': {
      applySwapComponent(load(op.file), op);
      return;
    }
    case 'wrap-with': {
      applyWrapWith(load(op.file), op);
      return;
    }
    case 'set-children-text': {
      applySetChildrenText(load(op.file), op);
      return;
    }
    case 'replace-text': {
      applyReplaceText(load(op.file), op);
      return;
    }
    default: {
      const exhaustive: never = op;
      throw new Error(`Unknown op kind: ${JSON.stringify(exhaustive)}`);
    }
  }
}
