import type { Meta, StoryObj } from '@storybook/react';

import { NewTest01 } from '../../../screens/New folder/NewTest01';

const meta = {
  title: 'Screens/New folder/New-test-01',
  component: NewTest01,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof NewTest01>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'New-test-01',
};
