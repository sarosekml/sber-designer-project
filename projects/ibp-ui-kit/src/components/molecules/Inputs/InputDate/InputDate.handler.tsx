import React, { memo, useCallback } from 'react';

import {
  mergeWithFormProps,
  useFormContext,
  useInputHandlerController,
} from '@/components/molecules/Inputs/FormHandler';

import { InputDate } from './InputDate';
import { InputDateChangeCallback, InputDateProps } from './InputDate.types';

export interface InputDateFormHandlerProps extends Omit<InputDateProps, 'onChange' | 'value'> {
  name: string;
  onChange?: InputDateChangeCallback;
}

const root = 'InputDateFormHandler';

export const InputDateFormHandler = memo(({ name, onClear, onChange, ...props }: InputDateFormHandlerProps) => {
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
  }, [onChangeForm, onClear]);

  const onChangeCallback: InputDateChangeCallback = useCallback(
    (value, viewValue) => {
      const isFinalValue = (!value && !viewValue) || (value && viewValue);
      if (isFinalValue) {
        onChangeForm?.(value);
      }
      onChange?.(value, viewValue);
    },
    [onChangeForm, onChange],
  );

  return (
    <InputDate
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

InputDateFormHandler.displayName = root;
