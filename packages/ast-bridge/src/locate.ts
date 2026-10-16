/**
 * Locate JSX elements by a marker attribute (0132.3). The managed modal target
 * has no DOM selection to resolve — the server finds the `data-sd-modal-window`
 * element directly in source and edits it through the normal ops. Positions are
 * text offsets, so an in-memory project is enough.
 */
import { Project, SyntaxKind } from 'ts-morph';

import type { SourceLocation } from './types';

/**
 * Return the 1-based `<`-anchored source locations of every JSX opening (or
 * self-closing) element that carries a plain (non-spread) attribute named
 * `attributeName`. The result feeds directly into the same `loc` the ops use.
 */
export function locateJsxAttributeElements(
  source: string,
  attributeName: string,
  fileName = 'in-memory.tsx',
): SourceLocation[] {
  const project = new Project({
    useInMemoryFileSystem: true,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    skipLoadingLibFiles: true,
  });
  const sourceFile = project.createSourceFile(fileName, source, { overwrite: true });
  const results: SourceLocation[] = [];
  sourceFile.forEachDescendant((node) => {
    const opening =
      node.asKind(SyntaxKind.JsxOpeningElement) ?? node.asKind(SyntaxKind.JsxSelfClosingElement);
    if (!opening) return;
    const attribute = opening.getAttribute(attributeName);
    if (!attribute || attribute.getKind() !== SyntaxKind.JsxAttribute) return;
    const start = node.getStart();
    const lineChar = sourceFile.compilerNode.getLineAndCharacterOfPosition(start);
    results.push({ line: lineChar.line + 1, column: lineChar.character + 1 });
  });
  return results;
}
