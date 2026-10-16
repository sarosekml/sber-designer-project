import type { Meta, StoryObj } from '@storybook/react';

import { CodexImgT3T4T9V02 } from '../../../screens/Megatest-02/CodexImgT3T4T9V02';

const meta = {
  title: 'Screens/Megatest-02/Codex-img-t3-t4-t9-v02',
  component: CodexImgT3T4T9V02,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof CodexImgT3T4T9V02>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Codex-img-t3-t4-t9-v02',
};
