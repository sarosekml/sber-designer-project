import type { Meta, StoryObj } from '@storybook/react';

import { DeepseekApiTextT11 } from '../../../screens/Megatest-02/DeepseekApiTextT11';

const meta = {
  title: 'Screens/Megatest-02/Deepseek-api-text-T11',
  component: DeepseekApiTextT11,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof DeepseekApiTextT11>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Deepseek-api-text-T11',
};
