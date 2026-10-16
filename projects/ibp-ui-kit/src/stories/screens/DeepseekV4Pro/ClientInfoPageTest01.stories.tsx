import type { Meta, StoryObj } from '@storybook/react';

import { ClientInfoPageTest01 } from '../../../screens/DeepseekV4Pro/ClientInfoPageTest01';

const meta = {
  title: 'Screens/DeepseekV4Pro/ClientInfoPage Test 01',
  component: ClientInfoPageTest01,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ClientInfoPageTest01>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'ClientInfoPage Test 01',
};
