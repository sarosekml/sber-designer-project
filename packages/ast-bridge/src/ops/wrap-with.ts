import { Node, type SourceFile, SyntaxKind } from 'ts-morph';

import { findJsxOpeningAt } from '../find-jsx';
import type { WrapWithOp } from '../types';

/**
 * Wrap the JSX element at `loc` with `<wrapperName ...attrs>...</wrapperName>`.
 * Works for both JsxElement and JsxSelfClosingElement targets.
 */
export function applyWrapWith(sourceFile: SourceFile, op: WrapWithOp): void {
  void sourceFile;
  const opening = findJsxOpeningAt(sourceFile, op.loc);
  const target =
    opening.getKind() === SyntaxKind.JsxSelfClosingElement
      ? opening
      : Node.isJsxElement(opening.getParent())
        ? opening.getParent()
        : opening;

  if (!target) {
    throw new Error(`Could not resolve target JSX element at ${op.loc.line}:${op.loc.column}.`);
  }

  const inner = target.getText();
  const attrs = op.wrapperAttrs?.length ? ' ' + op.wrapperAttrs.join(' ') : '';
  const wrapped = `<${op.wrapperName}${attrs}>${inner}</${op.wrapperName}>`;

  // Use replaceWithText — coarse but correct for this transformation.
  // Re-parsing happens automatically on the next op against the same
  // file because Project tracks SourceFile updates.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (target as unknown as { replaceWithText: (s: string) => Node }).replaceWithText(wrapped);
}
