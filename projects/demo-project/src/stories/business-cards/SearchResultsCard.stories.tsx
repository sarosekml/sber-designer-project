import type { Meta, StoryObj } from '@storybook/react-vite';

import { SearchResultsCard } from '../../components/business-cards';
import { searchResults } from '../../data/demo';
import { businessCardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Business Cards/Search Results Card',
  component: SearchResultsCard,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof SearchResultsCard>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  args: { items: searchResults },
  parameters: describeStory(businessCardDescription),
};
