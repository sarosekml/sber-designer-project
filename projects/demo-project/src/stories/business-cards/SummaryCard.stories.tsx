import type { Meta, StoryObj } from '@storybook/react-vite';

import { SummaryCard } from '../../components/business-cards';
import { Badge, Button } from '../../components/primitives';
import { businessCardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Business Cards/Summary Card',
  component: SummaryCard,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof SummaryCard>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  args: {
    title: 'Decision summary',
    badge: <Badge tone="info">Draft</Badge>,
    text: 'Recommended next step is focused review of terminal capacity, debt covenants, and minority investor protections before committee submission.',
    actions: <Button size="sm">Accept</Button>,
  },
  parameters: describeStory(businessCardDescription),
};
