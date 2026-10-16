/**
 * The single filesystem boundary for workspace-relative paths (0136 R02).
 *
 * A lexical `resolve` + prefix check is not a boundary: it describes where a
 * path *spells* itself, not where it *lands*. A symlink inside the workspace
 * that points at a sibling directory passes the prefix check and then reads
 * and writes outside the workspace. The review reproduced exactly that —
 * `readWorkspaceFile(workspace, 'link/marker.txt')` and a write through the
 * same path both succeeded against a neighbouring temp directory.
 *
 * So every path goes through two gates:
 *
 *   1. lexical — reject absolute paths, NUL bytes and `..` escapes before
 *      touching the disk at all (cheap, and it keeps the error messages
 *      about the caller's input rather than about the filesystem);
 *   2. canonical — resolve symlinks and require the *real* destination to
 *      stay under the *real* workspace root. For a path that does not exist
 *      yet (a file we are about to create) the nearest existing ancestor is
 *      canonicalized instead, so a new file cannot be planted through a
 *      linked parent directory.
 *
 * `resolveInside` keeps returning the lexical absolute path, which is what
 * ~160 existing call sites already expect. Callers that then act on the file
 * should prefer `canonicalizeInside(...).canonicalPath`: operating on the
 * already-resolved real path means the operation does not re-traverse the
 * links we just validated, which narrows the window for swapping a link
 * between the check and the operation.
 */
import { lstatSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export class WorkspaceEscape extends Error {
  constructor(p: string) {
    super(`Refused to access path outside workspace: ${p}`);
  }
}

export interface ResolvedWorkspacePath {
  /** Lexically resolved absolute path — what the caller asked for. */
  lexicalPath: string;
  /**
   * Absolute path with every existing symlink resolved. For a path that does
   * not exist yet this is the canonical nearest-existing-ancestor plus the
   * remaining literal segments.
   */
  canonicalPath: string;
  /** Canonical workspace root the path was validated against. */
  canonicalRoot: string;
}

/**
 * Resolve a workspace-relative path to absolute, throwing if it would land
 * outside `workspaceRoot` either lexically or after following symlinks.
 * Absolute paths in `relPath` are rejected — the api only accepts
 * workspace-relative paths.
 */
export function resolveInside(workspaceRoot: string, relPath: string): string {
  return canonicalizeInside(workspaceRoot, relPath).lexicalPath;
}

/**
 * Full form of {@link resolveInside}: same validation, but also hands back the
 * canonical destination so the caller can act on the real path.
 */
export function canonicalizeInside(workspaceRoot: string, relPath: string): ResolvedWorkspacePath {
  if (typeof relPath !== 'string' || relPath.includes('\0')) {
    throw new WorkspaceEscape(String(relPath));
  }
  if (isAbsolute(relPath)) throw new WorkspaceEscape(relPath);

  const root = resolve(workspaceRoot);
  const lexicalPath = resolve(root, relPath);
  if (!isInside(root, lexicalPath)) throw new WorkspaceEscape(relPath);

  const canonicalRoot = realpathOrSelf(root);
  const canonicalPath = canonicalizeExistingPrefix(lexicalPath);
  if (!isInside(canonicalRoot, canonicalPath)) throw new WorkspaceEscape(relPath);

  return { lexicalPath, canonicalPath, canonicalRoot };
}

/** True when `candidate` is the root itself or lives under it. */
function isInside(root: string, candidate: string): boolean {
  if (candidate === root) return true;
  if (candidate.startsWith(root + sep)) return true;
  // Case-insensitive volumes (macOS/Windows) spell the same path differently.
  const rel = relative(root, candidate);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * Resolve symlinks as far as the path exists. Segments below the deepest
 * existing ancestor are kept literally: they cannot be links, because they
 * are not there yet.
 */
function canonicalizeExistingPrefix(absPath: string): string {
  const pending: string[] = [];
  let current = absPath;
  for (;;) {
    try {
      const real = realpathSync(current);
      return pending.length === 0 ? real : resolve(real, ...pending.reverse());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      // realpath also reports ENOENT for a dangling link. Treating it as a
      // missing literal segment would let writeFile follow it outside root.
      try {
        if (lstatSync(current).isSymbolicLink()) throw new WorkspaceEscape(absPath);
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code !== 'ENOENT') throw statError;
      }
      const parent = dirname(current);
      if (parent === current) return absPath;
      pending.push(current.slice(parent.length + 1));
      current = parent;
    }
  }
}

function realpathOrSelf(absPath: string): string {
  try {
    return realpathSync(absPath);
  } catch {
    return canonicalizeExistingPrefix(absPath);
  }
}
