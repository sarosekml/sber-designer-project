import React, { ChangeEvent, memo, useCallback, useEffect, useMemo, useState } from 'react';
import { TextField } from '@mui/material';

import { emptyString } from '@sber-ibp/core';

import { DecoratedTextFieldProps, OnChangeDecoratedCallback } from './DecoratedTextField.types';
import { DecoratedValue } from './InputDecorator.types';

const root = 'InputDecoratedText';

export const DecoratedTextFieldComponent = <TargetValue,>({
  decorator,
  onChange: onCustomChangeCallback,
  value,
  inputProps: rawInputProps,
  InputProps: RawInputProps,
  ...props
}: DecoratedTextFieldProps<TargetValue>) => {
  const [decoratedValueLocal, setDecoratedValueLocal] = useState<DecoratedValue>(
    decorator.externalValueToDecorated(value ?? null),
  );

  useEffect(() => {
    setDecoratedValueLocal(decorator.externalValueToDecorated(value ?? null));
  }, [value, decorator]);

  const prepareOnChange = useCallback(
    (onChangeCallback?: OnChangeDecoratedCallback<TargetValue>) =>
      (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const rawValue = e.target.value;
        const selectionStart = e.target.selectionStart;

        if (selectionStart === null || selectionStart === undefined) return;

        const decoratedValue = decorator.rawValueToDecorated(rawValue, selectionStart);
        const selection = decorator.calcNewCursorPosition(decoratedValue, rawValue, selectionStart);
        const realValue = decorator.valueFromDecorated(decoratedValue);

        setDecoratedValueLocal(decoratedValue);

        e.target.value = decoratedValue ?? emptyString;
        e.target.setSelectionRange(selection, selection);
        onChangeCallback?.(realValue, e);
      },
    [decorator],
  );

  const onChange = useMemo(() => prepareOnChange(onCustomChangeCallback), [prepareOnChange, onCustomChangeCallback]);

  const InputProps = useMemo(
    () =>
      RawInputProps
        ? {
            ...RawInputProps,
            onChange: RawInputProps?.onChange
              ? prepareOnChange((value, e) => {
                  RawInputProps.onChange?.(e);
                  onCustomChangeCallback?.(value, e);
                })
              : undefined,
          }
        : undefined,
    [RawInputProps, prepareOnChange, onCustomChangeCallback],
  );

  const inputProps = useMemo(
    () =>
      rawInputProps
        ? {
            ...rawInputProps,
            onChange: rawInputProps?.onChange
              ? prepareOnChange((value, e) => {
                  rawInputProps.onChange?.(e);
                  onCustomChangeCallback?.(value, e);
                })
              : undefined,
          }
        : undefined,
    [rawInputProps, prepareOnChange, onCustomChangeCallback],
  );

  return (
    <TextField
      {...props}
      InputProps={InputProps}
      inputProps={inputProps}
      value={decoratedValueLocal ?? emptyString}
      onChange={onChange}
    />
  );
};

DecoratedTextFieldComponent.displayName = root;
export const DecoratedTextField = memo(DecoratedTextFieldComponent) as typeof DecoratedTextFieldComponent;
