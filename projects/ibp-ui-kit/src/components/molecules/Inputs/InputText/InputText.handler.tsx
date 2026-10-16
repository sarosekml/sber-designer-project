import React, { memo, useCallback } from 'react';

import {
  mergeWithFormProps,
  useFormContext,
  useInputHandlerController,
} from '@/components/molecules/Inputs/FormHandler';

import { InputText } from './InputText';
import { InputTextChangeCallback, InputTextProps } from './InputText.types';

export interface InputTextFormHandlerProps extends Omit<InputTextProps, 'value' | 'onChange'> {
  name: string;
  onChange?: InputTextChangeCallback;
}

const root = 'InputTextFormHandler';

export const InputTextFormHandler = memo(({ name, onClear, onChange, ...props }: InputTextFormHandlerProps) => {
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
  }, [name, onClear, onChangeForm]);

  const onChangeCallback: InputTextChangeCallback = useCallback(
    (value, _event) => {
      onChangeForm?.(value);
      onChange?.(value);
    },
    [onChangeForm, onChange],
  );

  return (
    <InputText
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

InputTextFormHandler.displayName = root;
