/**
 * Editor-wide event to open the Git surface (task 0110) without prop-drilling.
 * One panel, one event: the StatusBar and other call sites dispatch it; the
 * TopBar owns the Source Control panel + Git Graph dialog and reacts.
 */
export const OPEN_SOURCE_CONTROL_EVENT = 'sber-designer.open-source-control';

export type SourceControlSection = 'changes' | 'graph';

export interface OpenSourceControlDetail {
  section?: SourceControlSection;
}

export function openSourceControl(section: SourceControlSection = 'changes'): void {
  window.dispatchEvent(
    new CustomEvent<OpenSourceControlDetail>(OPEN_SOURCE_CONTROL_EVENT, { detail: { section } }),
  );
}

/** Convenience: open the read-only Git Graph directly (footer button + panel icon). */
export function openGitGraph(): void {
  openSourceControl('graph');
}
