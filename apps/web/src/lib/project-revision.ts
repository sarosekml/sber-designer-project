import type { SberDesignerProject } from '@sber-designer/shared-types';

// Enumerable symbols survive immutable object spreads, but never enter JSON
// or .sdproj. A refetch must not advance the revision of an older draft.
const REVISION = Symbol('project-revision');
type RevisionedProject = SberDesignerProject & { [REVISION]?: string | null };

export function withProjectRevision<T extends SberDesignerProject>(
  project: T,
  etag: string | null,
): T {
  return Object.assign(project, { [REVISION]: etag });
}

export function projectRevisionHeader(project: SberDesignerProject): string {
  return (project as RevisionedProject)[REVISION] ?? '"null"';
}

export function carryProjectRevision<T extends SberDesignerProject>(
  project: T,
  source: SberDesignerProject,
): T {
  return REVISION in source
    ? withProjectRevision(project, (source as RevisionedProject)[REVISION] ?? null)
    : project;
}
