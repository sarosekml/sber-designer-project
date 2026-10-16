import type { ReactNode } from 'react';

import { Card } from './cards';
import { MetaItem, type MetaListItem } from './meta-list';
import {
  AiBadge,
  Avatar,
  Badge,
  Button,
  Checkbox,
  type BadgeTone,
  type TagTone,
  Tag,
} from './primitives';
import {
  ChangeReviewList,
  CommentThread,
  DealList,
  MetricBar,
  NewsList,
  RelatedEntityList,
  SearchResults,
  TaskList,
  Timeline,
} from './patterns';
import type { ChartTone } from './charts';

export interface MetricSpec {
  label: string;
  value: string;
  progress: number;
  tone?: ChartTone;
}

export interface StatusListItem {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  value?: ReactNode;
}

export function ThesisCard({
  eyebrow,
  badge,
  title,
  description,
  tags = [],
  actions,
  children,
}: {
  eyebrow?: ReactNode;
  badge?: ReactNode;
  title: ReactNode;
  description: ReactNode;
  tags?: readonly { label: string; tone: TagTone }[];
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="business-thesis-card">
      <div className="business-card-head">
        <div className="business-card-eyebrow">{eyebrow ?? <AiBadge />}</div>
        {badge}
      </div>
      <h2 className="business-thesis-title">{title}</h2>
      <p className="business-thesis-copy">{description}</p>
      {tags.length > 0 ? (
        <div className="demo-story-row business-card-tags">
          {tags.map((tag) => (
            <Tag key={tag.label} tone={tag.tone}>
              {tag.label}
            </Tag>
          ))}
        </div>
      ) : null}
      {children ? <div className="business-card-content">{children}</div> : null}
      {actions ? <div className="demo-story-row business-card-actions">{actions}</div> : null}
    </Card>
  );
}

export function MetricsCard({
  title,
  meta,
  items,
}: {
  title: ReactNode;
  meta?: ReactNode;
  items: readonly MetricSpec[];
}) {
  return (
    <Card action={meta} title={title}>
      {items.map((item) => (
        item.tone ? (
          <MetricBar
            key={item.label}
            label={item.label}
            progress={item.progress}
            tone={item.tone}
            value={item.value}
          />
        ) : (
          <MetricBar
            key={item.label}
            label={item.label}
            progress={item.progress}
            value={item.value}
          />
        )
      ))}
    </Card>
  );
}

export function DetailsCard({
  title,
  items,
}: {
  title: ReactNode;
  items: readonly MetaListItem[];
}) {
  return (
    <Card title={title}>
      <div className="business-detail-list">
        {items.map((item, index) => (
          <MetaItem
            icon={item.icon}
            key={String(item.label) + '-' + index}
            label={item.label}
            mono={item.mono ?? false}
            value={item.value}
          />
        ))}
      </div>
    </Card>
  );
}

