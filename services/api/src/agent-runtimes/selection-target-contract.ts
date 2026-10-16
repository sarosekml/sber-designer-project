import { readWorkspaceFile } from '../safe-fs';
import type { EditorState } from '../state-store';
import type { RuntimeTargetChangeSummary, RuntimeTargetSnapshot } from './change-validation';

export interface SelectionTargetContractValidation {
  status: 'passed' | 'failed' | 'skipped';
  reasonCode:
    | 'no_selection'
    | 'broad_generation_task'
    | 'request_not_selection_scoped'
    | 'no_changed_targets'
    | 'selected_source_changed'
    | 'selected_anchor_changed'
    | 'edit_target_missed';
  reason: string;
  selectedFilePath?: string;
  selectedLine?: number;
  changedFiles: string[];
  anchorLines: number[];
}

export async function validateSelectionTargetContract(input: {
  workspacePath: string;
  selection: EditorState['selection'] | null | undefined;
  userRequest?: string | null;
  summary: RuntimeTargetChangeSummary;
  snapshots: RuntimeTargetSnapshot[];
  taskKind?: string | null;
}): Promise<SelectionTargetContractValidation> {
  const selection = input.selection;
  if (!selection) {
    return skipped('no_selection', 'No selected element was provided.', input.summary.changedFiles);
  }
  if (isBroadGenerationTask(input.taskKind)) {
    return skipped(
      'broad_generation_task',
      'Selection target contract is skipped for broad generation tasks.',
      input.summary.changedFiles,
    );
  }
  if (!isSelectionScopedEditRequest(input.userRequest)) {
    return skipped(
      'request_not_selection_scoped',
      'The user request did not appear to target the selected element.',
      input.summary.changedFiles,
    );
  }
  if (input.summary.changedTargets.length === 0) {
    return skipped('no_changed_targets', 'No target files changed.', input.summary.changedFiles);
  }

  const selectedLoc = selectionLocation(selection);
  const selectedFilePath = selectedLoc?.path;
  const selectedLine = selectedLoc?.line;
  const anchors = selectionAnchors(selection);
  const targetSnapshots = new Map(input.snapshots.map((snapshot) => [snapshot.path, snapshot]));
  const candidateChanges = selectedFilePath
    ? input.summary.changedTargets.filter(
        (target) => normalizePath(target.path) === selectedFilePath,
      )
    : input.summary.changedTargets;

  for (const target of candidateChanges) {
    const snapshot = targetSnapshots.get(target.path);
    const before = snapshot?.before ?? '';
    const after = await readWorkspaceFile(input.workspacePath, target.path).catch(() => '');
    const changedLines = changedLineNumbers(before, after);
    if (selectedLine && hasNearbyChangedLine(changedLines, selectedLine)) {
      return passed(
        'selected_source_changed',
        'Changed lines intersect the selected source location.',
        input.summary.changedFiles,
        selectedFilePath,
        selectedLine,
        [selectedLine],
      );
    }

    const anchorLines = selectedAnchorLines(before, after, anchors);
    if (anchorLines.some((line) => hasNearbyChangedLine(changedLines, line))) {
      return passed(
        'selected_anchor_changed',
        'Changed lines intersect the selected element anchor.',
        input.summary.changedFiles,
        selectedFilePath ?? target.path,
        selectedLine,
        anchorLines,
      );
    }
  }

  return {
    status: 'failed',
    reasonCode: 'edit_target_missed',
    reason:
      'The run changed target files, but the diff did not touch the selected element source location or nearby source anchors.',
    ...(selectedFilePath ? { selectedFilePath } : {}),
    ...(selectedLine ? { selectedLine } : {}),
    changedFiles: input.summary.changedFiles,
    anchorLines: [],
  };
}

function skipped(
  reasonCode: SelectionTargetContractValidation['reasonCode'],
  reason: string,
  changedFiles: string[],
): SelectionTargetContractValidation {
  return { status: 'skipped', reasonCode, reason, changedFiles, anchorLines: [] };
}

function passed(
  reasonCode: SelectionTargetContractValidation['reasonCode'],
  reason: string,
  changedFiles: string[],
  selectedFilePath: string | undefined,
  selectedLine: number | undefined,
  anchorLines: number[],
): SelectionTargetContractValidation {
  return {
    status: 'passed',
    reasonCode,
    reason,
    ...(selectedFilePath ? { selectedFilePath } : {}),
    ...(selectedLine ? { selectedLine } : {}),
    changedFiles,
    anchorLines,
  };
}

function isBroadGenerationTask(taskKind: string | null | undefined): boolean {
  return (
    taskKind === 'screen-generation' ||
    taskKind === 'screen-redesign' ||
    taskKind === 'image-to-screen'
  );
}

function isSelectionScopedEditRequest(userRequest: string | null | undefined): boolean {
  const text = userRequest?.trim().toLowerCase() ?? '';
  if (!text) return false;
  return /(\bthis\b|\bthat\b|\bselected\b|\bselection\b|\bbutton\b|\bicon\b|\bcolor\b|\btext\b|выдел|выбран|эту|этот|это|этой|там|здесь|кнопк|иконк|цвет|текст|размер|красн|син|зелен|зелён|тоже)/iu.test(
    text,
  );
}

function selectionLocation(selection: NonNullable<EditorState['selection']>) {
  return parseSourceLocation(selection.componentLoc) ?? parseSourceLocation(selection.loc);
}

function parseSourceLocation(
  value: string | null | undefined,
): { path: string; line: number } | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const match = /^(.+\.(?:tsx|ts|jsx|js|html|css|scss|mdx?)):(\d+)(?::\d+)?$/u.exec(trimmed);
  if (!match) return null;
  const rawPath = match[1];
  const rawLine = match[2];
  if (!rawPath || !rawLine) return null;
  const line = Number(rawLine);
  if (!Number.isFinite(line) || line <= 0) return null;
  return { path: normalizePath(rawPath), line };
}

function normalizePath(path: string): string {
  return path.replace(/\\/gu, '/').replace(/^\.\//u, '');
}

function selectionAnchors(selection: NonNullable<EditorState['selection']>): string[] {
  const anchors = new Set<string>();
  addAnchor(anchors, selection.text);
  addAnchor(anchors, selection.selector);
  for (const value of Object.values(selection.attributes ?? {})) {
    addAnchor(anchors, value);
  }
  return Array.from(anchors);
}

function addAnchor(anchors: Set<string>, value: string | undefined): void {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length < 3) return;
  anchors.add(trimmed);
}

function selectedAnchorLines(before: string, after: string, anchors: string[]): number[] {
  const lines = new Set<number>();
  for (const anchor of anchors) {
    for (const line of findLineNumbers(before, anchor)) lines.add(line);
    if (lines.size === 0) {
      for (const line of findLineNumbers(after, anchor)) lines.add(line);
    }
  }
  return Array.from(lines).sort((a, b) => a - b);
}

function findLineNumbers(source: string, needle: string): number[] {
  const lines = source.split('\n');
  const result: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index]?.includes(needle)) result.push(index + 1);
  }
  return result;
}

function changedLineNumbers(before: string, after: string): number[] {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const max = Math.max(beforeLines.length, afterLines.length);
  const changed: number[] = [];
  for (let index = 0; index < max; index += 1) {
    if ((beforeLines[index] ?? '') !== (afterLines[index] ?? '')) changed.push(index + 1);
  }
  return changed;
}

function hasNearbyChangedLine(changedLines: number[], line: number): boolean {
  return changedLines.some((changedLine) => Math.abs(changedLine - line) <= 6);
}
