import type { Meta, StoryObj } from '@storybook/react';

import { TestNewHarness01 } from '../../../screens/DeepseekV4Pro/TestNewHarness01';

const meta = {
  title: 'Screens/DeepseekV4Pro/Test-new-harness-01',
  component: TestNewHarness01,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof TestNewHarness01>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Test-new-harness-01',
};
