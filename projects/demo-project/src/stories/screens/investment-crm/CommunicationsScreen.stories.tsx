import type { Meta, StoryObj } from "@storybook/react-vite";

import { CommunicationsScreen } from "../../../screens/investment-crm/CommunicationsScreen";

const meta = {
  title: "Screens/Investment CRM/Communications",
  component: CommunicationsScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CommunicationsScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Communications",
};
