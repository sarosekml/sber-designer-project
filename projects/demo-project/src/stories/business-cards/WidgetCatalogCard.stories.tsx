import type { Meta, StoryObj } from '@storybook/react-vite';

import { WidgetCatalogCard } from '../../components/business-cards';
import { businessCardDescription, describeComponent, describeStory } from '../../storybook/descriptions';

const meta = {
  title: 'Components/Business Cards/Widget Catalog Card',
  component: WidgetCatalogCard,
  tags: ['autodocs'],
  parameters: describeComponent(businessCardDescription),
} satisfies Meta<typeof WidgetCatalogCard>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
  args: { items: ['Currency rates', 'Yield curve', 'Approvals queue'] },
  parameters: describeStory(businessCardDescription),
};
