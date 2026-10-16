import type { Meta, StoryObj } from '@storybook/react';

import { TestAfterRebuildHarness02 } from '../../../screens/DeepseekV4Pro/TestAfterRebuildHarness02';

const meta = {
  title: 'Screens/DeepseekV4Pro/Test-after-rebuild-harness-02',
  component: TestAfterRebuildHarness02,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof TestAfterRebuildHarness02>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Test-after-rebuild-harness-02',
};
