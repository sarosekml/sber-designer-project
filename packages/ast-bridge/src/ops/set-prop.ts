import {
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  Node,
  type SourceFile,
  SyntaxKind,
  ts,
} from 'ts-morph';

import { findJsxOpeningAt } from '../find-jsx';
import type { SetPropOp } from '../types';

/**
 * Set or replace a JSX attribute. Value is a TypeScript expression as a
 * string — it's wrapped into `{...}` if it isn't a string literal.
 *
 * Heuristics:
 *   - `value` matches /^"..."$/ or /^'...'$/  → emit as a literal
 *     (`name="..."`); ts-morph will own the punctuation.
 *   - otherwise wrap in `{ ... }` → expression container.
 */
export function applySetProp(sourceFile: SourceFile, op: SetPropOp): void {
  const node = findJsxOpeningAt(sourceFile, op.loc);
  const opening = asOpeningLike(node);
  const value = normalizeSetPropValue(op.value);
  const initializer = isStringLiteralExpression(value) ? value : `{${value}}`;

  // Update in place so re-setting a prop keeps its position: rewriting
  // `variant` should not move it to the end of the attribute list and turn a
  // one-token edit into a reshuffled line in review.
  const existing = opening.getAttribute(op.name);
  if (existing && Node.isJsxAttribute(existing)) {
    existing.setInitializer(initializer);
    return;
  }
  if (existing) existing.remove();

  opening.addAttribute({ name: op.name, initializer });
}

function asOpeningLike(n: Node): JsxOpeningElement | JsxSelfClosingElement {
  if (n.getKind() === SyntaxKind.JsxOpeningElement) {
    return n.asKindOrThrow(SyntaxKind.JsxOpeningElement);
  }
  if (n.getKind() === SyntaxKind.JsxSelfClosingElement) {
    return n.asKindOrThrow(SyntaxKind.JsxSelfClosingElement);
  }
  throw new Error(`Expected JsxOpeningElement or JsxSelfClosingElement, got ${n.getKindName()}`);
}

function isStringLiteralExpression(value: string): boolean {
  const trimmed = value.trim();
  return (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  );
}

function normalizeSetPropValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return raw;
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return raw;
  return parsesAsExpression(inner) ? inner : raw;
}

function parsesAsExpression(value: string): boolean {
  const source = ts.createSourceFile(
    'expr.ts',
    `const __sberDesignerValue = (${value});`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  // `parseDiagnostics` is real but internal: the public SourceFile type does
  // not declare it, so name the shape we rely on instead of casting to any.
  const parsed = source as ts.SourceFile & { parseDiagnostics?: readonly unknown[] };
  return (parsed.parseDiagnostics?.length ?? 0) === 0;
}
