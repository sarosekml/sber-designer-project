import type { Meta, StoryObj } from "@storybook/react-vite";

import { DashboardCustomScreen } from "../../../screens/investment-crm/DashboardCustomScreen";

const meta = {
  title: "Screens/Investment CRM/Dashboard Custom",
  component: DashboardCustomScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DashboardCustomScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Dashboard Custom",
};
