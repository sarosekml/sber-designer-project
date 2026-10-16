/**
 * Pure parser for `git status --porcelain=v2 -z` (task 0110). Kept separate
 * from git-worker so it has zero I/O deps and is trivially unit-testable.
 */
import type { GitChange, GitChangeKind } from '@sber-designer/shared-types';

/**
 * Parse `git status --porcelain=v2 -z` output into working-tree changes.
 *
 * Record shapes (fields are single-space separated; the path is last and is
 * never quoted under `-z`, so it may itself contain spaces):
 *   `1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>`           — ordinary change
 *   `2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <Xscore> <path>`  — rename/copy;
 *      the original path follows as a **separate** NUL-terminated field.
 *   `u <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>` — unmerged
 *   `? <path>`                                               — untracked
 *   `! <path>` (ignored) and `# ...` (headers) are skipped.
 */
export function parsePorcelainV2(stdout: string): GitChange[] {
  const tokens = stdout.split('\0');
  const changes: GitChange[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue; // trailing empty slot after the final NUL
    const type = token[0];
    if (type === '#' || type === '!') continue; // headers / ignored
    if (type === '?') {
      changes.push({ path: token.slice(2), kind: 'untracked', staged: false });
      continue;
    }
    if (type === '1' || type === '2' || type === 'u') {
      const fields = token.split(' ');
      const xy = fields[1] ?? '..';
      // Path field index differs per record type (see doc comment above).
      const pathStart = type === '1' ? 8 : type === '2' ? 9 : 10;
      const path = fields.slice(pathStart).join(' ');
      const staged = xy[0] !== '.';
      if (type === '2') {
        // The pre-rename path is the next NUL-delimited token.
        const origPath = tokens[i + 1];
        i += 1;
        changes.push({
          path,
          kind: 'renamed',
          staged,
          ...(origPath ? { origPath } : {}),
        });
      } else if (type === 'u') {
        changes.push({ path, kind: 'conflicted', staged });
      } else {
        changes.push({ path, kind: xyToChangeKind(xy), staged });
      }
    }
  }
  return changes;
}

/** Map a porcelain-v2 XY status pair to a change kind (deleted > renamed > added > modified). */
function xyToChangeKind(xy: string): GitChangeKind {
  const x = xy[0];
  const y = xy[1];
  if (x === 'D' || y === 'D') return 'deleted';
  if (x === 'R' || y === 'R' || x === 'C' || y === 'C') return 'renamed';
  if (x === 'A' || y === 'A') return 'added';
  return 'modified';
}
