import type { Meta, StoryObj } from '@storybook/react';

import { B6StructuredBrief04 } from '../../../screens/B6-live-test/B6StructuredBrief04';

const meta = {
  title: 'Screens/B6-live-test/B6-structured-brief-04',
  component: B6StructuredBrief04,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof B6StructuredBrief04>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'B6-structured-brief-04',
};
