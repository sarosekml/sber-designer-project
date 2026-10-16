import type { Meta, StoryObj } from "@storybook/react";
import { DealD3174SevernyHab } from "../../../screens/2026-05-17/DealD3174SevernyHab";

const meta: Meta<typeof DealD3174SevernyHab> = {
  title: "Screens/2026-05-17/D-3174 · Покупка актива Северный Хаб",
  component: DealD3174SevernyHab,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof DealD3174SevernyHab>;

export const Default: Story = {};
