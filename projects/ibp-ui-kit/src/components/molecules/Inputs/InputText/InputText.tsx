import React, { memo, useMemo } from 'react';
import { InputTextProps } from './InputText.types';
import { getInputTextDecorator } from './InputTextDecorator/InputTextDecorator';
import { InputDecoratedText } from '../InternalComponents/InputDecoratedText/InputDecoratedText';

const root = 'InputText';

export const InputText = memo(({ multiline, ...props }: InputTextProps) => {
  const inputTextDecorator = useMemo(() => getInputTextDecorator({ multiline }), [multiline]);

  return <InputDecoratedText {...props} decorator={inputTextDecorator} multiline={multiline} />;
});

InputText.displayName = root;
