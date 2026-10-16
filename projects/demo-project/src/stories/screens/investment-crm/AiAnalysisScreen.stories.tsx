import type { Meta, StoryObj } from "@storybook/react-vite";

import { AiAnalysisScreen } from "../../../screens/investment-crm/AiAnalysisScreen";

const meta = {
  title: "Screens/Investment CRM/AI Analysis",
  component: AiAnalysisScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AiAnalysisScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "AI Analysis",
};
