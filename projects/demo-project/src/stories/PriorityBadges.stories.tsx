import type { Meta, StoryObj } from '@storybook/react-vite';

import { PriorityBadge } from '../components/primitives';
import {
  describeComponent,
  describeStory,
  priorityBadgeDescription,
} from '../storybook/descriptions';

function PriorityBadgesPreview() {
  return (
    <div className="demo-story-row">
      <PriorityBadge tone="high">Приоритет: Высокий</PriorityBadge>
      <PriorityBadge tone="mid">Средний</PriorityBadge>
      <PriorityBadge tone="low">Низкий</PriorityBadge>
    </div>
  );
}

const meta = {
  title: 'Components/Priority Badges',
  component: PriorityBadgesPreview,
  tags: ['autodocs'],
  parameters: describeComponent(priorityBadgeDescription),
} satisfies Meta<typeof PriorityBadgesPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllPriorities: Story = {
  name: 'All Priorities',
  parameters: describeStory(priorityBadgeDescription),
};

export const High: Story = {
  render: () => <PriorityBadge tone="high">Приоритет: Высокий</PriorityBadge>,
  parameters: describeStory(priorityBadgeDescription),
};

export const Medium: Story = {
  render: () => <PriorityBadge tone="mid">Средний</PriorityBadge>,
  parameters: describeStory(priorityBadgeDescription),
};

export const Low: Story = {
  render: () => <PriorityBadge tone="low">Низкий</PriorityBadge>,
  parameters: describeStory(priorityBadgeDescription),
};
