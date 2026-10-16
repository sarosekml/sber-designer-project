/** Editor-wide primitives shared across packages. */

// Public type surface of @sber-designer/shared-types.

export type EditorMode = 'interact' | 'design' | 'code';

export interface ProjectRef {
  id: string;
  name: string;
  /** Git remote, e.g. https://gitlab.example.com/org/repo.git */
  gitUrl: string;
  /** Default branch for new sessions. */
  branch: string;
}
