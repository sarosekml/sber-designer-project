import type { Meta, StoryObj } from '@storybook/react';

import { ImgTest03 } from '../../../screens/Misc/ImgTest03';

const meta = {
  title: 'Screens/Misc/img test 03',
  component: ImgTest03,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ImgTest03>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'img test 03',
};
