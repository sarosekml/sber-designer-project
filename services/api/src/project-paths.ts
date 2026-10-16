/**
 * Where a workspace's `.sdproj` lives (0136 R12 — extracted from
 * project-store.ts so the store and transcript recovery share one answer).
 *
 * Resolution order:
 *   1. SBER_DESIGNER_PROJECT_PATH env-var.
 *   2. <workspacePath>/.sber-designer/project.sdproj — the argument, the
 *      request's workspace context, or the connected sandbox session.
 *   3. <repoRoot>/.sber-designer/project.sdproj for local dev with no
 *      connected workspace.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalizeInside } from '@sber-designer/ast-bridge';

import { getState } from './state-store';
import { requestWorkspacePath } from './workspace-context';

const here = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT_GUESS = resolve(here, '..', '..', '..');

export function projectPath(workspacePath?: string): string {
  if (process.env.SBER_DESIGNER_PROJECT_PATH) {
    return resolve(process.env.SBER_DESIGNER_PROJECT_PATH);
  }
  const contextual = requestWorkspacePath();
  const ws = workspacePath || contextual || getState().workspacePath;
  if (ws) return canonicalizeInside(ws, '.sber-designer/project.sdproj').canonicalPath;
  return resolve(REPO_ROOT_GUESS, '.sber-designer', 'project.sdproj');
}
