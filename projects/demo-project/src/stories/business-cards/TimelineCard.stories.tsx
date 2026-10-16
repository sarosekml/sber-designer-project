import type { Meta, StoryObj } from '@storybook/react-vite';

import { TimelineCard } from '../../components/business-cards';
import { timelineItems } from '../cardFixtures';
import { businessCardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Business Cards/Timeline Card',
  component: TimelineCard,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof TimelineCard>;

export default meta;
type Story = StoryObj<typeof meta>;


export const DealHistory: Story = {
  args: { title: 'История сделки', items: timelineItems },
  parameters: describeStory(businessCardDescription),
};
