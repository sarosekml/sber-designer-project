import type { Meta, StoryObj } from '@storybook/react-vite';

import { Card } from '../components/cards';
import { GlobeIcon, MetaList, TrendIcon, UserIcon } from '../components/meta-list';
import { Badge, Button, PriorityBadge, Status, Tag } from '../components/primitives';
import {
  ChangeReviewList,
  ChartPanel,
  CommunicationList,
  DealList,
  EntityHeader,
  MetricBar,
  NewsList,
  ProgressSteps,
  RelatedEntityList,
  ScenarioPicker,
  SearchResults,
  TaskList,
  Timeline,
} from '../components/patterns';
import {
  changeItems,
  communicationItems,
  dealItems,
  newsItems,
  searchResults,
  taskItems,
} from '../data/demo';
import { describeComponent, describeStory, patternDescription } from '../storybook/descriptions';

function PatternsOverview() {
  const headerMeta = [
    { icon: <GlobeIcon />, label: 'Mandate', value: 'Infrastructure growth' },
    { icon: <TrendIcon />, label: 'Target NAV', value: '188.0 bn RUB', mono: true },
    { icon: <UserIcon />, label: 'Owner', value: 'Northern Logistics' },
    { icon: <TrendIcon />, label: 'Readiness', value: 'Committee draft' },
  ];

  const timelineItems = [
    {
      title: 'Source package received',
      text: 'Quarterly reports, covenant schedule, and terminal occupancy data are attached.',
      when: 'Today',
      tone: 'accent' as const,
    },
    {
      title: 'Legal review scheduled',
      text: 'Minority investor protections and collateral terms move to counsel review.',
      when: 'Tomorrow',
      tone: 'warning' as const,
    },
    {
      title: 'Committee memo due',
      text: 'Analyst package needs final risk summary before submission.',
      when: 'May 18',
      tone: 'info' as const,
    },
  ];

  const progressItems = [
    {
      title: 'Collect source filings',
      text: 'Quarterly reports and ownership records.',
      done: true,
    },
    {
      title: 'Run market fit model',
      text: 'Route growth, debt capacity, and terminal occupancy.',
      done: true,
    },
    {
      title: 'Score risks',
      text: 'Regulatory, FX, execution, and minority protections.',
      active: true,
    },
    {
      title: 'Draft committee memo',
      text: 'Summary, open questions, and recommendation package.',
    },
  ];

  const relatedItems = [
    { title: 'Port Murmansk', meta: 'Terminal asset · 18.4 bn RUB', tag: 'Asset', tone: 'capital' as const },
    { title: 'Northern route expansion', meta: 'AI idea · 91% confidence', tag: 'Idea', tone: 'soft' as const },
    { title: 'Arctic logistics index', meta: 'Benchmark · updated weekly', tag: 'Source', tone: 'it' as const },
  ];

  return (
    <div className="demo-section-stack">
      <EntityHeader
        actions={
          <div className="demo-story-row">
            <Button variant="secondary">Export</Button>
            <Button>Review package</Button>
          </div>
        }
        eyebrow={
          <div className="demo-story-row">
            <Tag tone="capital">Infrastructure</Tag>
            <PriorityBadge tone="high">High priority</PriorityBadge>
            <Status tone="active">Review active</Status>
          </div>
        }
        logo="NL"
        meta={<MetaList columns={4} items={headerMeta} />}
        subtitle="Reusable entity header pattern for fund, asset, deal, and idea workspaces."
        title="Northern Logistics Fund"
      />

      <div className="demo-story-grid">
        <ChartPanel
          comparisonValues={[42, 46, 45, 51, 54, 59, 62]}
          meta="Target path"
          title="NAV trend"
          values={[38, 42, 47, 52, 57, 61, 68]}
        />
        <Card action={<Badge tone="success">Recommended</Badge>} title="Scenario planning">
          <ScenarioPicker />
        </Card>
        <Card title="Risk distribution">
          <div className="demo-section-stack">
            <MetricBar label="Regulatory" progress={76} tone="warning" value="Medium" />
            <MetricBar label="FX exposure" progress={44} tone="info" value="Low" />
            <MetricBar label="Execution" progress={81} tone="danger" value="High" />
          </div>
        </Card>
        <Card title="Analysis progress">
          <ProgressSteps items={progressItems} />
        </Card>
      </div>

      <div className="demo-story-grid">
        <Card title="Timeline">
          <Timeline items={timelineItems} />
        </Card>
        <Card title="Tasks">
          <TaskList items={taskItems.slice(0, 3)} />
        </Card>
        <Card title="Required deals">
          <DealList items={dealItems} />
        </Card>
        <Card title="Market signals">
          <NewsList items={newsItems} />
        </Card>
        <Card title="Pending changes">
          <ChangeReviewList items={changeItems} />
        </Card>
        <Card title="Related entities">
          <RelatedEntityList items={relatedItems} />
        </Card>
        <Card title="Communications">
          <CommunicationList items={communicationItems.slice(0, 3)} />
        </Card>
        <Card action={<Badge tone="info">4 results</Badge>} title="Search results">
          <SearchResults items={searchResults} />
        </Card>
      </div>
    </div>
  );
}

const meta = {
  title: 'Components/Patterns',
  component: PatternsOverview,
  tags: ['autodocs'],
  parameters: describeComponent(patternDescription),
} satisfies Meta<typeof PatternsOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  parameters: describeStory(patternDescription),
};
