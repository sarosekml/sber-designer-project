import type { Meta, StoryObj } from "@storybook/react-vite";

import { AnalystFeedScreen } from "../../../screens/investment-crm/AnalystFeedScreen";

const meta = {
  title: "Screens/Investment CRM/Analyst Feed",
  component: AnalystFeedScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AnalystFeedScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Analyst Feed",
};
