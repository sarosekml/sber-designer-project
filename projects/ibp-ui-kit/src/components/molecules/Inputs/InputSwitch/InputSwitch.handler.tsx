import { mergeWithFormProps, useFormContext, useInputHandlerController } from '../FormHandler';
import React, { memo, useCallback } from 'react';
import { InputSwitch } from './InputSwitch';
import { InputSwitchChangeCallback, InputSwitchProps } from './InputSwitch.types';

export interface InputSwitchFormHandlerProps extends Omit<InputSwitchProps, 'onChange' | 'checked'> {
  name: string;
  onChange?: InputSwitchChangeCallback;
}

const root = 'InputSwitchFormHandler';

export const InputSwitchFormHandler = memo(({ name, onChange, ...props }: InputSwitchFormHandlerProps) => {
  const { control } = useFormContext();
  const {
    field: { onChange: onChangeForm, value },
    inputProps,
  } = useInputHandlerController({ control, name });
  const completeProps = mergeWithFormProps(inputProps, props);

  const onChangeCallback: InputSwitchChangeCallback = useCallback(
    (checked, _event) => {
      onChangeForm?.(checked);
      onChange?.(checked);
    },
    [onChangeForm, onChange],
  );

  return (
    <InputSwitch {...completeProps} name={name} onChange={onChangeCallback} checked={value} dataTestId={root + name} />
  );
});

InputSwitchFormHandler.displayName = root;
