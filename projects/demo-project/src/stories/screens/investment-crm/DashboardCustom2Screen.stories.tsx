import type { Meta, StoryObj } from "@storybook/react-vite";

import { DashboardCustom2Screen } from "../../../screens/investment-crm/DashboardCustom2Screen";

const meta = {
  title: "Screens/Investment CRM/Dashboard Custom 2",
  component: DashboardCustom2Screen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DashboardCustom2Screen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Dashboard Custom 2",
};
