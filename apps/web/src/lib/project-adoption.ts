import type { SberDesignerProject } from '@sber-designer/shared-types';

/**
 * Guards against cross-project state bleed (2026-06-12): the api serves
 * a single active project and broadcasts `project.changed` to every
 * connected editor page. A page left open on another project must not
 * adopt the newly active project's state — the workspace-path mirror
 * would re-stamp its own path onto the foreign content and autosave the
 * mix into this page's project.sdproj.
 */
export function shouldAdoptFetchedProject(
  current: SberDesignerProject | null | undefined,
  fetched: SberDesignerProject,
): boolean {
  if (!current?.workspacePath) return true;
  return current.workspacePath === fetched.workspacePath;
}

/**
 * The sandbox session's workspace path may be mirrored into the project
 * only while the project has no workspace yet (fresh project / Connect
 * repo flow). A non-empty mismatch means this page holds a project that
 * belongs to another workspace; rewriting the path would redirect
 * autosave into that other project's file.
 */
export function shouldMirrorSessionWorkspacePath(
  project: SberDesignerProject | null | undefined,
  sessionWorkspacePath: string | null | undefined,
): boolean {
  if (!project || !sessionWorkspacePath) return false;
  return !project.workspacePath;
}
