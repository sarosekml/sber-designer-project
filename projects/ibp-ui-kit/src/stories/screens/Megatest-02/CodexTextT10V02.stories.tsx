import type { Meta, StoryObj } from '@storybook/react';

import { CodexTextT10V02 } from '../../../screens/Megatest-02/CodexTextT10V02';

const meta = {
  title: 'Screens/Megatest-02/Codex-text-T10-v02',
  component: CodexTextT10V02,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof CodexTextT10V02>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Codex-text-T10-v02',
};
