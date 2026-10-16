import type { CSSProperties } from 'react';

export type ChartTone = 'accent' | 'info' | 'warning' | 'danger' | 'violet' | 'neutral';

const width = 240;
const height = 120;
const padding = 12;

function chartColor(tone: ChartTone) {
  if (tone === 'info') return 'var(--c-info)';
  if (tone === 'warning') return 'var(--c-warning)';
  if (tone === 'danger') return 'var(--c-danger)';
  if (tone === 'violet') return 'var(--c-violet)';
  if (tone === 'neutral') return 'var(--c-text-3)';
  return 'var(--c-accent)';
}

function pointsFor(values: readonly number[]) {
  const series = values.length > 0 ? [...values] : [0];
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const step = series.length > 1 ? (width - padding * 2) / (series.length - 1) : 0;

  return series.map((value, index) => {
    const x = padding + step * index;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return { x, y };
  });
}

function linePath(points: readonly { x: number; y: number }[]) {
  const first = points[0];
  if (!first) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
}

function areaPath(points: readonly { x: number; y: number }[]) {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return '';
  return `${linePath(points)} L${last.x.toFixed(1)} ${height - padding} L${first.x.toFixed(
    1,
  )} ${height - padding} Z`;
}

export function LineChart({
  values,
  comparisonValues,
  tone = 'accent',
  label,
}: {
  values: readonly number[];
  comparisonValues?: readonly number[];
  tone?: ChartTone;
  label?: string;
}) {
  const points = pointsFor(values);
  const comparisonPoints = comparisonValues ? pointsFor(comparisonValues) : null;
  const style = { '--chart-color': chartColor(tone) } as CSSProperties;

  return (
    <figure aria-label={label} className="demo-line-chart" style={style}>
      <svg role="img" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <path className="chart-grid" d="M12 30H228M12 60H228M12 90H228" />
        {comparisonPoints ? (
          <path className="chart-comparison" d={linePath(comparisonPoints)} />
        ) : null}
        <path className="chart-area" d={areaPath(points)} />
        <path className="chart-line" d={linePath(points)} />
      </svg>
    </figure>
  );
}

export function Sparkline({
  values,
  tone = 'accent',
  label,
}: {
  values: readonly number[];
  tone?: ChartTone;
  label?: string;
}) {
  const points = pointsFor(values);
  const style = { '--chart-color': chartColor(tone) } as CSSProperties;

  return (
    <svg
      aria-label={label}
      className="demo-sparkline"
      preserveAspectRatio="none"
      role="img"
      style={style}
      viewBox={`0 0 ${width} ${height}`}
    >
      <path className="chart-line" d={linePath(points)} />
    </svg>
  );
}

export function BarChart({
  items,
  tone = 'accent',
}: {
  items: readonly { label: string; value: number; detail?: string; tone?: ChartTone }[];
  tone?: ChartTone;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));

  return (
    <div className="demo-bar-chart">
      {items.map((item) => {
        const itemTone = item.tone ?? tone;
        const style = {
          '--bar-width': `${Math.round((item.value / max) * 100)}%`,
          '--chart-color': chartColor(itemTone),
        } as CSSProperties;

        return (
          <div className="bar-row" key={item.label} style={style}>
            <div className="bar-row-head">
              <span>{item.label}</span>
              <strong className="tnum">{item.detail ?? `${item.value}%`}</strong>
            </div>
            <div className="bar-track">
              <span />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DonutChart({
  segments,
  center,
}: {
  segments: readonly { label: string; value: number; tone: ChartTone }[];
  center: string;
}) {
  const total = Math.max(
    1,
    segments.reduce((sum, segment) => sum + segment.value, 0),
  );
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="demo-donut-wrap">
      <svg className="demo-donut" viewBox="0 0 96 96" role="img" aria-label={center}>
        <circle className="donut-base" cx="48" cy="48" r={radius} />
        {segments.map((segment) => {
          const length = (segment.value / total) * circumference;
          const dashOffset = -offset;
          offset += length;
          return (
            <circle
              className="donut-segment"
              cx="48"
              cy="48"
              key={segment.label}
              r={radius}
              stroke={chartColor(segment.tone)}
              strokeDasharray={`${length} ${circumference}`}
              strokeDashoffset={dashOffset}
            />
          );
        })}
      </svg>
      <div className="donut-center">
        <strong>{center}</strong>
        <span>allocated</span>
      </div>
      <div className="donut-legend">
        {segments.map((segment) => (
          <span key={segment.label}>
            <i style={{ background: chartColor(segment.tone) }} />
            {segment.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Heatmap({
  rows,
  columns,
  values,
}: {
  rows: readonly string[];
  columns: readonly string[];
  values: readonly number[];
}) {
  return (
    <div
      className="demo-heatmap"
      style={{ gridTemplateColumns: `76px repeat(${columns.length}, minmax(28px, 1fr))` }}
    >
      <span />
      {columns.map((column) => (
        <span className="hm-label" key={column}>
          {column}
        </span>
      ))}
      {rows.map((row, rowIndex) => (
        <HeatmapRow columns={columns} key={row} row={row} rowIndex={rowIndex} values={values} />
      ))}
    </div>
  );
}

function HeatmapRow({
  row,
  rowIndex,
  columns,
  values,
}: {
  row: string;
  rowIndex: number;
  columns: readonly string[];
  values: readonly number[];
}) {
  return (
    <>
      <span className="hm-row-label">{row}</span>
      {columns.map((column, columnIndex) => {
        const value = values[rowIndex * columns.length + columnIndex] ?? 1;
        return <span className={`hm-cell hm-${Math.max(1, Math.min(5, value))}`} key={column} />;
      })}
    </>
  );
}
