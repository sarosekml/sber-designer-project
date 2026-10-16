import type { Meta, StoryObj } from '@storybook/react-vite';

import { DealPanel } from '../../components/business-cards';
import { dealItems } from '../../data/demo';
import { businessCardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Business Cards/Deal Panel',
  component: DealPanel,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof DealPanel>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  args: { items: dealItems.slice(0, 3) },
  parameters: describeStory(businessCardDescription),
};
