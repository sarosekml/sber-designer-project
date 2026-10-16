import type { Meta, StoryObj } from '@storybook/react';

import { PeymentsTest05 } from '../../../screens/Opencode-DS4FlashFree/PeymentsTest05';

const meta = {
  title: 'Screens/Opencode-DS4FlashFree/Peyments-test-05',
  component: PeymentsTest05,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof PeymentsTest05>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Peyments-test-05',
};
