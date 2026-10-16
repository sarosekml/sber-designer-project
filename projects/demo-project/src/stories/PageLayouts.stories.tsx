import type { Meta, StoryObj } from '@storybook/react-vite';

import { Card, KpiCard } from '../components/cards';
import {
  CardGrid,
  ContentGrid,
  FilterPanel,
  PageStack,
  SplitLayout,
  ThreeColumnGrid,
  TwoColumnLayout,
} from '../components/page-layouts';
import { Badge, Button, SearchField, SegmentedControl } from '../components/primitives';
import { ChartPanel, TaskList } from '../components/patterns';
import { taskItems } from '../data/demo';
import { describeComponent, describeStory, pageLayoutDescription } from '../storybook/descriptions';

function PageLayoutsOverview() {
  return (
    <PageStack>
      <CardGrid>
        <KpiCard label="Tracked assets" value="186" delta="12 sectors" />
        <KpiCard label="Open ideas" value="42" delta="7 high priority" />
        <KpiCard label="Pending changes" value="9" delta="3 legal reviews" />
      </CardGrid>

      <ContentGrid>
        <PageStack>
          <ChartPanel
            comparisonValues={[46, 47, 49, 50, 52, 55, 57, 59]}
            meta="Last 12 months"
            title="Portfolio performance"
            values={[42, 45, 48, 47, 53, 58, 61, 67]}
          />
          <FilterPanel>
            <div className="demo-filter-bar">
              <SearchField placeholder="Find asset, fund, or idea" />
              <SegmentedControl active="All" items={['All', 'Active', 'Paused']} />
            </div>
            <Card title="Filtered work area">
              <p className="demo-page-subtitle">Use FilterPanel to keep local filters attached to the table or list they affect.</p>
            </Card>
          </FilterPanel>
        </PageStack>

        <PageStack>
          <Card title="Tasks" action={<Badge tone="info">Today</Badge>}>
            <TaskList items={taskItems.slice(0, 3)} />
          </Card>
          <div className="demo-story-row">
            <Button size="sm">Primary</Button>
            <Button size="sm" variant="secondary">Secondary</Button>
          </div>
        </PageStack>
      </ContentGrid>

      <SplitLayout>
        <TwoColumnLayout>
          <Card title="Primary column">
            <p className="demo-page-subtitle">TwoColumnLayout keeps narrative or forms beside an insight rail.</p>
          </Card>
          <Card title="Insight rail">
            <p className="demo-page-subtitle">Use the rail for scoring, tasks, or review status.</p>
          </Card>
        </TwoColumnLayout>
        <ThreeColumnGrid>
          <Card title="Заёмщик"><p className="demo-page-subtitle">Borrower facts.</p></Card>
          <Card title="Условия кредита"><p className="demo-page-subtitle">Credit terms.</p></Card>
          <Card title="Риск-профиль"><p className="demo-page-subtitle">Risk metrics.</p></Card>
        </ThreeColumnGrid>
      </SplitLayout>
    </PageStack>
  );
}

const meta = {
  title: 'Components/Page Layouts',
  component: PageLayoutsOverview,
  tags: ['autodocs'],
  parameters: describeComponent(pageLayoutDescription),
} satisfies Meta<typeof PageLayoutsOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  parameters: describeStory(pageLayoutDescription),
};
