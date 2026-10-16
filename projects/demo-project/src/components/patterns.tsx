import type { ReactNode } from 'react';

import { BarChart, DonutChart, Heatmap, LineChart, Sparkline, type ChartTone } from './charts';
import { Card } from './cards';
import {
  AiBadge,
  Avatar,
  Badge,
  Button,
  Checkbox,
  PriorityBadge,
  SegmentedControl,
  Status,
  Tag,
  type BadgeTone,
  type TagTone,
} from './primitives';

export function EntityHeader({
  logo,
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
}: {
  logo: string;
  eyebrow: ReactNode;
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="demo-entity-header">
      <div className="entity-logo">{logo}</div>
      <div className="entity-body">
        <div className="entity-eyebrow">{eyebrow}</div>
        <h2 className="entity-title">{title}</h2>
        {subtitle ? <p className="entity-subtitle">{subtitle}</p> : null}
        {meta ? <div className="entity-meta-row">{meta}</div> : null}
      </div>
      {actions ? <div className="entity-actions">{actions}</div> : null}
    </section>
  );
}

export function MetricBar({
  label,
  value,
  progress,
  tone = 'accent',
}: {
  label: string;
  value: string;
  progress: number;
  tone?: ChartTone;
}) {
  return (
    <div className={`metric-bar metric-bar-${tone}`}>
      <div className="mb-label">{label}</div>
      <div className="mb-val-row">
        <span className="mb-track">
          <span style={{ width: `${progress}%` }} />
        </span>
        <strong className="mb-val tnum">{value}</strong>
      </div>
    </div>
  );
}

