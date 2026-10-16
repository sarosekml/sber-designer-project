/**
 * Pure derivations for the Source Control panel (task 0110). Extracted so the
 * selection / badge / branch-preview logic is unit-testable without a DOM
 * (matches the repo's component-logic testing convention).
 */
import type { GitChange, GitChangeKind } from '@/lib/api-client';

export interface ChangeBadge {
  letter: string;
  title: string;
  /** Tailwind class for the status letter (colour + weight). */
  className: string;
}

/** Map a change kind to its VS Code-style status letter + colour. */
export function changeBadge(kind: GitChangeKind): ChangeBadge {
  switch (kind) {
    case 'modified':
      return { letter: 'M', title: 'Modified', className: 'text-warning' };
    case 'added':
      return { letter: 'A', title: 'Added', className: 'text-success' };
    case 'deleted':
      return { letter: 'D', title: 'Deleted', className: 'text-destructive' };
    case 'renamed':
      return { letter: 'R', title: 'Renamed', className: 'text-info' };
    case 'untracked':
      return { letter: 'U', title: 'Untracked', className: 'text-success/70' };
    case 'conflicted':
      return { letter: 'C', title: 'Conflicted', className: 'font-bold text-destructive' };
  }
}

/** Split a repo-relative path into filename + directory (for the two-tone row). */
export function splitChangePath(path: string): { name: string; dir: string } {
  const idx = path.lastIndexOf('/');
  return idx >= 0
    ? { name: path.slice(idx + 1), dir: path.slice(0, idx) }
    : { name: path, dir: '' };
}

export interface SelectionState {
  selectedPaths: string[];
  allSelected: boolean;
}

/** Derive the ordered selected paths and whether every change is selected. */
export function deriveSelection(changes: GitChange[], selected: Set<string>): SelectionState {
  const selectedPaths = changes.filter((c) => selected.has(c.path)).map((c) => c.path);
  return {
    selectedPaths,
    allSelected: changes.length > 0 && selectedPaths.length === changes.length,
  };
}

/** "All selected" is initialised from every change path when the panel opens. */
export function selectAllPaths(changes: GitChange[]): Set<string> {
  return new Set(changes.map((c) => c.path));
}

export interface BranchPreviewInput {
  hasOpenPr: boolean;
  prNumber?: string | null;
  workingBranch?: string | null;
  currentBranch?: string | null;
  baseBranch?: string | null;
  message: string;
}

/** One-line preview of what "Send" will do to branches/PR (task 0110 B4). */
export function previewBranchAction(input: BranchPreviewInput): string {
  if (input.hasOpenPr) {
    const num = input.prNumber ? `#${input.prNumber}` : '';
    return `Will update PR ${num} on ${input.workingBranch ?? 'the working branch'}`.replace(
      / +/g,
      ' ',
    );
  }
  const current = input.currentBranch ?? null;
  const base = input.baseBranch ?? null;
  if (current && base && current !== base) {
    return `Will push ${current} and open a PR into ${base}`;
  }
  return `Will create sd/${slugForBranch(input.message)} from ${base ?? 'the base branch'}`;
}

/** Slugify a title/message into a branch tail; mirrors the backend rule. */
export function slugForBranch(seed: string): string {
  const slug = seed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/g, '');
  return slug || '<slug>';
}

/** Suggested branch name for the "New branch" target control. */
export function branchNameForMessage(seed: string): string {
  const slug = slugForBranch(seed);
  return `sd/${slug === '<slug>' ? 'update' : slug}`;
}

/** Branches that should not be pushed directly from Source Control. */
export function isProtectedBranch(branch: string | null | undefined): boolean {
  return (
    branch === 'main' ||
    branch === 'master' ||
    branch === 'develop' ||
    Boolean(branch?.startsWith('release/'))
  );
}

/** Default PR body from the selected paths (bulleted list). */
export function defaultPrBody(paths: string[]): string {
  return paths.map((p) => `- \`${p}\``).join('\n');
}
