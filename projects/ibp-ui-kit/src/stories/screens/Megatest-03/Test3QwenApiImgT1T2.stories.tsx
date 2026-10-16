import type { Meta, StoryObj } from '@storybook/react';

import { Test3QwenApiImgT1T2 } from '../../../screens/Megatest-03/Test3QwenApiImgT1T2';

const meta = {
  title: 'Screens/Megatest-03/test3-qwen-api-img-T1-T2',
  component: Test3QwenApiImgT1T2,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Test3QwenApiImgT1T2>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'test3-qwen-api-img-T1-T2',
};
