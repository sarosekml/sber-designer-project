import type { Meta, StoryObj } from '@storybook/react';

import { DeepseekApiTextT13 } from '../../../screens/Megatest-02/DeepseekApiTextT13';

const meta = {
  title: 'Screens/Megatest-02/Deepseek-api-text-T13',
  component: DeepseekApiTextT13,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof DeepseekApiTextT13>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Deepseek-api-text-T13',
};
