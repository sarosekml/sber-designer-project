import type {
  RuntimeSourceDiffRisk,
  RuntimeTargetChange,
  RuntimeTargetChangeKind,
} from './change-validation';

export function classifySourceDiff(
  before: string | null,
  after: string | null,
): {
  risk: RuntimeSourceDiffRisk;
  reasons: string[];
  changedLineCount: number;
  changedCharacterCount: number;
} {
  if (before === after) {
    return {
      risk: 'none',
      reasons: ['no source text changed'],
      changedLineCount: 0,
      changedCharacterCount: 0,
    };
  }
  if (before === null || after === null) {
    return {
      risk: 'substantial',
      reasons: [before === null ? 'target file was created' : 'target file was deleted'],
      changedLineCount: Math.max(lineCount(before), lineCount(after)),
      changedCharacterCount: Math.max(byteLength(before), byteLength(after)),
    };
  }
  const beforeLines = splitComparableLines(before);
  const afterLines = splitComparableLines(after);
  const maxLines = Math.max(beforeLines.length, afterLines.length);
  let changedLineCount = Math.abs(beforeLines.length - afterLines.length);
  let changedCharacterCount = Math.abs(before.length - after.length);
  const sharedLines = Math.min(beforeLines.length, afterLines.length);
  for (let index = 0; index < sharedLines; index += 1) {
    if (beforeLines[index] === afterLines[index]) continue;
    changedLineCount += 1;
    changedCharacterCount += characterDistance(beforeLines[index] ?? '', afterLines[index] ?? '');
  }
  if (changedLineCount <= 1 && changedCharacterCount <= 8 && maxLines <= 80) {
    return {
      risk: 'low_signal',
      reasons: ['tiny source-only edit'],
      changedLineCount,
      changedCharacterCount,
    };
  }
  return {
    risk: 'substantial',
    reasons: ['multi-line or substantial source edit'],
    changedLineCount,
    changedCharacterCount,
  };
}

export function highestSourceRisk(changes: RuntimeTargetChange[]): RuntimeSourceDiffRisk {
  if (changes.some((change) => change.sourceRisk === 'substantial')) return 'substantial';
  if (changes.some((change) => change.sourceRisk === 'low_signal')) return 'low_signal';
  return 'none';
}

function splitComparableLines(value: string): string[] {
  return value.replace(/\r\n/g, '\n').split('\n');
}

function characterDistance(left: string, right: string): number {
  const shared = Math.min(left.length, right.length);
  let distance = Math.abs(left.length - right.length);
  for (let index = 0; index < shared; index += 1) {
    if (left[index] !== right[index]) distance += 1;
  }
  return distance;
}

export function changeKind(before: string | null, after: string | null): RuntimeTargetChangeKind {
  if (before === null) return 'created';
  if (after === null) return 'deleted';
  return 'modified';
}

export function byteLength(value: string | null): number {
  return value === null ? 0 : Buffer.byteLength(value, 'utf8');
}

export function lineCount(value: string | null): number {
  if (!value) return 0;
  return value.endsWith('\n') ? value.split('\n').length - 1 : value.split('\n').length;
}

export function formatPathList(paths: string[]): string {
  if (paths.length === 0) return 'none';
  const visible = paths.slice(0, 8);
  const suffix = paths.length > visible.length ? `, and ${paths.length - visible.length} more` : '';
  return `${visible.join(', ')}${suffix}`;
}
