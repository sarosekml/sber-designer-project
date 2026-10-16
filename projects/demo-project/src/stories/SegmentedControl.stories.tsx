import type { Meta, StoryObj } from '@storybook/react-vite';

import { SegmentedControl } from '../components/primitives';
import {
  describeComponent,
  describeStory,
  segmentedControlDescription,
} from '../storybook/descriptions';

const meta = {
  title: 'Components/Segmented Control',
  component: SegmentedControl,
  tags: ['autodocs'],
  parameters: describeComponent(segmentedControlDescription),
  args: {
    active: 'All',
    items: ['All', 'Active', 'Archive'],
  },
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StatusFilter: Story = {
  parameters: describeStory(segmentedControlDescription),
};

export const PlanAct: Story = {
  args: {
    active: 'Plan',
    items: ['Plan', 'Act'],
  },
};
