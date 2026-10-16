import type { Meta, StoryObj } from '@storybook/react';

import { OpencodeTextT7 } from '../../../screens/Megatest-01/OpencodeTextT7';

const meta = {
  title: 'Screens/Megatest-01/Opencode-text-t7',
  component: OpencodeTextT7,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof OpencodeTextT7>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Opencode-text-t7',
};
