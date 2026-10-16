import React, { ChangeEvent } from 'react';
import { Meta, StoryFn } from '@storybook/react';

import { CheckboxTable } from './CheckboxTable';
import { CheckboxTableItem, CheckboxTableProps } from './CheckboxTable.types';

export default {
  title: 'Molecules/CheckboxTable',
  component: CheckboxTable,
  argTypes: {
    dataTestId: {
      description: 'CheckboxTable',
    },
  },
} as Meta<typeof CheckboxTable>;

const Template: StoryFn<typeof CheckboxTable> = (args) => <CheckboxTable {...args} />;

let data: CheckboxTableItem[] = [
  {
    label: 'Apple',
    checked: false,
  },
  {
    label: 'Banana',
    checked: true,
  },
  {
    label: 'Orange',
    checked: false,
  },
];

export const Main = Template.bind({});
Main.args = {
  dataTestId: 'stories',
  title: 'Fruits',
  isAllChecked: false,
  onChange: (event: ChangeEvent<HTMLInputElement>) => {
    data = data.map((it) => {
      return it.label === event.target.name ? { ...it, checked: event.target.checked } : { ...it };
    });
  },
  onChangeAll: (event: ChangeEvent<HTMLInputElement>) => {
    data = event.target.checked
      ? data.map((it) => ({ ...it, checked: true }))
      : data.map((it) => ({ ...it, checked: false }));
  },
  data,
} as CheckboxTableProps;
