import type { Meta, StoryObj } from "@storybook/react-vite";

import { ChangesScreen } from "../../../screens/investment-crm/ChangesScreen";

const meta = {
  title: "Screens/Investment CRM/Changes",
  component: ChangesScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ChangesScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Changes",
};
