import React, { ChangeEvent, useCallback, useState } from 'react';
import { action } from '@storybook/addon-actions';
import { Meta, StoryObj } from '@storybook/react';

import { Grid } from '@/index';

import { InputNumberRangeValue } from '../../InputRange.types';
import { InputNumberRange } from '../InputNumberRange';

const meta: Meta<typeof InputNumberRange> = {
  title: 'Molecules/Inputs/InputRanges/InputNumberRange/InputNumberRange',
  component: InputNumberRange,
  tags: ['autodocs'],
  argTypes: {
    dataTestId: { control: 'text' },
    disabled: { control: 'boolean' },
    isColoredBg: { control: 'boolean' },
    thousandSeparator: { control: 'boolean' },
    multiplier: { control: 'number' },
    value: {
      control: {
        from: 'string',
        to: 'string',
      },
    },
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
type Story = StoryObj<typeof InputNumberRange>;

const InputNumberRangeTemplate = (args) => {
  const [fromInputValue, setFromInputValue] = useState<number | null>(args.value.from);
  const [toInputValue, setToInputValue] = useState<number | null>(args.value.to);

  const onChange = useCallback(
    (inputValue: InputNumberRangeValue, _e?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      console.log('InputValue value stories:', inputValue);
      setFromInputValue(inputValue.from);
      setToInputValue(inputValue.to);
    },
    [],
  );

  const onClear = useCallback(({ from, to }: InputNumberRangeValue) => {
    setFromInputValue(from);
    setToInputValue(to);
    console.log('Clear');
  }, []);

  return (
    <Grid container spacing={8} alignItems={'center'}>
      <Grid item xs={12}>
        <InputNumberRange
          {...args}
          value={{ from: fromInputValue, to: toInputValue }}
          onChange={onChange}
          onClear={onClear}
        />
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
    name: 'amount',
    label: 'Диапазон суммы',
    dataTestId: 'stories',
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
    size: 'md',
    startAction: {
      iconName: 'Add',
      onStartAction: action('onStartAction'),
    },
    postfix: '$$$',
    thousandSeparator: true,
    validationOptions: undefined,
    viewType: undefined,
    value: {
      from: 666666.999999,
      to: 555555.777777,
    },
    onInfo: action('onInfo'),
    onChange: action('onChange'),
    onClear: action('onClear'),
  },
  render: (args) => <InputNumberRangeTemplate {...args} />,
};
