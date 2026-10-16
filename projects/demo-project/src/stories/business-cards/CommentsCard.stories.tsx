import type { Meta, StoryObj } from '@storybook/react-vite';

import { CommentsCard } from '../../components/business-cards';
import { businessCardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Business Cards/Comments Card',
  component: CommentsCard,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof CommentsCard>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  args: { meta: <span className="t-micro">3 comments</span> },
  parameters: describeStory(businessCardDescription),
};
