import type { Meta, StoryObj } from '@storybook/react';

import { RiskMetrics } from '../../../screens/DeepseekV4Flash/RiskMetrics';

const meta = {
  title: 'Screens/DeepseekV4Flash/Risk-metrics',
  component: RiskMetrics,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof RiskMetrics>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Risk-metrics',
};
