export type ContextStripMetricId = 'components' | 'selection' | 'current-task';

export interface ContextStripMetric {
  id: ContextStripMetricId;
  label: string;
  count: number;
}

export type ContextStripMetrics = readonly [
  ContextStripMetric,
  ContextStripMetric,
  ContextStripMetric,
];

export interface ContextStripMetricsInput {
  componentsCount: number;
  hasSelection: boolean;
  currentTaskMessageCount: number;
}

export function buildContextStripMetrics(input: ContextStripMetricsInput): ContextStripMetrics {
  return [
    {
      id: 'components',
      label: 'Components',
      count: normalizeCount(input.componentsCount),
    },
    {
      id: 'selection',
      label: 'Selection',
      count: input.hasSelection ? 1 : 0,
    },
    {
      id: 'current-task',
      label: 'Current task',
      count: normalizeCount(input.currentTaskMessageCount),
    },
  ];
}

function normalizeCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}
