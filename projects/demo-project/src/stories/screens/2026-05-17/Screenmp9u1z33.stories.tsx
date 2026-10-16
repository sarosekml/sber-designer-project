import type { Meta, StoryObj } from '@storybook/react-vite';

import { Screenmp9u1z33 } from '../../../screens/2026-05-17/Screenmp9u1z33';

const meta = {
  title: 'Screens/2026-05-17/Сделка для демо mp9u1z33',
  component: Screenmp9u1z33,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Screenmp9u1z33>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Сделка для демо',
};
