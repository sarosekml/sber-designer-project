import type { Meta, StoryObj } from '@storybook/react-vite';

import { NewsPanel } from '../../components/business-cards';
import { newsItems } from '../../data/demo';
import { businessCardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Business Cards/News Panel',
  component: NewsPanel,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof NewsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  args: { items: newsItems.slice(0, 3) },
  parameters: describeStory(businessCardDescription),
};
