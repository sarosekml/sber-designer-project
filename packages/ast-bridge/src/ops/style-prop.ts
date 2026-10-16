import {
  type JsxAttribute,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  Node,
  type ObjectLiteralExpression,
  type SourceFile,
  SyntaxKind,
} from 'ts-morph';

import { findJsxOpeningAt } from '../find-jsx';
import type { RemoveStylePropOp, SetStylePropOp } from '../types';

export function applySetStyleProp(sourceFile: SourceFile, op: SetStylePropOp): void {
  const opening = asOpeningLike(findJsxOpeningAt(sourceFile, op.loc));
  const styleAttr = getJsxAttribute(opening, 'style');

  if (!styleAttr) {
    opening.addAttribute({
      name: 'style',
      initializer: `{{ ${formatStyleKey(op.name)}: ${op.value} }}`,
    });
    return;
  }

  const object = getEditableStyleObject(styleAttr, op.loc);
  removePropertyIfPresent(object, op.name);
  object.addPropertyAssignment({
    name: formatStyleKey(op.name),
    initializer: op.value,
  });
}

export function applyRemoveStyleProp(sourceFile: SourceFile, op: RemoveStylePropOp): void {
  const opening = asOpeningLike(findJsxOpeningAt(sourceFile, op.loc));
  const styleAttr = getJsxAttribute(opening, 'style');
  if (!styleAttr) return;

  const object = getEditableStyleObject(styleAttr, op.loc);
  removePropertyIfPresent(object, op.name);
  if (object.getProperties().length === 0) {
    styleAttr.remove();
  }
}

function getEditableStyleObject(
  attr: JsxAttribute,
  loc: { line: number; column: number },
): ObjectLiteralExpression {
  const initializer = attr.getInitializer();
  if (!initializer || initializer.getKind() !== SyntaxKind.JsxExpression) {
    throw new Error(`Cannot edit non-expression style prop at ${loc.line}:${loc.column}.`);
  }
  const rawExpression = initializer.asKindOrThrow(SyntaxKind.JsxExpression).getExpression();
  // Unwrap `as`/`satisfies`/parentheses so a typed style object literal —
  // e.g. `style={{ ... } as React.CSSProperties}`, which custom CSS properties
  // such as `--sd-modal-width` require — is still editable (0132, риск №16).
  const expression = rawExpression ? unwrapStyleExpression(rawExpression) : undefined;
  if (!expression || !Node.isObjectLiteralExpression(expression)) {
    throw new Error(
      `Cannot edit complex style expression at ${loc.line}:${loc.column}; ask the assistant instead.`,
    );
  }
  for (const property of expression.getProperties()) {
    if (Node.isSpreadAssignment(property)) {
      throw new Error(
        `Cannot edit style object with spread properties at ${loc.line}:${loc.column}; ask the assistant instead.`,
      );
    }
  }
  return expression;
}

/** Peel `as T`, `satisfies T`, and parentheses to reach the underlying value. */
function unwrapStyleExpression(node: Node): Node {
  let current = node;
  for (;;) {
    if (Node.isAsExpression(current) || Node.isSatisfiesExpression(current)) {
      current = current.getExpression();
      continue;
    }
    if (Node.isParenthesizedExpression(current)) {
      current = current.getExpression();
      continue;
    }
    return current;
  }
}

function removePropertyIfPresent(object: ObjectLiteralExpression, name: string): void {
  const existing = object.getProperties().find((property) => propertyName(property) === name);
  existing?.remove();
}

function propertyName(node: Node): string | null {
  if (!Node.isPropertyAssignment(node) && !Node.isShorthandPropertyAssignment(node)) return null;
  const nameNode = node.getNameNode();
  if (Node.isStringLiteral(nameNode) || Node.isNoSubstitutionTemplateLiteral(nameNode)) {
    return nameNode.getLiteralText();
  }
  return nameNode.getText();
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

function getJsxAttribute(
  opening: JsxOpeningElement | JsxSelfClosingElement,
  name: string,
): JsxAttribute | null {
  const attr = opening.getAttribute(name);
  if (!attr) return null;
  if (attr.getKind() !== SyntaxKind.JsxAttribute) {
    throw new Error(`Cannot edit ${name} when it is represented as a spread attribute.`);
  }
  return attr.asKindOrThrow(SyntaxKind.JsxAttribute);
}

function formatStyleKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}
