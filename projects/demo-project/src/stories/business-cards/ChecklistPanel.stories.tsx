import type { Meta, StoryObj } from '@storybook/react-vite';

import { ChecklistPanel } from '../../components/business-cards';
import { businessCardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Business Cards/Checklist Panel',
  component: ChecklistPanel,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof ChecklistPanel>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  args: {
    title: 'Decision tasks',
    items: [
      { label: 'Attach quarterly financial model', checked: true },
      { label: 'Verify beneficiary source', checked: true },
      { label: 'Request legal comment on minority protections' },
    ],
  },
  parameters: describeStory(businessCardDescription),
};
