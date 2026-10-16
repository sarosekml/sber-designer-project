import type { Meta, StoryObj } from '@storybook/react';

import { DCM2 } from '../../../screens/DCM Deals/DCM2';

const meta = {
  title: 'Screens/DCM Deals/DCM2',
  component: DCM2,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof DCM2>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'DCM2',
};