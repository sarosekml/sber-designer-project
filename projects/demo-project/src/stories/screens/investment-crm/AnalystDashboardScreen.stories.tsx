import type { Meta, StoryObj } from "@storybook/react-vite";

import { AnalystDashboardScreen } from "../../../screens/investment-crm/AnalystDashboardScreen";

const meta = {
  title: "Screens/Investment CRM/Analyst Dashboard",
  component: AnalystDashboardScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AnalystDashboardScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Analyst Dashboard",
};
