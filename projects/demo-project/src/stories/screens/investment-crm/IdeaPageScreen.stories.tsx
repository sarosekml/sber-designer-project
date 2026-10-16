import type { Meta, StoryObj } from "@storybook/react-vite";

import { IdeaPageScreen } from "../../../screens/investment-crm/IdeaPageScreen";

const meta = {
  title: "Screens/Investment CRM/Idea Page",
  component: IdeaPageScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof IdeaPageScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Idea Page",
};
