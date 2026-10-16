import type { Meta, StoryObj } from '@storybook/react';

import { CodexTextT10 } from '../../../screens/Megatest-01/CodexTextT10';

const meta = {
  title: 'Screens/Megatest-01/Codex-text-T10',
  component: CodexTextT10,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof CodexTextT10>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Codex-text-T10',
};
