import React, { memo, useCallback } from 'react';

import { mergeWithFormProps, useFormContext, useInputHandlerController } from '../FormHandler';

import { InputAutocomplete } from './InputAutocomplete';
import { InputAutocompleteChangeCallback, InputAutocompleteProps } from './InputAutocomplete.types';

export interface InputAutocompleteFormHandlerProps<T, Multiple extends boolean>
  extends Omit<InputAutocompleteProps<T, Multiple>, 'value'> {
  name: string;
}

const root = 'InputAutocompleteFormHandler';

const InputAutocompleteFormHandlerComponent = <T, Multiple extends boolean>({
  name,
  onChange: onChangeCallback,
  ...props
}: InputAutocompleteFormHandlerProps<T, Multiple>) => {
  const { control } = useFormContext();
  const {
    field: { onChange: onChangeForm, value },
    validationOptions,
    inputProps,
  } = useInputHandlerController({ control, name });
  const completeProps = mergeWithFormProps(inputProps, props);

  const onChange: InputAutocompleteChangeCallback<T, Multiple> = useCallback(
    (newValue, _event) => {
      onChangeForm?.(newValue);
      onChangeCallback?.(newValue);
    },
    [onChangeForm, onChangeCallback],
  );

  return (
    <InputAutocomplete
      {...completeProps}
      name={name}
      onChange={onChange}
      value={value}
      dataTestId={root + '_' + name}
      validationOptions={validationOptions}
    />
  );
};

InputAutocompleteFormHandlerComponent.displayName = root;
export const InputAutocompleteFormHandler = memo(
  InputAutocompleteFormHandlerComponent,
) as typeof InputAutocompleteFormHandlerComponent;
