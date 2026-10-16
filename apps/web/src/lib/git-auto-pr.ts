import type { GitChange } from './api/git';

export function autoPrPathsAfterRun(before: GitChange[], after: GitChange[]): string[] {
  const preExisting = new Set(before.map((change) => change.path));
  return after.filter((change) => !preExisting.has(change.path)).map((change) => change.path);
}
