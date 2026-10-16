import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatusListCard } from '../../components/business-cards';
import { Badge } from '../../components/primitives';
import { collateralItems, covenantItems } from '../cardFixtures';
import { businessCardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Business Cards/Status List Card',
  component: StatusListCard,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof StatusListCard>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Collateral: Story = {
  args: {
    title: 'Обеспечение',
    action: <span className="tnum text-success text-strong">152%</span>,
    items: collateralItems,
  },
  parameters: describeStory(businessCardDescription),
};

export const Covenants: Story = {
  args: {
    title: 'Ковенанты',
    action: <Badge tone="info">4 rules</Badge>,
    items: covenantItems,
  },
  parameters: describeStory(businessCardDescription),
};
