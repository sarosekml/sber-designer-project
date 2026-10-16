import React, { memo, useCallback } from 'react';

import { useFormContext, useInputHandlerController } from '@/components/molecules/Inputs/FormHandler';

import { InputNumberRangeChangeCallback, InputNumberRangeProps, InputNumberRangeValue } from '../InputRange.types';

import { InputNumberRange } from './InputNumberRange';

export interface InputNumberRangeFormHandlerProps
  extends Omit<InputNumberRangeProps, 'onChange' | 'onClear' | 'value'> {
  name: string;
  onChange?: InputNumberRangeChangeCallback;
  onClear?: (inputValue: InputNumberRangeValue) => void;
}

const root = 'InputNumberRangeFormHandler';

const defaultNumberRangeValue: InputNumberRangeValue = {
  from: null,
  to: null,
};

export const InputNumberRangeFormHandler = memo(
  ({ name, onChange, onClear, ...props }: InputNumberRangeFormHandlerProps) => {
    const { control } = useFormContext();

    const {
      field: { onChange: onChangeForm, value },
      validationOptions,
    } = useInputHandlerController({ control, name });

    const onChangeCallback: InputNumberRangeChangeCallback = useCallback(
      (value, _event) => {
        onChangeForm?.(value);
        onChange?.(value);
      },
      [onChange, onChangeForm],
    );

    const onClearCallback = useCallback(
      (value: InputNumberRangeValue) => {
        onChangeForm?.(value);
        onClear?.(value);
      },
      [name, onClear, onChangeForm],
    );

    return (
      <InputNumberRange
        {...props}
        name={name}
        value={value ?? defaultNumberRangeValue}
        onChange={onChangeCallback}
        onClear={onClearCallback}
        dataTestId={root + '_' + name}
        validationOptions={validationOptions}
      />
    );
  },
);

InputNumberRangeFormHandler.displayName = root;
