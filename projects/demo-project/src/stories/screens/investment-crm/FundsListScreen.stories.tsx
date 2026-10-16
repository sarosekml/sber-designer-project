import type { Meta, StoryObj } from "@storybook/react-vite";

import { FundsListScreen } from "../../../screens/investment-crm/FundsListScreen";

const meta = {
  title: "Screens/Investment CRM/Funds List",
  component: FundsListScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FundsListScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Funds List",
};
