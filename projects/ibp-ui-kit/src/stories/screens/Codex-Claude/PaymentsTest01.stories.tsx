import type { Meta, StoryObj } from '@storybook/react';

import { PaymentsTest01 } from '../../../screens/Codex-Claude/PaymentsTest01';

const meta = {
  title: 'Screens/Codex-Claude/Payments-test-01',
  component: PaymentsTest01,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof PaymentsTest01>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Payments-test-01',
};
