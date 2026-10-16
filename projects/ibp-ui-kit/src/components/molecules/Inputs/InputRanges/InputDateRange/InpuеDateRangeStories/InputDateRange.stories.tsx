import React from 'react';
import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { Grid } from '@/index';

import { InputDateRange } from '../InputDateRange';

const meta: Meta<typeof InputDateRange> = {
  title: 'Molecules/Inputs/InputRanges/InputDateRange/InputDateRange',
  component: InputDateRange,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    disabled: { control: 'boolean' },
    size: {
      options: ['sm', 'md', 'lg'],
      control: { type: 'radio' },
    },
    viewType: {
      options: ['read', 'edit', 'present'],
      control: { type: 'radio' },
    },
    locale: {
      options: [undefined, 'ru', 'en'],
      control: { type: 'radio' },
    },
    view: {
      options: [undefined, 'month', 'year'],
      control: { type: 'radio' },
    },
    value: { control: 'text' },
    label: { control: 'text' },
    helperText: { control: 'text' },
    name: { control: 'text' },
    textColor: { control: 'text' },
    placeholder: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof InputDateRange>;

const InputDateRangeTemplate = (args) => {
  return (
    <Grid container spacing={8} alignItems={'center'}>
      <Grid item xs={12}>
        <InputDateRange {...args} />
      </Grid>
    </Grid>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение InputDatePicker',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    disabled: false,
    helperText: 'Helper text',
    label: 'InputDatePicker',
    name: 'InputDatePickerName',
    value: { from: '2024-03-03', to: '2025-03-03' },
    size: 'md',
    viewType: 'edit',
    infoOptions: { tooltipValue: 'InputDatePicker' },
    placeholder: 'placeholder text',
    onChange: action('onChange'),
    onClear: action('onClear'),
    onInfo: action('onInfo'),
  },
  render: (args) => <InputDateRangeTemplate {...args} />,
};
