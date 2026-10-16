import React, { memo, useCallback } from 'react';

import {
  mergeWithFormProps,
  useFormContext,
  useInputHandlerController,
} from '@/components/molecules/Inputs/FormHandler';

import { InputRadioGroup } from './InputRadioGroup';
import { InputRadioGroupProps } from './InputRadioGroup.types';

export interface InputRadioGroupFormHandlerProps extends Omit<InputRadioGroupProps, 'value' | 'defaultValue'> {
  name: string;
}

const root = 'InputRadioGroupFormHandler';

export const InputRadioGroupFormHandler = memo(({ name, onChange, ...props }: InputRadioGroupFormHandlerProps) => {
  const { control } = useFormContext();
  const {
    field: { onChange: onChangeForm, value },
    inputProps,
  } = useInputHandlerController({ control, name });
  const completeProps = mergeWithFormProps(inputProps, props);

  const onChangeCallback: (value: string) => void = useCallback(
    (value) => {
      onChangeForm?.(value);
      onChange?.(value);
    },
    [onChangeForm, onChange],
  );

  return <InputRadioGroup {...completeProps} name={name} onChange={onChangeCallback} value={value} />;
});

InputRadioGroupFormHandler.displayName = root;
