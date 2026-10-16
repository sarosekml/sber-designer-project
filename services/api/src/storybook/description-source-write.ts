/**
 * 0083 Phase 3.1 — write the `Description for AI` markdown into a Storybook CSF
 * story's `meta.parameters.docs.description.component`.
 *
 * AST-aware (ts-morph): it locates `meta` (inline `export default {}`, a named
 * `const meta = … satisfies/as Meta; export default meta`, with or without an
 * existing `parameters` object) and merges only the description path, leaving the
 * rest of `parameters` (backgrounds / controls / decorators / …) untouched. It
 * never writes when it cannot do so safely — the caller then falls back to the
 * sidecar (no silent or risky source mutation, task 0083 write-safety contract).
 *
 * Reading the value back is `usage-metadata` (the indexer's parser); this is its
 * write counterpart. `ast-bridge` is DOM↔JSX for the canvas, not CSF meta, so the
 * writer lives here next to the description tool that uses it.
 */
import { Node, Project, type ObjectLiteralExpression, type SourceFile } from 'ts-morph';

export type ApplyDescriptionReason =
  | 'parse_failed'
  | 'meta_not_static_object'
  | 'parameters_not_object'
  | 'docs_not_object'
  | 'description_not_object'
  | 'component_dynamic'
  | 'component_has_project_prose';

export interface ApplyDescriptionResult {
  ok: boolean;
  /** Full new file source when ok; undefined on fallback. */
  newSource?: string;
  /** Why the writer declined (caller falls back to the sidecar). */
  reason?: ApplyDescriptionReason;
}

/** A `## Description for AI` heading — marks a section authored by this tool. */
const SECTION_RE = /^#{1,6}\s*description\s+for\s+ai\s*$/im;

/**
 * Merge `markdown` into `meta.parameters.docs.description.component` of a CSF
 * source string. Pure (no disk). Returns `ok:false` with a reason when the meta
 * is not a static object, `parameters`/`docs`/`description` is not a plain object
 * (spread/helper-call), or an existing `component` holds project prose we must
 * not clobber — the caller then writes the sidecar instead.
 */
export function applyDescriptionToCsfSource(input: {
  source: string;
  filePath: string;
  markdown: string;
}): ApplyDescriptionResult {
  let sourceFile: SourceFile;
  try {
    const project = new Project({ useInMemoryFileSystem: true });
    sourceFile = project.createSourceFile(input.filePath, input.source, { overwrite: true });
  } catch {
    return { ok: false, reason: 'parse_failed' };
  }

  const meta = resolveMetaObject(sourceFile);
  if (!meta) return { ok: false, reason: 'meta_not_static_object' };

  const parameters = ensureObjectProperty(meta, 'parameters');
  if (!parameters) return { ok: false, reason: 'parameters_not_object' };
  const docs = ensureObjectProperty(parameters, 'docs');
  if (!docs) return { ok: false, reason: 'docs_not_object' };
  const description = ensureObjectProperty(docs, 'description');
  if (!description) return { ok: false, reason: 'description_not_object' };

  const existing = description.getProperty('component');
  if (existing) {
    if (!Node.isPropertyAssignment(existing)) return { ok: false, reason: 'component_dynamic' };
    const value = stringLiteralValue(existing.getInitializer());
    if (value === null) return { ok: false, reason: 'component_dynamic' };
    if (!value.trim()) {
      existing.setInitializer(JSON.stringify(input.markdown));
    } else if (SECTION_RE.test(value)) {
      // 0083 R2: replace only the `## Description for AI` section, preserving any
      // human prose before/after it. If the section region holds free prose we
      // cannot cleanly separate, fall back rather than drop it.
      const spliced = spliceDescriptionSection(value, input.markdown);
      if (spliced === 'ambiguous') return { ok: false, reason: 'component_has_project_prose' };
      existing.setInitializer(JSON.stringify(spliced));
    } else {
      // Project prose with no AI section — never clobber it.
      return { ok: false, reason: 'component_has_project_prose' };
    }
  } else {
    description.addPropertyAssignment({
      name: 'component',
      initializer: JSON.stringify(input.markdown),
    });
  }

  return { ok: true, newSource: sourceFile.getFullText() };
}

