import type { Meta, StoryObj } from '@storybook/react';

import { ImgTest01 } from '../../../screens/Misc/ImgTest01';

const meta = {
  title: 'Screens/Misc/img test 01',
  component: ImgTest01,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ImgTest01>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'img test 01',
};
