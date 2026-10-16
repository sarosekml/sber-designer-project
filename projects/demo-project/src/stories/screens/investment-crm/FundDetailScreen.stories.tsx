import type { Meta, StoryObj } from "@storybook/react-vite";

import { FundDetailScreen } from "../../../screens/investment-crm/FundDetailScreen";

const meta = {
  title: "Screens/Investment CRM/Fund Detail",
  component: FundDetailScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FundDetailScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Fund Detail",
};
