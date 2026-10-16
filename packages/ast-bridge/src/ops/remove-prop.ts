import {
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  Node,
  type SourceFile,
  SyntaxKind,
} from 'ts-morph';

import { findJsxOpeningAt } from '../find-jsx';
import type { RemovePropOp } from '../types';

export function applyRemoveProp(sourceFile: SourceFile, op: RemovePropOp): void {
  const node = findJsxOpeningAt(sourceFile, op.loc);
  const opening = asOpeningLike(node);
  const existing = opening.getAttribute(op.name);
  if (!existing) {
    throw new Error(
      `Attribute "${op.name}" not found at ${op.loc.line}:${op.loc.column} in ${op.file}`,
    );
  }
  existing.remove();
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
