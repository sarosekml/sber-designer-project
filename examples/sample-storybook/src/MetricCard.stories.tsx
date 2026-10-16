import type { Meta, StoryObj } from '@storybook/react';

import { MetricCard } from './MetricCard';

const meta = {
  title: 'Cards/MetricCard',
  component: MetricCard,
  tags: ['autodocs'],
  args: {
    label: 'Revenue',
    value: '₽ 48 200',
    delta: { kind: 'up', text: '+12.4%' },
  },
} satisfies Meta<typeof MetricCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Up: Story = {};
export const Down: Story = {
  args: { label: 'Active clients', value: '1 348', delta: { kind: 'down', text: '−1.8%' } },
};
export const NoDelta: Story = {
  args: { label: 'Conversion', value: '28.3%', delta: undefined },
};
