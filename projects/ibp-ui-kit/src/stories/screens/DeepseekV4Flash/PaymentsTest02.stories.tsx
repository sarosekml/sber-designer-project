import type { Meta, StoryObj } from '@storybook/react';

import { PaymentsTest02 } from '../../../screens/DeepseekV4Flash/PaymentsTest02';

const meta = {
  title: 'Screens/DeepseekV4Flash/Payments-test-02',
  component: PaymentsTest02,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof PaymentsTest02>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Payments-test-02',
};
