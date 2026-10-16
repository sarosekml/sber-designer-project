import type { Meta, StoryObj } from '@storybook/react-vite';

import { DropTargetCard } from '../../components/business-cards';
import { businessCardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Business Cards/Drop Target Card',
  component: DropTargetCard,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof DropTargetCard>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  render: () => <DropTargetCard />,
  parameters: describeStory(businessCardDescription),
};
