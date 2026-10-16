import type { Meta, StoryObj } from '@storybook/react';

import { ImgTest05 } from '../../../screens/Misc/ImgTest05';

const meta = {
  title: 'Screens/Misc/img test 05',
  component: ImgTest05,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ImgTest05>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'img test 05',
};
