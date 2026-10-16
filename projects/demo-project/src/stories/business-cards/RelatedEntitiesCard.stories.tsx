import type { Meta, StoryObj } from '@storybook/react-vite';

import { RelatedEntitiesCard } from '../../components/business-cards';
import { businessCardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Business Cards/Related Entities Card',
  component: RelatedEntitiesCard,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof RelatedEntitiesCard>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  args: {
    items: [
      { title: 'Port Murmansk', meta: 'Target asset - 18.4 bn RUB', tag: 'Asset', tone: 'capital' },
      { title: 'Northern Logistics Fund', meta: 'Potential buyer', tag: 'Fund', tone: 'finance' },
      { title: 'Interros Capital', meta: 'Stakeholder and committee owner', tag: 'Fund', tone: 'metal' },
    ],
  },
  parameters: describeStory(businessCardDescription),
};
