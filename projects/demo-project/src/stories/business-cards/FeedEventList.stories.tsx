import type { Meta, StoryObj } from '@storybook/react-vite';

import { FeedEventList } from '../../components/business-cards';
import { feedEvents } from '../cardFixtures';
import { businessCardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Business Cards/Feed Event List',
  component: FeedEventList,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof FeedEventList>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  args: { items: feedEvents },
  parameters: describeStory(businessCardDescription),
};
