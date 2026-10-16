import React, { memo, useCallback } from 'react';

import {
  mergeWithFormProps,
  useFormContext,
  useInputHandlerController,
} from '@/components/molecules/Inputs/FormHandler';

import { InputCheckbox } from './InputCheckbox';
import { InputCheckboxChangeCallback, InputCheckboxProps } from './InputCheckbox.types';

export interface InputCheckboxFormHandlerProps extends Omit<InputCheckboxProps, 'onChange' | 'checked'> {
  name: string;
  onChange?: InputCheckboxChangeCallback;
}

const root = 'InputCheckboxFormHandler';

export const InputCheckboxFormHandler = memo(({ name, onChange, ...props }: InputCheckboxFormHandlerProps) => {
  const { control } = useFormContext();
  const {
    field: { onChange: onChangeForm, value },
    inputProps,
  } = useInputHandlerController({ control, name });
  const completeProps = mergeWithFormProps(inputProps, props);

  const onChangeCallback: InputCheckboxChangeCallback = useCallback(
    (checked, _event) => {
      onChangeForm?.(checked);
      onChange?.(checked);
    },
    [onChangeForm, onChange],
  );

  return (
    <InputCheckbox
      {...completeProps}
      name={name}
      onChange={onChangeCallback}
      checked={value}
      dataTestId={root + '_' + name}
    />
  );
});

InputCheckboxFormHandler.displayName = root;
