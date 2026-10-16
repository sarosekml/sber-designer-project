import type { Meta, StoryObj } from '@storybook/react-vite';

import { InteractionHistory } from '../../components/cards';
import { cardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Cards/Interaction History Card',
  component: InteractionHistory,
  tags: ['autodocs'],
  parameters: describeComponent(cardDescription),
} satisfies Meta<typeof InteractionHistory>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  render: () => <InteractionHistory />,
  parameters: describeStory(cardDescription),
};
