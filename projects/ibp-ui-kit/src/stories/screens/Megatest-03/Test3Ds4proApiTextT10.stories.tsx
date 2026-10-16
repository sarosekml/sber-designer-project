import type { Meta, StoryObj } from '@storybook/react';

import { Test3Ds4proApiTextT10 } from '../../../screens/Megatest-03/Test3Ds4proApiTextT10';

const meta = {
  title: 'Screens/Megatest-03/test3-ds4pro-api-text-T10',
  component: Test3Ds4proApiTextT10,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Test3Ds4proApiTextT10>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'test3-ds4pro-api-text-T10',
};
