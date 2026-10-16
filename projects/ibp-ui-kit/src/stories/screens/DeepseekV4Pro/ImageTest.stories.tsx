import type { Meta, StoryObj } from '@storybook/react';

import { ImageTest } from '../../../screens/DeepseekV4Pro/ImageTest';

const meta = {
  title: 'Screens/DeepseekV4Pro/Image-test',
  component: ImageTest,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ImageTest>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Image-test',
};
