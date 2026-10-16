import type { Meta, StoryObj } from '@storybook/react';

import { Screen0075RecoverySmoke } from '../../../screens/Misc/Screen0075RecoverySmoke';

const meta = {
  title: 'Screens/Misc/0075 Recovery Smoke',
  component: Screen0075RecoverySmoke,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Screen0075RecoverySmoke>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: '0075 Recovery Smoke',
};
