import { Meta, StoryObj } from '@storybook/react';

import { CheckboxList } from './CheckboxList';
import { CheckboxListData } from './CheckboxList.types';

const meta: Meta<typeof CheckboxList> = {
  title: 'Molecules/CheckboxList',
  component: CheckboxList,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    title: { control: 'text' },
    description: { control: 'text' },
    disabled: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof CheckboxList>;

const data: CheckboxListData[] = [
  {
    label: 'Apple',
    checked: false,
    id: 'apple',
  },
  {
    label: 'Banana',
    checked: false,
    id: 'banana',
  },
  {
    label: 'Orange',
    checked: false,
    id: 'orange',
  },
];

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение CheckboxList',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    title: 'Fruits',
    description: 'Choose options',
    data,
    disabled: false,
  },
};
