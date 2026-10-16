import type { Meta, StoryObj } from '@storybook/react-vite';

import { TaskPanel } from '../../components/business-cards';
import { taskItems } from '../../data/demo';
import { businessCardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Business Cards/Task Panel',
  component: TaskPanel,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof TaskPanel>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  args: { items: taskItems.slice(0, 3) },
  parameters: describeStory(businessCardDescription),
};
