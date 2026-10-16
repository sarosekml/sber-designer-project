import React, { useCallback } from 'react';
import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { Grid } from '@/components/atoms';
import { SubmitButton } from '@/components/atoms/buttons';
import { FormHandler, useForm } from '@/components/molecules/Inputs/FormHandler';

import { InputNumberFormHandler } from '../InputNumber.handler';

const meta: Meta<typeof InputNumberFormHandler> = {
  title: 'Molecules/Inputs/InputNumber/InputNumberFormHandler',
  component: InputNumberFormHandler,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    disabled: { control: 'boolean' },
    isColoredBg: { control: 'boolean' },
    thousandSeparator: { control: 'boolean' },
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
    placeholder: { control: 'text' },
    maxFractionDigits: { control: 'number' },
    maxIntegerDigits: { control: 'number' },
    maxSymbols: { control: 'number' },
    minFractionDigits: { control: 'number' },
    minIntegerDigits: { control: 'number' },
    prefix: { control: 'text' },
    postfix: { control: 'text' },
    textColor: { control: 'text' },

    sx: { table: { disable: true } },
    autoFocus: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof InputNumberFormHandler>;

interface FormData {
  amount: number | null;
}

const InputNumberHandlerTemplate = (args) => {
  const methods = useForm<FormData>();

  const onClear = useCallback(() => {
    methods.setValue('amount', null);
  }, [methods]);

  const onSubmit = useCallback((formData: FormData) => {
    console.log('Get a submit');
    console.log('form data:', formData);
  }, []);

  return (
    <Grid container spacing={4} alignItems={'center'}>
      <Grid item xs={12}>
        <FormHandler dataTestId="testForm" methods={methods} formId={'InputNumber'} onSubmit={onSubmit}>
          <InputNumberFormHandler {...args} onClear={onClear} />
        </FormHandler>
      </Grid>
      <Grid item xs={3}>
        <SubmitButton formId="InputNumber">Submit</SubmitButton>
      </Grid>
      <Grid item xs={12}>
        Real value: {methods.watch('amount')}
      </Grid>
    </Grid>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение InputNumberFormHandler',
      },
    },
  },
  args: {
    label: 'Сумма',
    name: 'amount',
    disabled: false,
    helperText: 'Работаем с числом',
    infoOptions: {
      tooltipValue: 'Информация о числе',
    },
    isColoredBg: false,
    labelOptions: {
      tooltipValue: 'Описание смысла этого поля ввода',
    },
    maxFractionDigits: 6,
    maxIntegerDigits: 10,
    maxSymbols: 18,
    minFractionDigits: 2,
    minIntegerDigits: 0,
    multiplier: 0,
    postfix: '$$$',
    prefix: '&&&',
    size: 'md',
    startAction: undefined,
    thousandSeparator: true,
    validationOptions: undefined,
    viewType: undefined,
    placeholder: 'placeholder text',
    onClear: action('onClear'),
    onInfo: action('onInfo'),
    onChange: action('onChange'),
  },
  render: (args) => <InputNumberHandlerTemplate {...args} />,
};
