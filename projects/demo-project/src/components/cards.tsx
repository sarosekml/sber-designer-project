import type { ReactNode } from 'react';

import { AiBadge, Badge, Button, Status, Tag } from './primitives';

export function Card({
  title,
  action,
  className = '',
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={['card', className].filter(Boolean).join(' ')}>
      {title ? (
        <div className="card-title">
          <span>{title}</span>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  chart,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  chart?: ReactNode;
}) {
  return (
    <Card>
      <div className="t-caption muted">{label}</div>
      <div className="kpi" style={{ marginTop: 4 }}>
        <span className="kpi-num tnum">{value}</span>
        {unit ? <span className="kpi-unit">{unit}</span> : null}
      </div>
      {delta ? (
        <div className="t-micro" style={{ marginTop: 8, color: 'var(--c-accent-2)' }}>
          {delta}
        </div>
      ) : null}
      {chart ? <div className="kpi-chart">{chart}</div> : null}
    </Card>
  );
}

export function InvestmentReportCard() {
  return (
    <Card title="Investment report">
      <div style={{ marginTop: 14 }}>
        <div className="t-caption muted">Allocated capital</div>
        <div className="kpi" style={{ marginTop: 4 }}>
          <span className="kpi-num tnum">1.45</span>
          <span className="kpi-unit">bn RUB</span>
        </div>
      </div>
      <div className="progress" style={{ marginTop: 14 }}>
        <span style={{ width: '66%' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
        <div>
          <div className="t-micro">Used</div>
          <div className="tnum" style={{ fontWeight: 600, fontSize: 13, marginTop: 2 }}>
            950 <span className="muted">m RUB</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="t-micro">Remaining</div>
          <div className="tnum" style={{ fontWeight: 600, fontSize: 13, marginTop: 2 }}>
            500 <span className="muted">m RUB</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function IdeaCard() {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="t-eyebrow">Deal idea</span>
        <AiBadge />
      </div>
      <div style={{ marginTop: 10, fontWeight: 600, fontSize: 14, lineHeight: 1.45 }}>
        Buy-side acquisition of Port Murmansk amid northern route growth
      </div>
      <div className="t-caption" style={{ marginTop: 8 }}>
        Trigger: tax benefit expansion and new logistics capacity in the Arctic corridor.
      </div>
      <div className="t-micro" style={{ marginTop: 10 }}>
        Yesterday
      </div>
    </Card>
  );
}

export function ChangesCard() {
  return (
    <Card title="Changes to approve">
      <div style={{ marginTop: 14 }}>
        <div className="t-micro">BENEFICIARY</div>
        <div style={{ fontSize: 13, marginTop: 3 }}>
          Old value / <span style={{ color: 'var(--c-accent-2)', fontWeight: 500 }}>New value</span>
        </div>
        <div className="t-micro" style={{ marginTop: 2 }}>
          5 hours ago
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="t-micro">TEAM</div>
        <div style={{ fontSize: 13, marginTop: 3 }}>New partner added</div>
        <div className="t-micro" style={{ marginTop: 2 }}>
          2 hours ago
        </div>
      </div>
      <div className="row-sm" style={{ marginTop: 14 }}>
        <Button size="sm">Approve</Button>
        <Button variant="ghost" size="sm">
          Open changes
        </Button>
      </div>
    </Card>
  );
}

export const assets = [
  {
    name: 'Norilsk Nickel',
    industry: 'Metals and ore',
    tag: 'metal' as const,
    status: 'active' as const,
    value: '42.1 bn',
  },
  {
    name: 'Port Murmansk',
    industry: 'Capital markets',
    tag: 'capital' as const,
    status: 'active' as const,
    value: '18.4 bn',
  },
  {
    name: 'Rosbank',
    industry: 'Banks',
    tag: 'bank' as const,
    status: 'paused' as const,
    value: '31.8 bn',
  },
  {
    name: 'MedTech Labs',
    industry: 'Pharma',
    tag: 'pharma' as const,
    status: 'active' as const,
    value: '9.7 bn',
  },
];

export function AssetsTable() {
  return (
    <Card title="Assets">
      <table className="demo-table">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Industry</th>
            <th>Status</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.name}>
              <td>{asset.name}</td>
              <td>
                <Tag tone={asset.tag}>{asset.industry}</Tag>
              </td>
              <td>
                <Status tone={asset.status}>
                  {asset.status === 'active' ? 'Active' : 'Paused'}
                </Status>
              </td>
              <td className="tnum">{asset.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function InteractionHistory() {
  return (
    <Card title="Interaction history">
      <div className="demo-list" style={{ marginTop: 10 }}>
        {['Quarterly report discussion', 'Fund onboarding documents', 'Monthly digest'].map(
          (item, index) => (
            <div className="interaction" key={item}>
              <div className="icon">0{index + 1}</div>
              <div style={{ flex: 1 }}>
                <div className="who">{index === 0 ? 'Sergey Petrov' : item}</div>
                <div className="what">{item}</div>
                <div className="when">{index === 0 ? 'yesterday, 16:42' : 'March 2026'}</div>
              </div>
              <Badge
                tone={index === 2 ? 'neutral' : index === 1 ? 'info' : 'success'}
                dot={index !== 2}
              >
                {index === 2 ? 'System' : index === 1 ? 'Sent' : 'Done'}
              </Badge>
            </div>
          ),
        )}
      </div>
    </Card>
  );
}
