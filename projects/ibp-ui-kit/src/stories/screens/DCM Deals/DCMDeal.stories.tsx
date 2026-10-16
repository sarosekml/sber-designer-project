import type { Meta, StoryObj } from '@storybook/react';

import { DCMDeal } from '../../../screens/DCM Deals/DCMDeal';

const meta = {
  title: 'Screens/DCM Deals/DCM Deal',
  component: DCMDeal,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof DCMDeal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'DCM Deal',
};
