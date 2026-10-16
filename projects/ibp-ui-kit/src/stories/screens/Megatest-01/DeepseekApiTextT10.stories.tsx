import type { Meta, StoryObj } from '@storybook/react';

import { DeepseekApiTextT10 } from '../../../screens/Megatest-01/DeepseekApiTextT10';

const meta = {
  title: 'Screens/Megatest-01/Deepseek-api-text-T10',
  component: DeepseekApiTextT10,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof DeepseekApiTextT10>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Deepseek-api-text-T10',
};
