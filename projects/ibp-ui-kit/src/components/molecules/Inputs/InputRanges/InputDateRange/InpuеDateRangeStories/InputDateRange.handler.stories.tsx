import React, { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Grid } from '@mui/material';
import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { IsoDate } from '@sber-ibp/core';

import { SubmitButton } from '@/components/atoms';

import { FormHandler } from '../../../FormHandler';
import { InputDateRangeValue } from '../../InputRange.types';
import { InputDateRangeFormHandler } from '../InputDateRange.handler';

const meta: Meta<typeof InputDateRangeFormHandler> = {
  title: 'Molecules/Inputs/InputRanges/InputDateRange/InputDateRangeFormHandler',
  component: InputDateRangeFormHandler,
  tags: ['autodocs'],
  argTypes: {
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
    label: { control: 'text' },
    helperText: { control: 'text' },
    name: { control: 'text' },
    textColor: { control: 'text' },
    placeholder: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof InputDateRangeFormHandler>;

interface FormData {
  date: {
    from: IsoDate | null;
    to: IsoDate | null;
  };
}

const InputDateRangeHandlerTemplate = (args) => {
  const methods = useForm<FormData>();

  const onClear = useCallback(
    (value: InputDateRangeValue) => {
      console.log(value);
      methods.setValue('date', value);
    },
    [methods],
  );

  const onSubmit = useCallback((formData) => {
    console.log('Get a submit');
    console.log('form data:', formData);
  }, []);

  return (
    <Grid container spacing={4} alignItems={'center'}>
      <Grid item xs={12}>
        <FormHandler dataTestId="testForm" methods={methods} formId={'InputDateRangeForm'} onSubmit={onSubmit}>
          <InputDateRangeFormHandler {...args} onClear={onClear} />
        </FormHandler>
      </Grid>
      <Grid item xs={3}>
        <SubmitButton formId="InputDateRangeForm">Submit</SubmitButton>
      </Grid>
    </Grid>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение InputDateRangeFormHandler',
      },
    },
  },
  args: {
    dataTestId: 'stories',
    disabled: false,
    helperText: 'Helper text',
    label: 'InputDatePicker',
    name: 'date',
    size: 'md',
    viewType: 'edit',
    infoOptions: { tooltipValue: 'InputDatePicker' },
    placeholder: 'placeholder text',
    onChange: action('onChange'),
    onClear: action('onClear'),
    onInfo: action('onInfo'),
  },
  render: (args) => <InputDateRangeHandlerTemplate {...args} />,
};