export function DemoWidget({
  title,
  meta,
  span = 'normal',
  editing = false,
  children,
}: {
  title: string;
  meta?: ReactNode;
  span?: 'normal' | 'wide' | 'tall' | 'large';
  editing?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={['demo-widget', `demo-widget-${span}`, editing ? 'is-editing' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="demo-widget-head">
        <span className="widget-grip" />
        <span className="widget-title">{title}</span>
        {meta ? <span className="widget-meta">{meta}</span> : null}
      </div>
      <div className="demo-widget-body">{children}</div>
    </section>
  );
}

export function TaskList({
  items,
}: {
  items: readonly {
    id: string;
    title: string;
    when: string;
    tone: 'danger' | 'warning' | 'success';
  }[];
}) {
  return (
    <div className="demo-task-list">
      {items.map((item) => (
        <div className="demo-task" key={item.id}>
          <span className={`task-dot task-dot-${item.tone}`} />
          <div>
            <div className="task-id">{item.id}</div>
            <div className="task-title">{item.title}</div>
            <div className="task-when">{item.when}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DealList({
  items,
}: {
  items: readonly {
    id: string;
    client: string;
    description: string;
    industry: string;
    amount: string;
  }[];
}) {
  return (
    <div className="demo-deal-list">
      {items.map((item) => (
        <div className="demo-deal" key={item.id}>
          <div className="deal-id">{item.id}</div>
          <div>
            <div className="deal-client">{item.client}</div>
            <div className="deal-desc">{item.description}</div>
          </div>
          <Badge tone="neutral">{item.industry}</Badge>
          <strong className="tnum">{item.amount}</strong>
        </div>
      ))}
    </div>
  );
}

export function NewsList({
  items,
}: {
  items: readonly {
    source: string;
    title: string;
    when: string;
    tags?: readonly string[];
    priority?: boolean;
  }[];
}) {
  return (
    <div className="demo-news-list">
      {items.map((item) => (
        <article
          className={['demo-news-card', item.priority ? 'is-priority' : ''].join(' ')}
          key={item.title}
        >
          <div className="news-meta">
            <span>{item.when}</span>
            <span className="news-dot" />
            <strong>{item.source}</strong>
          </div>
          <h3>{item.title}</h3>
          {item.tags ? (
            <div className="row-sm">
              {item.tags.map((tag) => (
                <Badge key={tag} tone={item.priority ? 'danger' : 'neutral'}>
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function ChangeReviewList({
  items,
}: {
  items: readonly {
    field: string;
    oldValue: string;
    newValue: string;
    source: string;
    when: string;
    tone: BadgeTone;
  }[];
}) {
  return (
    <div className="demo-change-list">
      {items.map((item) => (
        <article className="demo-change-row" key={item.field}>
          <div>
            <div className="change-field">{item.field}</div>
            <div className="change-values">
              <span>{item.oldValue}</span>
              <span className="change-arrow">to</span>
              <strong>{item.newValue}</strong>
            </div>
            <div className="t-micro">{item.when}</div>
          </div>
          <div className="change-side">
            <Badge tone={item.tone} dot>
              {item.source}
            </Badge>
            <div className="row-sm">
              <Button size="sm">Approve</Button>
              <Button size="sm" variant="ghost">
                Reject
              </Button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function CommunicationList({
  items,
}: {
  items: readonly {
    title: string;
    snippet: string;
    counterparty: string;
    when: string;
    tone: BadgeTone;
    status: string;
    people: readonly string[];
  }[];
}) {
  return (
    <div className="demo-comm-list">
      {items.map((item, index) => (
        <article
          className={['demo-comm-row', index === 0 ? 'is-selected' : ''].join(' ')}
          key={item.title}
        >
          <div className="comm-icon">{index === 1 ? 'M' : index === 3 ? 'AI' : 'C'}</div>
          <div>
            <div className="comm-title">{item.title}</div>
            <div className="comm-snippet">{item.snippet}</div>
          </div>
          <div className="comm-people">
            <AvatarStack items={item.people} />
            <span>{item.counterparty}</span>
          </div>
          <div className="comm-when">{item.when}</div>
          <Badge tone={item.tone} dot>
            {item.status}
          </Badge>
        </article>
      ))}
    </div>
  );
}

export function AvatarStack({ items }: { items: readonly string[] }) {
  return (
    <span className="avatar-stack">
      {items.map((item, index) => (
        <Avatar key={`${item}-${index}`} size="xs" tone={index === 0 ? 'violet' : 'emerald'}>
          {item}
        </Avatar>
      ))}
    </span>
  );
}

export function Timeline({
  items,
}: {
  items: readonly { title: string; text: string; when: string; tone?: ChartTone }[];
}) {
  return (
    <div className="demo-timeline">
      {items.map((item) => (
        <div className={`timeline-item timeline-${item.tone ?? 'accent'}`} key={item.title}>
          <div className="timeline-dot" />
          <div>
            <div className="timeline-title">{item.title}</div>
            <div className="timeline-text">{item.text}</div>
            <div className="timeline-when">{item.when}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SearchResults({
  items,
}: {
  items: readonly {
    type: string;
    title: string;
    description: string;
    meta: string;
    tone: BadgeTone;
  }[];
}) {
  return (
    <div className="demo-search-results">
      {items.map((item) => (
        <article className="demo-search-result" key={item.title}>
          <Badge tone={item.tone}>{item.type}</Badge>
          <div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <span className="t-micro">{item.meta}</span>
          </div>
          <Button size="sm" variant="secondary">
            Open
          </Button>
        </article>
      ))}
    </div>
  );
}

export function ScenarioPicker() {
  const scenarios = [
    {
      title: 'Investment fit',
      text: 'Score market fit, ownership risk, and target structure.',
      badge: 'Recommended',
    },
    {
      title: 'Stress test',
      text: 'Run rate, FX, margin, and capex sensitivity checks.',
      badge: 'Risk',
    },
    {
      title: 'Committee memo',
      text: 'Produce decision notes, sources, and open questions.',
      badge: 'Draft',
    },
  ];

  return (
    <div className="scenario-grid">
      {scenarios.map((scenario, index) => (
        <button
          className={index === 0 ? 'scenario is-active' : 'scenario'}
          key={scenario.title}
          type="button"
        >
          <span className="scenario-title">{scenario.title}</span>
          <span className="scenario-text">{scenario.text}</span>
          <Badge tone={index === 0 ? 'success' : 'neutral'}>{scenario.badge}</Badge>
        </button>
      ))}
    </div>
  );
}

export function ProgressSteps({
  items,
}: {
  items: readonly { title: string; text: string; done?: boolean; active?: boolean }[];
}) {
  return (
    <div className="analysis-steps">
      {items.map((item) => (
        <div
          className={['analysis-step', item.done ? 'is-done' : '', item.active ? 'is-active' : '']
            .filter(Boolean)
            .join(' ')}
          key={item.title}
        >
          <span className="step-mark">{item.done ? 'ok' : item.active ? '...' : ''}</span>
          <div>
            <div className="step-title">{item.title}</div>
            <div className="step-text">{item.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RelatedEntityList({
  items,
}: {
  items: readonly { title: string; meta: string; tag: string; tone: TagTone }[];
}) {
  return (
    <div className="related-list">
      {items.map((item) => (
        <div className="related-row" key={item.title}>
          <Tag tone={item.tone}>{item.tag}</Tag>
          <div>
            <div className="related-title">{item.title}</div>
            <div className="related-meta">{item.meta}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CommentThread() {
  return (
    <div className="comment-thread">
      {[
        ['AK', 'Please add covenant sensitivity before committee review.', 'today, 10:12'],
        ['PS', 'Legal source package is attached to the due diligence card.', 'today, 10:34'],
        [
          'AI',
          'I can draft a counterparty risk paragraph from the latest filings.',
          'today, 10:41',
        ],
      ].map(([initials, text, when]) => (
        <div className="comment-row" key={`${initials}-${when}`}>
          <Avatar size="sm" tone={initials === 'AI' ? 'violet' : 'emerald'}>
            {initials}
          </Avatar>
          <div>
            <div className="comment-text">{text}</div>
            <div className="comment-when">{when}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardChartSet() {
  return (
    <>
      <DemoWidget title="Deal funnel" span="wide">
        <BarChart
          items={[
            { label: 'Sourced', value: 88, detail: '42 deals' },
            { label: 'Screening', value: 64, detail: '31 deals', tone: 'info' },
            { label: 'Diligence', value: 38, detail: '18 deals', tone: 'warning' },
            { label: 'Committee', value: 22, detail: '9 deals', tone: 'violet' },
          ]}
        />
      </DemoWidget>
      <DemoWidget title="Portfolio allocation">
        <DonutChart
          center="64%"
          segments={[
            { label: 'Metals', value: 38, tone: 'accent' },
            { label: 'Banks', value: 26, tone: 'info' },
            { label: 'Pharma', value: 18, tone: 'violet' },
            { label: 'Logistics', value: 18, tone: 'warning' },
          ]}
        />
      </DemoWidget>
      <DemoWidget title="Risk map">
        <Heatmap
          columns={['Q1', 'Q2', 'Q3', 'Q4']}
          rows={['Banks', 'Metals', 'Ports', 'IT']}
          values={[2, 3, 3, 4, 3, 4, 4, 5, 2, 2, 3, 4, 1, 2, 2, 3]}
        />
      </DemoWidget>
    </>
  );
}

export function MiniPerformanceCard({
  title,
  value,
  values,
  tone = 'accent',
}: {
  title: string;
  value: string;
  values: readonly number[];
  tone?: ChartTone;
}) {
  return (
    <Card>
      <div className="mini-performance">
        <div>
          <div className="t-caption muted">{title}</div>
          <strong className="mini-value tnum">{value}</strong>
        </div>
        <Sparkline values={values} tone={tone} />
      </div>
    </Card>
  );
}

export function ChartPanel({
  title,
  meta,
  values,
  comparisonValues,
  tone = 'accent',
}: {
  title: string;
  meta: string;
  values: readonly number[];
  comparisonValues?: readonly number[];
  tone?: ChartTone;
}) {
  return (
    <Card
      action={
        <Badge tone={tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : 'success'}>
          {meta}
        </Badge>
      }
      title={title}
    >
      {comparisonValues ? (
        <LineChart comparisonValues={comparisonValues} label={title} values={values} tone={tone} />
      ) : (
        <LineChart label={title} values={values} tone={tone} />
      )}
    </Card>
  );
}

export function ChecklistCard({ title }: { title: string }) {
  return (
    <Card title={title}>
      <div className="checklist">
        <Checkbox defaultChecked label="Attach quarterly financial model" />
        <Checkbox defaultChecked label="Verify beneficiary source" />
        <Checkbox label="Request legal comment on minority protections" />
        <Checkbox label="Send committee memo for review" />
      </div>
    </Card>
  );
}

export function PrioritySummary() {
  return (
    <div className="priority-summary">
      <PriorityBadge tone="high">High</PriorityBadge>
      <MetricBar label="Committee readiness" progress={68} value="68%" />
      <MetricBar label="Data completeness" progress={83} tone="info" value="83%" />
      <MetricBar label="Residual risk" progress={42} tone="warning" value="Medium" />
      <Status tone="active">Review active</Status>
      <AiBadge>AI assisted</AiBadge>
      <SegmentedControl active="This week" items={['Today', 'This week', 'Month']} />
    </div>
  );
}
