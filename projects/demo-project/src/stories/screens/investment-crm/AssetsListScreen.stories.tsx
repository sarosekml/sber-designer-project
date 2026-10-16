import type { Meta, StoryObj } from "@storybook/react-vite";

import { AssetsListScreen } from "../../../screens/investment-crm/AssetsListScreen";

const meta = {
  title: "Screens/Investment CRM/Assets List",
  component: AssetsListScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AssetsListScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Assets List",
};
