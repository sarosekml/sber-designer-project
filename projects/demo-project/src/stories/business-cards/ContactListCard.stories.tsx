import type { Meta, StoryObj } from '@storybook/react-vite';

import { ContactListCard } from '../../components/business-cards';
import { businessCardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Business Cards/Contact List Card',
  component: ContactListCard,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof ContactListCard>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  args: {
    items: [
      { initials: 'SP', name: 'Sergey Petrov', role: 'Deal lead', tone: 'blue' },
      { initials: 'AK', name: 'Anna Kim', role: 'Analyst', tone: 'emerald' },
    ],
  },
  parameters: describeStory(businessCardDescription),
};
