import type { Meta, StoryObj } from '@storybook/react-vite';

import { BarChart, DonutChart, Heatmap, LineChart, Sparkline } from '../components/charts';
import { Card } from '../components/cards';
import { chartDescription, describeComponent, describeStory } from '../storybook/descriptions';

function ChartsOverview() {
  return (
    <div className="demo-story-grid">
      <Card title="Line chart">
        <LineChart
          comparisonValues={[52, 53, 54, 56, 57, 59, 60]}
          values={[44, 48, 51, 57, 62, 66, 71]}
        />
      </Card>
      <Card title="Bars">
        <BarChart
          items={[
            { label: 'Sourced', value: 88, detail: '42 deals' },
            { label: 'Screening', value: 64, detail: '31 deals', tone: 'info' },
            { label: 'Diligence', value: 38, detail: '18 deals', tone: 'warning' },
          ]}
        />
      </Card>
      <Card title="Allocation">
        <DonutChart
          center="64%"
          segments={[
            { label: 'Metals', value: 38, tone: 'accent' },
            { label: 'Banks', value: 26, tone: 'info' },
            { label: 'Pharma', value: 18, tone: 'violet' },
            { label: 'Logistics', value: 18, tone: 'warning' },
          ]}
        />
      </Card>
      <Card title="Risk heatmap">
        <Heatmap
          columns={['Q1', 'Q2', 'Q3', 'Q4']}
          rows={['Banks', 'Metals', 'Ports']}
          values={[2, 3, 3, 4, 3, 4, 4, 5, 2, 2, 3, 4]}
        />
      </Card>
      <Card title="Sparkline">
        <Sparkline values={[38, 42, 44, 47, 53, 51, 58, 64]} />
      </Card>
    </div>
  );
}

const meta = {
  title: 'Components/Charts',
  component: ChartsOverview,
  tags: ['autodocs'],
  parameters: describeComponent(chartDescription),
} satisfies Meta<typeof ChartsOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  parameters: describeStory(chartDescription),
};
