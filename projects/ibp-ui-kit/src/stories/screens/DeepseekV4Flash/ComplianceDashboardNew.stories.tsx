import type { Meta, StoryObj } from '@storybook/react';

import { ComplianceDashboardNew } from '../../../screens/DeepseekV4Flash/ComplianceDashboardNew';

const meta = {
  title: 'Screens/DeepseekV4Flash/Compliance Dashboard New',
  component: ComplianceDashboardNew,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ComplianceDashboardNew>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Compliance Dashboard New',
};
