import {
  type JsxAttribute,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  Node,
  type SourceFile,
  SyntaxKind,
} from 'ts-morph';

import { findJsxOpeningAt } from '../find-jsx';
import type { SetClassNameOp } from '../types';

export function applySetClassName(sourceFile: SourceFile, op: SetClassNameOp): void {
  const opening = asOpeningLike(findJsxOpeningAt(sourceFile, op.loc));
  const existing = opening.getAttribute('className');

  if (existing) {
    if (existing.getKind() !== SyntaxKind.JsxAttribute) {
      throw new Error(
        `Cannot edit spread className at ${op.loc.line}:${op.loc.column}; ask the assistant instead.`,
      );
    }
    assertEditableClassName(existing.asKindOrThrow(SyntaxKind.JsxAttribute), op);
    existing.remove();
  }

  opening.addAttribute({
    name: 'className',
    initializer: JSON.stringify(op.value),
  });
}

function assertEditableClassName(attr: JsxAttribute, op: SetClassNameOp): void {
  const initializer = attr.getInitializer();
  if (!initializer) {
    throw new Error(
      `Cannot edit boolean className at ${op.loc.line}:${op.loc.column}; ask the assistant instead.`,
    );
  }
  if (Node.isStringLiteral(initializer)) return;
  if (initializer.getKind() === SyntaxKind.JsxExpression) {
    const expression = initializer.asKindOrThrow(SyntaxKind.JsxExpression).getExpression();
    if (expression && Node.isStringLiteral(expression)) return;
  }
  throw new Error(
    `Cannot edit expression-based className at ${op.loc.line}:${op.loc.column}; ask the assistant instead.`,
  );
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
