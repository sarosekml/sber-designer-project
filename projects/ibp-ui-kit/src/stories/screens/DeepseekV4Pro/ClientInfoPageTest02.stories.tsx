import type { Meta, StoryObj } from '@storybook/react';

import { ClientInfoPageTest02 } from '../../../screens/DeepseekV4Pro/ClientInfoPageTest02';

const meta = {
  title: 'Screens/DeepseekV4Pro/ClientInfoPage Test 02',
  component: ClientInfoPageTest02,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ClientInfoPageTest02>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'ClientInfoPage Test 02',
};
