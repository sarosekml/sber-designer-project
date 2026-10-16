import type { Meta, StoryObj } from '@storybook/react';

import { AdministrationCodexImg } from '../../../screens/Codex-Claude/AdministrationCodexImg';

const meta = {
  title: 'Screens/Codex-Claude/Administration-codex-img',
  component: AdministrationCodexImg,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof AdministrationCodexImg>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Administration-codex-img',
};
