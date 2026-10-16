import React, { memo, useCallback } from 'react';

import {
  mergeWithFormProps,
  useFormContext,
  useInputHandlerController,
} from '@/components/molecules/Inputs/FormHandler';

import { InputNumber } from './InputNumber';
import { InputNumberChangeCallback, InputNumberProps } from './InputNumber.types';

export interface InputNumberFormHandlerProps extends Omit<InputNumberProps, 'value' | 'onChange'> {
  name: string;
  onChange?: InputNumberChangeCallback;
}

const root = 'InputNumberFormHandler';

export const InputNumberFormHandler = memo(({ name, onClear, onChange, ...props }: InputNumberFormHandlerProps) => {
  const { control } = useFormContext();
  const {
    field: { onChange: onChangeForm, value },
    inputProps,
    validationOptions,
  } = useInputHandlerController({ control, name });
  const completeProps = mergeWithFormProps(inputProps, props);

  const clearCallback = useCallback(() => {
    onChangeForm?.(null);
    onClear?.();
  }, [name, onChangeForm, onClear]);

  const onChangeCallback: InputNumberChangeCallback = useCallback(
    (value, _event) => {
      onChangeForm?.(value);
      onChange?.(value);
    },
    [onChangeForm, onChange],
  );

  return (
    <InputNumber
      {...completeProps}
      name={name}
      onChange={onChangeCallback}
      value={value ?? null}
      onClear={clearCallback}
      dataTestId={root + '_' + name}
      validationOptions={validationOptions}
    />
  );
});

InputNumberFormHandler.displayName = root;
