import type { Meta, StoryObj } from '@storybook/react';

import { PaymentsTest03 } from '../../../screens/Codex-Claude/PaymentsTest03';

const meta = {
  title: 'Screens/Codex-Claude/Payments-test-03',
  component: PaymentsTest03,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof PaymentsTest03>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Payments-test-03',
};
