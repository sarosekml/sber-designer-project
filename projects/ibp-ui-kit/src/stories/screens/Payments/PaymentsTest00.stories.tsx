import type { Meta, StoryObj } from '@storybook/react';

import { PaymentsTest00 } from '../../../screens/Payments/PaymentsTest00';

const meta = {
  title: 'Screens/Payments/Payments-test-00',
  component: PaymentsTest00,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof PaymentsTest00>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Payments-test-00',
};
