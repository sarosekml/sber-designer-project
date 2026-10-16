import React, { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Grid } from '@mui/material';
import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { SubmitButton } from '@/components/atoms';

import { FormHandler } from '../../../FormHandler';
import { InputNumberRangeValue } from '../../InputRange.types';
import { InputNumberRangeFormHandler } from '../InputNumberRange.handler';

const meta: Meta<typeof InputNumberRangeFormHandler> = {
  title: 'Molecules/Inputs/InputRanges/InputNumberRange/InputNumberRangeFormHandler',
  component: InputNumberRangeFormHandler,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    isColoredBg: { control: 'boolean' },
    size: {
      options: ['sm', 'md', 'lg'],
      control: { type: 'radio' },
    },
    viewType: {
      options: ['read', 'edit', 'present'],
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
type Story = StoryObj<typeof InputNumberRangeFormHandler>;

interface FormData {
  amount: {
    from: number | null;
    to: number | null;
  };
}

const InputNumberRangeHandlerTemplate = (args) => {
  const methods = useForm<FormData>({
    defaultValues: {
      amount: {
        from: 1000,
        to: 5000,
      },
    },
  });

  const onClear = useCallback(
    (value: InputNumberRangeValue) => {
      console.log(value);
      methods.setValue('amount', value);
    },
    [methods],
  );

  const onSubmit = useCallback((formData: FormData) => {
    console.log('Get a submit');
    console.log('form data:', formData);
  }, []);

  return (
    <Grid container spacing={4} alignItems={'center'}>
      <Grid item xs={12}>
        <FormHandler dataTestId="testForm" methods={methods} formId={'InputNumberRange'} onSubmit={onSubmit}>
          <InputNumberRangeFormHandler {...args} onClear={onClear} />
          <InputNumberRangeFormHandler {...args} onClear={onClear} />
        </FormHandler>
      </Grid>
      <Grid item xs={3}>
        <SubmitButton formId="InputNumberRange">Submit</SubmitButton>
      </Grid>
      <Grid item xs={12}>
        <Grid item xs={6}>
          Real Min value: {methods.watch('amount')?.from}
        </Grid>
        <Grid item xs={6}>
          Real Max value: {methods.watch('amount')?.to}
        </Grid>
      </Grid>
    </Grid>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение InputNumberRangeFormHandler',
      },
    },
  },
  args: {
    name: 'amount',
    label: 'Диапазон суммы',
    disabled: false,
    helperText: 'Работаем с числами',
    infoOptions: {
      tooltipValue: 'Информация о числах',
    },
    isColoredBg: false,
    labelOptions: {
      tooltipValue: 'Описание смысла этого полей ввода',
    },
    maxFractionDigits: 6,
    maxIntegerDigits: 10,
    maxSymbols: 18,
    minFractionDigits: 2,
    minIntegerDigits: 0,
    multiplier: 0,
    postfix: '$$$',
    size: 'md',
    startAction: {
      iconName: 'Add',
      onStartAction: () => console.log('StartAction'),
    },
    thousandSeparator: true,
    validationOptions: undefined,
    viewType: undefined,
    onInfo: action('onInfo'),
    onChange: action('onChange'),
    onClear: action('onClear'),
  },
  render: (args) => <InputNumberRangeHandlerTemplate {...args} />,
};
