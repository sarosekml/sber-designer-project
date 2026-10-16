import React, { memo, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';

import { useInputHandlerController } from '../../FormHandler';
import { InputDateRangeChangeCallback, InputDateRangeProps, InputDateRangeValue } from '../InputRange.types';

import { InputDateRange } from './InputDateRange';

const root = 'InputDateRangeFormHandler';

const defaultInputDateRangeValue: InputDateRangeValue = {
  from: null,
  to: null,
};

export interface InputDateRangeFormHandlerProps extends Omit<InputDateRangeProps, 'onChange' | 'onClear' | 'value'> {
  name: string;
  onChange?: InputDateRangeChangeCallback;
  onClear?: (inputValue: InputDateRangeValue) => void;
}

export const InputDateRangeFormHandler = memo(
  ({ name, onChange, onClear, ...props }: InputDateRangeFormHandlerProps) => {
    const { control } = useFormContext();

    const {
      field: { onChange: onChangeForm, value },
      validationOptions,
    } = useInputHandlerController({ control, name });

    const onChangeCallback = useCallback(
      (value) => {
        const { from, to, viewValueFrom, viewValueTo } = value;

        const isFinalValueFrom = (!from && !viewValueFrom) || (from && viewValueFrom);
        const isFinalValueTo = (!to && !viewValueTo) || (to && viewValueTo);
        if (isFinalValueFrom && isFinalValueTo) {
          onChangeForm?.({ from, to });
        }
        onChange?.(value);
      },
      [onChangeForm, onChange],
    );

    const onClearCallback = useCallback(
      (value: InputDateRangeValue) => {
        onChangeForm?.(value);
        onClear?.(value);
      },
      [name, onChangeForm, onClear],
    );

    return (
      <InputDateRange
        {...props}
        name={name}
        value={value ?? defaultInputDateRangeValue}
        onChange={onChangeCallback}
        onClear={onClearCallback}
        dataTestId={root + '_' + name}
        validationOptions={validationOptions}
      />
    );
  },
);

InputDateRangeFormHandler.displayName = root;
