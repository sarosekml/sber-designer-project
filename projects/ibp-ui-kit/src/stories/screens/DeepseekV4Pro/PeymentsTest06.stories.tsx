import type { Meta, StoryObj } from '@storybook/react';

import { PeymentsTest06 } from '../../../screens/DeepseekV4Pro/PeymentsTest06';

const meta = {
  title: 'Screens/DeepseekV4Pro/Peyments-test-06',
  component: PeymentsTest06,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof PeymentsTest06>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Peyments-test-06',
};
