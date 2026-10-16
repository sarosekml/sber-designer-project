/**
 * `.agents/` path boundary. Delegates to the one canonical workspace
 * boundary (0136 R02) so a symlink inside the kit cannot read or write
 * outside it — the previous local copy only compared resolved prefixes.
 *
 * Returns the lexical path: kit consumers derive display paths relative to
 * the root they passed in, so handing back a canonicalized root prefix would
 * change what the loader reports. The escape check is canonical either way.
 */
import { canonicalizeInside, WorkspaceEscape } from '@sber-designer/ast-bridge';

export function resolveInsideAgentsRoot(root: string, relativePath: string): string {
  if (!relativePath) throw new Error(`Invalid .agents path: ${relativePath}`);
  try {
    return canonicalizeInside(root, relativePath).lexicalPath;
  } catch (error) {
    if (error instanceof WorkspaceEscape) {
      throw new Error(`Path escapes .agents root: ${relativePath}`);
    }
    throw error;
  }
}
