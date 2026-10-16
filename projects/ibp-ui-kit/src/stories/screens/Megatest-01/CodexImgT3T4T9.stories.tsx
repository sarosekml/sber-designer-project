import type { Meta, StoryObj } from '@storybook/react';

import { CodexImgT3T4T9 } from '../../../screens/Megatest-01/CodexImgT3T4T9';

const meta = {
  title: 'Screens/Megatest-01/Codex-img-t3-t4-t9',
  component: CodexImgT3T4T9,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof CodexImgT3T4T9>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Codex-img-t3-t4-t9',
};
