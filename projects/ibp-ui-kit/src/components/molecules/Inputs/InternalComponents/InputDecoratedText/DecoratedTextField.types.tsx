import { ChangeEvent } from 'react';
import { TextFieldProps } from '@mui/material';

import { InputDecorator } from './InputDecorator.types';

export type OnChangeDecoratedCallback<TargetValue> = (
  value: TargetValue | null,
  e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
) => void;

export interface DecoratedTextFieldProps<TargetValue> extends Omit<TextFieldProps, 'value' | 'onChange'> {
  /**
   * Decorator to decorate text value view
   *  */
  onChange?: OnChangeDecoratedCallback<TargetValue>;
  decorator: InputDecorator<TargetValue>;
  value?: TargetValue | null;
}
