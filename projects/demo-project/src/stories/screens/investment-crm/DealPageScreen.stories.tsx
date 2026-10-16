import type { Meta, StoryObj } from "@storybook/react-vite";

import { DealPageScreen } from "../../../screens/investment-crm/DealPageScreen";

const meta = {
  title: "Screens/Investment CRM/Deal Page Port Murmansk",
  component: DealPageScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DealPageScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Deal Page · Port Murmansk",
};
