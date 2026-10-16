import type { Meta, StoryObj } from '@storybook/react-vite';

import { MetricsCard } from '../../components/business-cards';
import { Badge } from '../../components/primitives';
import { businessCardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Business Cards/Metrics Card',
  component: MetricsCard,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof MetricsCard>;

export default meta;
type Story = StoryObj<typeof meta>;


export const RiskProfile: Story = {
  args: {
    title: 'Риск-профиль',
    meta: <Badge tone="warning">BB+</Badge>,
    items: [
      { label: 'PD (1 год)', progress: 8, tone: 'warning', value: '0.8%' },
      { label: 'LGD', progress: 45, tone: 'warning', value: '45%' },
      { label: 'Отраслевой риск', progress: 55, tone: 'warning', value: 'Средний' },
      { label: 'Страновой риск', progress: 30, tone: 'info', value: 'Низкий' },
    ],
  },
  parameters: describeStory(businessCardDescription),
};
