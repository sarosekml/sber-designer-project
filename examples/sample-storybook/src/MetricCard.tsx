import './MetricCard.css';

export interface MetricCardProps {
  label: string;
  value: string;
  delta?: { kind: 'up' | 'down'; text: string };
}

export function MetricCard({ label, value, delta }: MetricCardProps) {
  return (
    <article className="card">
      <div className="card__label">{label}</div>
      <div className="card__value">{value}</div>
      {delta && <div className={`card__delta card__delta--${delta.kind}`}>{delta.text}</div>}
    </article>
  );
}
