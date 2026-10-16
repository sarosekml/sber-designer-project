import { Node, type SourceFile, SyntaxKind } from 'ts-morph';

import type { SourceLocation } from './types';

/**
 * Locate the JSX opening element (or self-closing element) at the given
 * 1-based (line, column). React Fiber's `_debugSource` points to the
 * `<` of the JSX opening tag — we find any descendant at the position
 * and walk up.
 *
 * Returns the JsxOpeningElement / JsxSelfClosingElement node — both
 * support attribute manipulation through the same set of methods.
 */
export function findJsxOpeningAt(sourceFile: SourceFile, loc: SourceLocation): JsxOpeningLike {
  const pos = sourceFile.compilerNode.getPositionOfLineAndCharacter(
    Math.max(0, loc.line - 1),
    Math.max(0, loc.column - 1),
  );
  const at = sourceFile.getDescendantAtPos(pos);
  if (!at) {
    throw new Error(`No node at ${loc.line}:${loc.column} in ${sourceFile.getFilePath()}`);
  }
  const opening = at.getFirstAncestor(
    (n) =>
      n.getKind() === SyntaxKind.JsxOpeningElement ||
      n.getKind() === SyntaxKind.JsxSelfClosingElement,
  );
  if (!opening) {
    throw new Error(
      `No JSX opening element at ${loc.line}:${loc.column} in ${sourceFile.getFilePath()}`,
    );
  }
  if (
    opening.getKind() !== SyntaxKind.JsxOpeningElement &&
    opening.getKind() !== SyntaxKind.JsxSelfClosingElement
  ) {
    throw new Error('Unreachable: ancestor predicate already filtered');
  }
  return opening as JsxOpeningLike;
}

/**
 * Union of the two ts-morph kinds we treat the same way for attribute
 * manipulation. Using `Node` here avoids a dependency on ts-morph's
 * generic argument types in our public API.
 */
export type JsxOpeningLike = Node;
