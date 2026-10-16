import type { Meta, StoryObj } from '@storybook/react';

import { Test3CodexCliTextT10 } from '../../../screens/Megatest-03/Test3CodexCliTextT10';

const meta = {
  title: 'Screens/Megatest-03/test3-codex-cli-text-T10',
  component: Test3CodexCliTextT10,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Test3CodexCliTextT10>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'test3-codex-cli-text-T10',
};
