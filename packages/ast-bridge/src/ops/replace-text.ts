import type { SourceFile } from 'ts-morph';

import type { ReplaceTextOp } from '../types';

export function applyReplaceText(sourceFile: SourceFile, op: ReplaceTextOp): void {
  const text = sourceFile.getFullText();
  const first = text.indexOf(op.oldText);
  if (first < 0) {
    throw new Error(`replace-text oldText not found in ${sourceFile.getFilePath()}`);
  }
  if (text.indexOf(op.oldText, first + op.oldText.length) >= 0) {
    throw new Error(`replace-text oldText is not unique in ${sourceFile.getFilePath()}`);
  }
  sourceFile.replaceWithText(
    text.slice(0, first) + op.newText + text.slice(first + op.oldText.length),
  );
}
