import type { Meta, StoryObj } from '@storybook/react-vite';

import { IdeaCard } from '../../components/cards';
import { cardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Cards/Deal Idea Card',
  component: IdeaCard,
  tags: ['autodocs'],
  parameters: describeComponent(cardDescription),
} satisfies Meta<typeof IdeaCard>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  render: () => <IdeaCard />,
  parameters: describeStory(cardDescription),
};
