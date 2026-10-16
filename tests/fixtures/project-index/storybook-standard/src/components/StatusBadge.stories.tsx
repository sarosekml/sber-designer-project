import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatusBadge } from './StatusBadge';

const meta = {
  title: 'Components/StatusBadge',
  component: StatusBadge,
  parameters: {
    docs: {
      description: {
        component: 'Status badge for workflow state and review queues.',
      },
    },
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Ready',
    tone: 'success',
  },
  parameters: {
    docs: {
      description: {
        story: 'Use for positive states in compact tables.',
      },
    },
  },
};

export const Warning: Story = {
  args: {
    children: 'Needs review',
    tone: 'warning',
  },
  parameters: {
    docs: {
      description: {
        story: 'Use when an item requires manual attention.',
      },
    },
  },
};
