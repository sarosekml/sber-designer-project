import React, { ChangeEvent, useCallback, useState } from 'react';
import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { Grid } from '@/index';

import { InputNumber } from '../InputNumber';

const meta: Meta<typeof InputNumber> = {
  title: 'Molecules/Inputs/InputNumber/InputNumber',
  component: InputNumber,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    disabled: { control: 'boolean' },
    isColoredBg: { control: 'boolean' },
    thousandSeparator: { control: 'boolean' },
    multiplier: { control: 'number' },
    value: { control: 'number' },
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
  },
};

export default meta;
type Story = StoryObj<typeof InputNumber>;

const InputNumberTemplate = (args) => {
  const [value, setValue] = useState<number | null | undefined>(args.value);

  const onChange = useCallback(
    (numberValue: number | null, _e?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      console.log('Real value to upper wrapper:', numberValue);
      setValue(numberValue);
    },
    [setValue],
  );

  return (
    <Grid container spacing={4} alignItems={'center'}>
      <Grid item xs={6}>
        <InputNumber {...args} onChange={onChange} value={value} />
      </Grid>
      <Grid item xs={6}>
        Real value: {value}
      </Grid>
    </Grid>
  );
};

export const Main: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Основное отображение InputNumber',
      },
    },
  },
  args: {
    label: 'Сумма',
    name: 'amount',
    value: 666666.999999,
    dataTestId: 'amount',
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
    startAction: {
      iconName: 'Add',
      onStartAction: action('onStartAction'),
    },
    thousandSeparator: true,
    validationOptions: undefined,
    viewType: undefined,
    placeholder: 'placeholder text',
    onClear: action('onClear'),
    onInfo: action('onInfo'),
    onChange: action('onChange'),
  },
  render: (args) => <InputNumberTemplate {...args} />,
};
