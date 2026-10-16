import type { Meta, StoryObj } from '@storybook/react';

import { TestAfterRebuildHarness01 } from '../../../screens/DeepseekV4Pro/TestAfterRebuildHarness01';

const meta = {
  title: 'Screens/DeepseekV4Pro/Test-after-rebuild-harness-01',
  component: TestAfterRebuildHarness01,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof TestAfterRebuildHarness01>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Test-after-rebuild-harness-01',
};
