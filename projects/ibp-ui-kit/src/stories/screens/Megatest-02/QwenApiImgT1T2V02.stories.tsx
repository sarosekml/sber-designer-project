import type { Meta, StoryObj } from '@storybook/react';

import { QwenApiImgT1T2V02 } from '../../../screens/Megatest-02/QwenApiImgT1T2V02';

const meta = {
  title: 'Screens/Megatest-02/Qwen-api-img-t1-t2-v02',
  component: QwenApiImgT1T2V02,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof QwenApiImgT1T2V02>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Qwen-api-img-t1-t2-v02',
};
