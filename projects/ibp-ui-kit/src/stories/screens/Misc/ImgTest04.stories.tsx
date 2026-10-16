import type { Meta, StoryObj } from '@storybook/react';

import { ImgTest04 } from '../../../screens/Misc/ImgTest04';

const meta = {
  title: 'Screens/Misc/img test 04',
  component: ImgTest04,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ImgTest04>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'img test 04',
};
