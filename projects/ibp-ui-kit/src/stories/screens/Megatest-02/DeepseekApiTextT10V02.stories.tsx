import type { Meta, StoryObj } from '@storybook/react';

import { DeepseekApiTextT10V02 } from '../../../screens/Megatest-02/DeepseekApiTextT10V02';

const meta = {
  title: 'Screens/Megatest-02/Deepseek-api-text-T10-v02',
  component: DeepseekApiTextT10V02,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof DeepseekApiTextT10V02>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Deepseek-api-text-T10-v02',
};
