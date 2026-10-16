import type { DatedValue } from '@sber-designer/shared-types';

const absolutePathPattern = /^(?:\/|[A-Za-z]:[\\/])/;

export function formatTokenCount(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat(undefined, {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatCost(value: number | undefined): string {
  if (value === undefined) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: value < 0.01 ? 4 : 2,
    maximumFractionDigits: value < 0.01 ? 4 : 2,
  }).format(value);
}

export function formatBytes(value: number): string {
  if (value < 1_024) return `${value} B`;
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}

export function formatDate(value: number | string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatRelativeDate(value: number): string {
  const deltaSeconds = Math.round((value - Date.now()) / 1_000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, seconds] of units) {
    if (Math.abs(deltaSeconds) >= seconds) {
      return formatter.format(Math.round(deltaSeconds / seconds), unit);
    }
  }
  return formatter.format(deltaSeconds, 'second');
}

export function datedValueLabel(value: DatedValue | null): string {
  return value ? formatDate(value.value) : '—';
}

export function resolveWorkspacePath(workspacePath: string | null, path: string): string {
  if (!workspacePath || absolutePathPattern.test(path)) return path;
  return `${workspacePath.replace(/[\\/]+$/, '')}/${path.replace(/^[\\/]+/, '')}`;
}
