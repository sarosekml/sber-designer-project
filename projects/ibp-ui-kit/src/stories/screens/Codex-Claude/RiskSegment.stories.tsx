import type { Meta, StoryObj } from '@storybook/react';

import { RiskSegment } from '../../../screens/Codex-Claude/RiskSegment';

const meta = {
  title: 'Screens/Codex-Claude/Risk-segment',
  component: RiskSegment,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof RiskSegment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Risk-segment',
};
