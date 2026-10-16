import type { Meta, StoryObj } from '@storybook/react';

import { Test3Dp4proApiTextT13 } from '../../../screens/Megatest-03/Test3Dp4proApiTextT13';

const meta = {
  title: 'Screens/Megatest-03/test3-dp4pro-api-text-T13',
  component: Test3Dp4proApiTextT13,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Test3Dp4proApiTextT13>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'test3-dp4pro-api-text-T13',
};
