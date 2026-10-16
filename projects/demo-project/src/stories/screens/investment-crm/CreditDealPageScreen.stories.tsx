import type { Meta, StoryObj } from "@storybook/react-vite";

import { CreditDealPageScreen } from "../../../screens/investment-crm/CreditDealPageScreen";

const meta = {
  title: "Screens/Investment CRM/Deal Page SeverProm Metallurgy",
  component: CreditDealPageScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CreditDealPageScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Deal Page · SeverProm Metallurgy",
};
