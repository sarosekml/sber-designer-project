import type { Meta, StoryObj } from '@storybook/react-vite';

import { NewsScreenmpa9bael } from '../../../screens/2026-05-17/NewsScreenmpa9bael';

const meta = {
  title: 'Screens/2026-05-17/News screen mpa9bael',
  component: NewsScreenmpa9bael,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof NewsScreenmpa9bael>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'News screen',
};
