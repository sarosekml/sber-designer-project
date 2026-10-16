import { Node, type SourceFile, SyntaxKind } from 'ts-morph';

import { findJsxOpeningAt } from '../find-jsx';
import type { SetChildrenTextOp } from '../types';

/**
 * Replace the children of the JSX element at `loc` with a single text
 * node. A self-closing usage is expanded to an opening/closing pair.
 *
 * The text is escaped so JSX-special characters (`<`, `>`, `{`, `}`)
 * are written as `{...}` expression containers when needed.
 */
export function applySetChildrenText(sourceFile: SourceFile, op: SetChildrenTextOp): void {
  void sourceFile;
  const opening = findJsxOpeningAt(sourceFile, op.loc);
  if (opening.getKind() === SyntaxKind.JsxSelfClosingElement) {
    const selfClosing = opening.asKindOrThrow(SyntaxKind.JsxSelfClosingElement);
    const openingText = selfClosing.getText().replace(/\s*\/>$/u, '>');
    const closingText = `</${selfClosing.getTagNameNode().getText()}>`;
    const safe = canBePlainJsxText(op.text) ? op.text : `{${JSON.stringify(op.text)}}`;
    selfClosing.replaceWithText(`${openingText}${safe}${closingText}`);
    return;
  }

  const parent = opening.getParent();
  if (!Node.isJsxElement(parent)) {
    throw new Error(
      `Expected JsxElement parent at ${op.loc.line}:${op.loc.column}, got ${parent?.getKindName() ?? 'undefined'}`,
    );
  }

  const safe = canBePlainJsxText(op.text) ? op.text : `{${JSON.stringify(op.text)}}`;

  // ts-morph doesn't expose addChild on JsxElement directly — we operate
  // through replaceWithText for this. Build the new opening + children +
  // closing string from the current structure.
  const opening2 = parent.getOpeningElement().getText();
  const closing2 = parent.getClosingElement().getText();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (parent as unknown as { replaceWithText: (s: string) => Node }).replaceWithText(
    `${opening2}${safe}${closing2}`,
  );
}

function canBePlainJsxText(s: string): boolean {
  // JSX text rules are loose, but `{` and `}` always need escaping; `<`
  // and `>` would start a tag. Anything else stays literal.
  return !/[<>{}]/.test(s);
}
