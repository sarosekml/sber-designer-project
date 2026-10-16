import type { Meta, StoryObj } from '@storybook/react';

import { ImgTest02 } from '../../../screens/Misc/ImgTest02';

const meta = {
  title: 'Screens/Misc/img test 02',
  component: ImgTest02,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ImgTest02>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'img test 02',
};
