import type { Meta, StoryObj } from '@storybook/react-vite';

import { KpiCard } from '../../components/cards';
import { Sparkline } from '../../components/charts';
import { cardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Cards/KPI Card',
  component: KpiCard,
  tags: ['autodocs'],
  parameters: describeComponent(cardDescription),
} satisfies Meta<typeof KpiCard>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  args: {
    label: 'Portfolio value',
    value: '128.4',
    unit: 'bn RUB',
    delta: '+4.2% this month',
  },
  parameters: describeStory(cardDescription),
};

export const WithSparkline: Story = {
  args: {
    chart: <Sparkline values={[38, 42, 44, 47, 53, 51, 58, 64]} />,
    delta: '+8.4% YoY',
    label: 'Portfolio value',
    unit: 'bn RUB',
    value: '2,840',
  },
  parameters: describeStory(cardDescription),
};
