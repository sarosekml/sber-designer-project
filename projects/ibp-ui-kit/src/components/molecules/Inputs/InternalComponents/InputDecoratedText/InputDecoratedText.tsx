import React, { ChangeEvent, memo, useCallback, useEffect, useState } from 'react';

import { emptyString } from '@sber-ibp/core';

import { BaseInput } from '../BaseInput/BaseInput';

import { InputDecoratedTextProps } from './InputDecoratedText.types';
import { DecoratedValue } from './InputDecorator.types';

const root = 'InputDecoratedText';

export const InputDecoratedTextComponent = <TargetValue,>({
  decorator,
  onChange,
  value,
  ...props
}: InputDecoratedTextProps<TargetValue>) => {
  const [decoratedValueLocal, setDecoratedValueLocal] = useState<DecoratedValue>(
    decorator.externalValueToDecorated(value ?? null),
  );

  useEffect(() => {
    setDecoratedValueLocal(decorator.externalValueToDecorated(value ?? null));
  }, [value, decorator]);

  const onChangeCallback = useCallback(
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
      onChange?.(realValue, e);
    },
    [decorator, onChange],
  );

  return <BaseInput {...props} value={decoratedValueLocal ?? emptyString} onChange={onChangeCallback} />;
};

InputDecoratedTextComponent.displayName = root;
export const InputDecoratedText = memo(InputDecoratedTextComponent) as typeof InputDecoratedTextComponent;
