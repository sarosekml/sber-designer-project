import React, { memo } from 'react';
import { InputNumberProps } from './InputNumber.types';
import { useInputNumberDecorator } from './useInputNumberDecorator';
import { InputDecoratedText } from '../InternalComponents/InputDecoratedText/InputDecoratedText';

const root = 'InputNumber';

export const InputNumber = memo((props: InputNumberProps) => {
  const inputNumberDecorator = useInputNumberDecorator(props);

  return <InputDecoratedText {...props} decorator={inputNumberDecorator} />;
});

InputNumber.displayName = root;
