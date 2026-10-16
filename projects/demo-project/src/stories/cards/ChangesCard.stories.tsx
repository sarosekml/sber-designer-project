import type { Meta, StoryObj } from '@storybook/react-vite';

import { ChangesCard } from '../../components/cards';
import { cardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Cards/Changes To Approve Card',
  component: ChangesCard,
  tags: ['autodocs'],
  parameters: describeComponent(cardDescription),
} satisfies Meta<typeof ChangesCard>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  render: () => <ChangesCard />,
  parameters: describeStory(cardDescription),
};
