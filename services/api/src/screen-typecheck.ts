/**
 * 0083 G3 — deterministic TypeScript craft gate for generated screens.
 *
 * Every contract failure we saw on real runs is a TS type error against the
 * connected project's own types:
 *  - wrong prop name      `<Icon iconName=…>`   → "Property 'iconName' does not exist"
 *  - wrong prop value type `startIcon={<Icon/>}` → "Type 'Element' is not assignable to 'IconName'"
 *  - invalid union token  `type="Body_M_Regular"` → "Type '…' is not assignable to 'TextTypes'"
 *  - wrong import / collision (kit `Grid` used with MUI props) → prop-not-on-type
 *
 * The runtime render gate surfaces these only as cryptic crashes ("Page is not
 * defined", "Element type is invalid"). Running the project's types over just
 * the generated file turns the whole class into precise, blocking findings the
 * agent fix-loop and the reviewer can act on — model-independent.
 *
 * Cost: type resolution needs the dependency types, so the first call loads the
 * project program (seconds on a large repo). We cache one program per tsconfig
 * and re-check only the changed file on later runs. The gate is best-effort:
 * any failure (no tsconfig, load error) degrades to zero findings, never breaks
 * the craft run.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';

import { Project, ts } from 'ts-morph';

import { resolveInside } from '@sber-designer/ast-bridge';
import type { ScreenCraftFinding } from './screen-craft';

const MAX_TYPE_FINDINGS = 6;
const TS_CONFIG_CANDIDATES = ['tsconfig.json', 'tsconfig.app.json', 'tsconfig.base.json'];

/** One heavy, type-resolving project per tsconfig — reused across generations. */
const projectCache = new Map<string, Project>();

export interface ScreenTypecheckInput {
  workspaceRoot: string;
  /** Workspace-relative path to the generated screen source. */
  filePath: string;
}

export async function findScreenTypeErrors(
  input: ScreenTypecheckInput,
): Promise<ScreenCraftFinding[]> {
  let absPath: string;
  try {
    absPath = resolveInside(input.workspaceRoot, input.filePath);
  } catch {
    return [];
  }

  const tsConfigFilePath = findTsConfig(input.workspaceRoot);
  if (!tsConfigFilePath) return []; // non-TS / empty repo: gate degrades to no-op

  try {
    const project = getProject(tsConfigFilePath);

    let sourceFile = project.getSourceFile(absPath);
    if (sourceFile) {
      // The file was just (re)generated on disk — pull the new contents in.
      sourceFile.refreshFromFileSystemSync();
    } else {
      sourceFile = project.addSourceFileAtPathIfExists(absPath) ?? undefined;
    }
    if (!sourceFile) return [typecheckUnavailable(input.filePath, 'file_not_in_program')];

    const program = project.getProgram();
    const diagnostics = [
      ...program.getSyntacticDiagnostics(sourceFile),
      ...program.getSemanticDiagnostics(sourceFile),
    ].filter((diag) => diag.getCategory() === ts.DiagnosticCategory.Error);

    const findings: ScreenCraftFinding[] = [];
    for (const diag of diagnostics) {
      if (findings.length >= MAX_TYPE_FINDINGS) break;
      const message = ts.flattenDiagnosticMessageText(diag.compilerObject.messageText, '\n');
      const line = diag.getLineNumber();
      findings.push({
        severity: 'blocking',
        ruleId: 'craft.type-error',
        message: `TypeScript TS${diag.getCode()}: ${message}${line ? ` (line ${line})` : ''}`,
        filePath: input.filePath,
        fixHint:
          'Match the component contract from the project types: exact prop names, ' +
          'value shapes, valid union tokens, and the correct import module.',
      });
    }
    return findings;
  } catch {
    // A TS project whose program failed to load must NOT pass silently — that
    // would defeat the gate. Surface it as a visible (non-blocking) finding so
    // receipts/transcript show the gate did not actually run.
    return [typecheckUnavailable(input.filePath, 'project_load_failed')];
  }
}

/**
 * The project has a tsconfig but the gate could not verify types. Visible but
 * non-blocking — distinguishes "checked, clean" from "could not check".
 */
function typecheckUnavailable(
  filePath: string,
  reason: 'project_load_failed' | 'file_not_in_program',
): ScreenCraftFinding {
  return {
    severity: 'should-fix',
    ruleId: 'craft.typecheck-unavailable',
    message: `TypeScript craft gate could not run (${reason}); screen types were not verified.`,
    filePath,
    fixHint:
      'The project has a tsconfig but its type program did not load. Verify the tsconfig is valid and the screen file is included, then re-run craft validation.',
  };
}

function findTsConfig(workspaceRoot: string): string | null {
  for (const name of TS_CONFIG_CANDIDATES) {
    const candidate = path.join(workspaceRoot, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function getProject(tsConfigFilePath: string): Project {
  const cached = projectCache.get(tsConfigFilePath);
  if (cached) return cached;
  const project = new Project({ tsConfigFilePath });
  projectCache.set(tsConfigFilePath, project);
  return project;
}

/** Test seam: drop cached programs so a fixture rebuild is picked up. */
export function resetScreenTypecheckCache(): void {
  projectCache.clear();
}
