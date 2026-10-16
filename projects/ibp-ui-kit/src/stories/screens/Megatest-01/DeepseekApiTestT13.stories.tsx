import type { Meta, StoryObj } from '@storybook/react';

import { DeepseekApiTestT13 } from '../../../screens/Megatest-01/DeepseekApiTestT13';

const meta = {
  title: 'Screens/Megatest-01/Deepseek-api-test-T13',
  component: DeepseekApiTestT13,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof DeepseekApiTestT13>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Deepseek-api-test-T13',
};