const SECTION_HEADING = /^(#{1,6})\s*description\s+for\s+ai\s*$/i;
const ANY_HEADING = /^(#{1,6})\s+/;

/**
 * Replace only the `## Description for AI` section of `existing`, keeping the
 * prose before and after it. Returns 'ambiguous' when the section region holds
 * free prose (a non-label/bullet/code line) we cannot separate cleanly — the
 * caller then falls back to the sidecar rather than risk dropping human text.
 */
function spliceDescriptionSection(existing: string, section: string): string | 'ambiguous' {
  const lines = existing.split(/\r?\n/);
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const match = SECTION_HEADING.exec(lines[i] ?? '');
    if (match) {
      start = i;
      level = match[1]!.length;
      break;
    }
  }
  if (start === -1) return 'ambiguous';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const heading = ANY_HEADING.exec(lines[i] ?? '');
    if (heading && (heading[1]?.length ?? 6) <= level) {
      end = i;
      break;
    }
  }
  if (hasFreeProse(lines.slice(start + 1, end))) return 'ambiguous';
  const before = trimEdgeBlanks(lines.slice(0, start), 'end');
  const after = trimEdgeBlanks(lines.slice(end), 'start');
  const out: string[] = [];
  if (before.length) out.push(...before, '');
  out.push(...section.split('\n'));
  if (after.length) out.push('', ...after);
  return out.join('\n');
}

/** True when a line is human free prose (not a `**Label:**`, bullet, or code). */
function hasFreeProse(lines: string[]): boolean {
  let inFence = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || !line) continue;
    if (/^\*\*[^*]+\*\*/.test(line)) continue; // **Label:** …
    if (/^[-*]\s/.test(line)) continue; // bullet
    return true;
  }
  return false;
}

function trimEdgeBlanks(lines: string[], edge: 'start' | 'end'): string[] {
  const out = [...lines];
  if (edge === 'end') {
    while (out.length && !(out[out.length - 1] ?? '').trim()) out.pop();
  } else {
    while (out.length && !(out[0] ?? '').trim()) out.shift();
  }
  return out;
}

/** Resolve the `meta` object literal from the default export, or null if dynamic. */
function resolveMetaObject(sourceFile: SourceFile): ObjectLiteralExpression | null {
  const exportAssignment = sourceFile.getExportAssignment((ea) => !ea.isExportEquals());
  if (!exportAssignment) return null;
  let expr: Node = unwrap(exportAssignment.getExpression());
  if (Node.isIdentifier(expr)) {
    const init = sourceFile.getVariableDeclaration(expr.getText())?.getInitializer();
    if (!init) return null;
    expr = unwrap(init);
  }
  return Node.isObjectLiteralExpression(expr) ? expr : null;
}

/** Strip `as Meta` / `satisfies Meta` / parens / `!` so we reach the object. */
function unwrap(node: Node): Node {
  let current = node;
  while (
    Node.isAsExpression(current) ||
    Node.isSatisfiesExpression(current) ||
    Node.isParenthesizedExpression(current) ||
    Node.isNonNullExpression(current)
  ) {
    current = current.getExpression();
  }
  return current;
}

/**
 * Get a nested object-literal property, creating it as `{}` when absent. Returns
 * null when the property exists but is not a plain object literal (a spread, a
 * shorthand, or a helper call like `describeComponent(...)`) — then the caller
 * falls back rather than risk a wrong merge.
 */
function ensureObjectProperty(
  obj: ObjectLiteralExpression,
  name: string,
): ObjectLiteralExpression | null {
  const existing = obj.getProperty(name);
  if (existing) {
    if (!Node.isPropertyAssignment(existing)) return null;
    const init = existing.getInitializer();
    return init && Node.isObjectLiteralExpression(init) ? init : null;
  }
  const init = obj.addPropertyAssignment({ name, initializer: '{}' }).getInitializer();
  return init && Node.isObjectLiteralExpression(init) ? init : null;
}

/** Literal value of a string/template node, or null for dynamic expressions. */
function stringLiteralValue(node: Node | undefined): string | null {
  if (!node) return null;
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralText();
  }
  return null;
}
