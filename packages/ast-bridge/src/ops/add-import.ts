import type { SourceFile } from 'ts-morph';

import type { AddImportOp } from '../types';

/**
 * Idempotent. Add a named (or default) import to the file. If an import
 * declaration for the same module already exists, attach to it; otherwise
 * insert a new one at the top of the file (after any leading directives).
 */
export function applyAddImport(sourceFile: SourceFile, op: AddImportOp): void {
  const existing = sourceFile.getImportDeclaration(
    (decl) => decl.getModuleSpecifierValue() === op.source,
  );

  if (op.default) {
    if (existing) {
      const current = existing.getDefaultImport()?.getText();
      if (current === op.name) return;
      if (!current) {
        existing.setDefaultImport(op.name);
        return;
      }
      throw new Error(
        `Refusing to clobber default import "${current}" with "${op.name}" in ${op.file}`,
      );
    }
    sourceFile.addImportDeclaration({
      defaultImport: op.name,
      moduleSpecifier: op.source,
    });
    return;
  }

  // Named import.
  if (existing) {
    const already = existing.getNamedImports().some((n) => n.getName() === op.name);
    if (already) return;
    existing.addNamedImport(op.name);
    return;
  }
  sourceFile.addImportDeclaration({
    namedImports: [op.name],
    moduleSpecifier: op.source,
  });
}
