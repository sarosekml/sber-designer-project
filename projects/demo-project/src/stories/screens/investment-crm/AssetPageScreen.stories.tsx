import type { Meta, StoryObj } from "@storybook/react-vite";

import { AssetPageScreen } from "../../../screens/investment-crm/AssetPageScreen";

const meta = {
  title: "Screens/Investment CRM/Asset Page",
  component: AssetPageScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AssetPageScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Asset Page",
};
