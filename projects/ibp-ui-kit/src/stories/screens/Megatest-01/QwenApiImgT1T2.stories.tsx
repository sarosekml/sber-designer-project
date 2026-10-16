import type { Meta, StoryObj } from '@storybook/react';

import { QwenApiImgT1T2 } from '../../../screens/Megatest-01/QwenApiImgT1T2';

const meta = {
  title: 'Screens/Megatest-01/Qwen-api-img-t1-t2',
  component: QwenApiImgT1T2,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof QwenApiImgT1T2>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Qwen-api-img-t1-t2',
};
