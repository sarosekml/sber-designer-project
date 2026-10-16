import type { Meta, StoryObj } from '@storybook/react';

import { B6StructuredBrief03 } from '../../../screens/B6-live-test/B6StructuredBrief03';

const meta = {
  title: 'Screens/B6-live-test/B6-structured-brief-03',
  component: B6StructuredBrief03,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof B6StructuredBrief03>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'B6-structured-brief-03',
};
