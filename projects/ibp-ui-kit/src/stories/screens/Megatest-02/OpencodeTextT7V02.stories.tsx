import type { Meta, StoryObj } from '@storybook/react';

import { OpencodeTextT7V02 } from '../../../screens/Megatest-02/OpencodeTextT7V02';

const meta = {
  title: 'Screens/Megatest-02/Opencode-text-T7-v02',
  component: OpencodeTextT7V02,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof OpencodeTextT7V02>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Opencode-text-T7-v02',
};
