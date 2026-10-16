import { Node, type SourceFile, SyntaxKind } from 'ts-morph';

import { findJsxOpeningAt } from '../find-jsx';
import type { SwapComponentOp } from '../types';

/**
 * Rename the JSX tag at `loc`. For non-self-closing elements we also
 * rename the matching closing element so the source stays balanced.
 *
 * `setName(...)` on a JsxOpeningElement does this on its own when used
 * via the JsxElement parent — but we operate at the opening level, so
 * we touch both ends explicitly to be safe across ts-morph versions.
 */
export function applySwapComponent(sourceFile: SourceFile, op: SwapComponentOp): void {
  void sourceFile;
  const opening = findJsxOpeningAt(sourceFile, op.loc);

  if (opening.getKind() === SyntaxKind.JsxSelfClosingElement) {
    const sc = opening.asKindOrThrow(SyntaxKind.JsxSelfClosingElement);
    sc.getTagNameNode().replaceWithText(op.newName);
    return;
  }

  if (opening.getKind() === SyntaxKind.JsxOpeningElement) {
    const opn = opening.asKindOrThrow(SyntaxKind.JsxOpeningElement);
    const parent = opn.getParent();
    if (Node.isJsxElement(parent)) {
      parent.getOpeningElement().getTagNameNode().replaceWithText(op.newName);
      parent.getClosingElement().getTagNameNode().replaceWithText(op.newName);
      return;
    }
    // Fallback: just rename the opening tag and hope the closing matches
    // by structure. Should be unreachable on well-formed JSX.
    opn.getTagNameNode().replaceWithText(op.newName);
    return;
  }

  throw new Error(`Unexpected node kind for swap-component: ${opening.getKindName()}`);
}
