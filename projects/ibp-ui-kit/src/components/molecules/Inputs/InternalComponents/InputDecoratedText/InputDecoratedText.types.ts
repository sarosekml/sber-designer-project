import { ChangeEvent } from 'react';
import { BaseInputProps } from '../BaseInput/BaseInput.types';
import { InputDecorator } from './InputDecorator.types';

export interface InputDecoratedTextProps<TargetValue> extends Omit<BaseInputProps, 'onChange' | 'value'> {
  /**
   * Decorator to decorate text value view
   *  */
  decorator: InputDecorator<TargetValue>;
  /**
   * Handler and transfer for real value
   *  */
  onChange?: (value: TargetValue | null, e?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  value?: TargetValue | null;
}
