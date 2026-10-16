import type { Meta, StoryObj } from '@storybook/react-vite';

import { AssetsTable } from '../../components/cards';
import { cardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Cards/Assets Table Card',
  component: AssetsTable,
  tags: ['autodocs'],
  parameters: describeComponent(cardDescription),
} satisfies Meta<typeof AssetsTable>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  render: () => <AssetsTable />,
  parameters: describeStory(cardDescription),
};
