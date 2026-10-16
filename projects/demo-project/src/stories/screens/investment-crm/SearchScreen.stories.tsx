import type { Meta, StoryObj } from "@storybook/react-vite";

import { SearchScreen } from "../../../screens/investment-crm/SearchScreen";

const meta = {
  title: "Screens/Investment CRM/Search",
  component: SearchScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SearchScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Search",
};
