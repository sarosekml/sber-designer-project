import type { Meta, StoryObj } from '@storybook/react';

import { PaymentPage } from '../../../screens/Payments/PaymentPage';

const meta = {
  title: 'Screens/Payments/Payment page',
  component: PaymentPage,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof PaymentPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Payment page',
};
