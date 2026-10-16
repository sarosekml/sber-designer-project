import React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta, StoryFn, StoryObj } from '@storybook/react';

import { Grid, Icon } from '@/components/atoms';

import { InputDate } from '../InputDate';

const meta: Meta<typeof InputDate> = {
  title: 'Molecules/Inputs/InputDate/InputDate',
  component: InputDate,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Компонент ввода даты',
      },
    },
  },
  argTypes: {
    disabled: { control: 'boolean' },
    strictCheck: { control: 'boolean' },
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
    helperText: { control: 'text' },
    placeholder: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof InputDate>;

export const Main: Story = {
  args: {
    dataTestId: 'InputDatePicker',
    disabled: false,
    helperText: 'Helper text',
    label: 'InputDatePicker',
    name: 'InputDatePickerName',
    value: '2024-03-03',
    size: 'md',
    viewType: 'edit',
    infoOptions: { tooltipValue: 'InputDatePicker' },
    onChange: action('onChange'),
    onInfo: action('onInfo'),
    onClear: action('onClear'),
  },
};

const ExamplesTemplate: StoryFn = (args) => (
  <Grid container>
    <InputDate
      name={'sla'}
      label={'SLA'}
      value={'11.11.2011'}
      size={'lg'}
      viewType={'read'}
      prefix={<Icon name={'ClockTimer'} color={'secondary'} />}
      postfix={<span>{'postfix any text'}</span>}
      labelOptions={{
        tooltipValue: 'The start date of the SLA and the number of remaining days to make a decision',
      }}
      textColor={'green'}
    />
  </Grid>
);

export const Examples = ExamplesTemplate.bind({});
