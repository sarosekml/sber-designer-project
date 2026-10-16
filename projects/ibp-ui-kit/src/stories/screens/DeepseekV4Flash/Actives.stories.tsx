import type { Meta, StoryObj } from '@storybook/react';

import { Actives } from '../../../screens/DeepseekV4Flash/Actives';

const meta = {
  title: 'Screens/DeepseekV4Flash/Actives',
  component: Actives,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Actives>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Actives',
};