export function StatusList({
  items,
}: {
  items: readonly StatusListItem[];
}) {
  return (
    <div className="status-list">
      {items.map((item) => (
        <div className="status-list-row" key={item.id}>
          <div className="status-list-icon">{item.icon}</div>
          <div className="status-list-body">
            <div className="who">{item.title}</div>
            {item.description ? <div className="what">{item.description}</div> : null}
            {item.meta ? <div className="t-micro">{item.meta}</div> : null}
          </div>
          {item.value ? <div className="status-list-value">{item.value}</div> : null}
          {item.badge ? <div className="status-list-badge">{item.badge}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function StatusListCard({
  title,
  action,
  items,
}: {
  title: ReactNode;
  action?: ReactNode;
  items: readonly StatusListItem[];
}) {
  return (
    <Card action={action} title={title}>
      <StatusList items={items} />
    </Card>
  );
}

export function SummaryCard({
  title,
  badge,
  text,
  actions,
}: {
  title: ReactNode;
  badge?: ReactNode;
  text: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Card action={badge} title={title}>
      <p className="business-summary-copy">{text}</p>
      {actions ? <div className="demo-story-row business-card-actions">{actions}</div> : null}
    </Card>
  );
}

export function TimelineCard({
  title,
  items,
}: {
  title: ReactNode;
  items: readonly { title: string; text: string; when: string; tone?: ChartTone }[];
}) {
  return (
    <Card title={title}>
      <Timeline items={items} />
    </Card>
  );
}

export function RelatedEntitiesCard({
  title = 'Related entities',
  action,
  items,
}: {
  title?: ReactNode;
  action?: ReactNode;
  items: readonly { title: string; meta: string; tag: string; tone: TagTone }[];
}) {
  return (
    <Card action={action} title={title}>
      <RelatedEntityList items={items} />
    </Card>
  );
}

export function NewsPanel({
  title = 'Market news',
  meta,
  items,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  items: Parameters<typeof NewsList>[0]['items'];
}) {
  return (
    <Card action={meta} title={title}>
      <NewsList items={items} />
    </Card>
  );
}

export function TaskPanel({
  title = 'Tasks',
  meta,
  items,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  items: Parameters<typeof TaskList>[0]['items'];
}) {
  return (
    <Card action={meta} title={title}>
      <TaskList items={items} />
    </Card>
  );
}

export function DealPanel({
  title = 'Required deals',
  meta,
  items,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  items: Parameters<typeof DealList>[0]['items'];
}) {
  return (
    <Card action={meta} title={title}>
      <DealList items={items} />
    </Card>
  );
}

export function ChangePanel({
  title = 'Pending changes',
  items,
}: {
  title?: ReactNode;
  items: Parameters<typeof ChangeReviewList>[0]['items'];
}) {
  return (
    <Card title={title}>
      <ChangeReviewList items={items} />
    </Card>
  );
}

export function CommentsCard({ title = 'Discussion', meta }: { title?: ReactNode; meta?: ReactNode }) {
  return (
    <Card action={meta} title={title}>
      <CommentThread />
    </Card>
  );
}

export function ChecklistPanel({
  title,
  items,
}: {
  title: ReactNode;
  items: readonly { label: ReactNode; checked?: boolean }[];
}) {
  return (
    <Card title={title}>
      <div className="checklist">
        {items.map((item) => (
          <Checkbox defaultChecked={item.checked} key={String(item.label)} label={item.label} />
        ))}
      </div>
    </Card>
  );
}

export function ParticipantsCard({
  title,
  badge,
  sections,
}: {
  title: ReactNode;
  badge?: ReactNode;
  sections: readonly { label: ReactNode; items: readonly ReactNode[] }[];
}) {
  return (
    <Card action={badge} title={title}>
      <div className="business-detail-list">
        {sections.map((section) => (
          <div key={String(section.label)}>
            <div className="t-micro">{section.label}</div>
            <div className="demo-story-row business-inline-list">
              {section.items.map((item, index) => (
                <span key={String(section.label) + '-' + index}>{item}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function FeedEventList({
  items,
}: {
  items: readonly {
    type: string;
    title: string;
    text: string;
    when: string;
    tone: BadgeTone;
  }[];
}) {
  return (
    <div className="demo-section-stack">
      {items.map((event) => (
        <ThesisCard
          badge={<span className="t-micro">{event.when}</span>}
          eyebrow={
            <Badge dot tone={event.tone}>
              {event.type}
            </Badge>
          }
          key={event.title}
          title={event.title}
          description={event.text}
          actions={
            <>
              <Button size="sm" variant="secondary">
                Open
              </Button>
              <Button size="sm" variant="ghost">
                Pin
              </Button>
            </>
          }
        />
      ))}
    </div>
  );
}

export function AssistantWidgetPrompt({
  badge = '3 suggestions',
  text,
  actions,
}: {
  badge?: ReactNode;
  text: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="assistant-widget-prompt">
      <div className="business-card-head">
        <AiBadge>AI</AiBadge>
        <Badge tone="violet">{badge}</Badge>
      </div>
      <p className="business-summary-copy">{text}</p>
      {actions ? <div className="demo-story-row business-card-actions">{actions}</div> : null}
    </div>
  );
}

export function SearchHero({
  query,
  filters,
  active,
  resultCount,
}: {
  query: string;
  filters: string[];
  active: string;
  resultCount: string;
}) {
  return (
    <section className="demo-search-hero">
      <div className="demo-search-big">
        <Badge tone="success">Search</Badge>
        <input aria-label="Search query" defaultValue={query} />
        <span className="kbd">Cmd K</span>
      </div>
      <div className="demo-filter-bar demo-filter-bar-attached">
        <div className="seg">
          {filters.map((filter) => (
            <button className={filter === active ? 'is-active' : undefined} key={filter} type="button">
              {filter}
            </button>
          ))}
        </div>
        <span className="t-caption">{resultCount}</span>
      </div>
    </section>
  );
}

export function SearchResultsCard({ items }: { items: Parameters<typeof SearchResults>[0]['items'] }) {
  return <SearchResults items={items} />;
}

export function WidgetCatalogCard({ items }: { items: readonly string[] }) {
  return (
    <StatusListCard
      title="Widget catalog"
      items={items.map((item) => ({
        id: item,
        title: item,
        description: 'Drag into an empty slot',
        icon: <Badge tone="neutral">Widget</Badge>,
      }))}
    />
  );
}

export function DropTargetCard() {
  return (
    <Card title="Drop target">
      <div className="base-screen-work-area">
        <span>drop widget here</span>
      </div>
    </Card>
  );
}

export function ContactListCard({
  title = 'Key contacts',
  items,
}: {
  title?: ReactNode;
  items: readonly {
    initials: string;
    name: string;
    role: string;
    tone: 'emerald' | 'violet' | 'amber' | 'blue' | 'rose' | 'neutral';
  }[];
}) {
  return (
    <StatusListCard
      title={title}
      items={items.map((person) => ({
        id: person.name,
        title: person.name,
        description: person.role,
        icon: (
          <Avatar size="sm" tone={person.tone}>
            {person.initials}
          </Avatar>
        ),
      }))}
    />
  );
}
