import { ChangeEvent } from 'react';
import { InputDecoratedTextProps } from '../InternalComponents/InputDecoratedText/InputDecoratedText.types';

export type InputTextChangeCallback = (
  value: string | null,
  event?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
) => void;

export interface InputTextProps extends Omit<InputDecoratedTextProps<string>, 'onChange' | 'decorator' | 'value'> {
  onChange?: InputTextChangeCallback;
  value?: string | null;
}

export interface InputTextDecoratorOptions {
  multiline?: boolean;
}

export interface EventDataInitializeParams {
  rawValue: string;
  decoratedValue: string;
  selection: number;
}
