import type { Meta, StoryObj } from '@storybook/react-vite';

import { ChangePanel } from '../../components/business-cards';
import { changeItems } from '../../data/demo';
import { businessCardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Business Cards/Change Panel',
  component: ChangePanel,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof ChangePanel>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  args: { items: changeItems },
  parameters: describeStory(businessCardDescription),
};
