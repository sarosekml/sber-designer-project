import type { Meta, StoryObj } from '@storybook/react';

import { DCMDraftTest01 } from '../../../screens/DeepseekV4Pro/DCMDraftTest01';

const meta = {
  title: 'Screens/DeepseekV4Pro/DCM-draft-test-01',
  component: DCMDraftTest01,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof DCMDraftTest01>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'DCM-draft-test-01',
};
