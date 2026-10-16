import type { Meta, StoryObj } from '@storybook/react-vite';

import { SearchHero } from '../../components/business-cards';
import { businessCardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Business Cards/Search Hero',
  component: SearchHero,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof SearchHero>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  args: {
    active: 'All',
    filters: ['All', 'Funds', 'Assets', 'Ideas'],
    query: 'murmansk',
    resultCount: '4 best matches across 148 indexed objects',
  },
  parameters: describeStory(businessCardDescription),
};
