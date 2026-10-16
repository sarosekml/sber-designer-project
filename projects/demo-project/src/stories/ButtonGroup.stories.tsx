import type { Meta, StoryObj } from '@storybook/react-vite';

import { ButtonGroup } from '../components/primitives';
import {
  buttonGroupDescription,
  describeComponent,
  describeStory,
} from '../storybook/descriptions';

const meta = {
  title: 'Components/Button Group',
  component: ButtonGroup,
  tags: ['autodocs'],
  parameters: describeComponent(buttonGroupDescription),
  args: {
    active: 'Day',
    items: ['Day', 'Week', 'Month', 'Year'],
  },
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TimeRange: Story = {
  parameters: describeStory(buttonGroupDescription),
};

export const RussianLabels: Story = {
  args: {
    active: 'День',
    items: ['День', 'Неделя', 'Месяц', 'Год'],
  },
};
