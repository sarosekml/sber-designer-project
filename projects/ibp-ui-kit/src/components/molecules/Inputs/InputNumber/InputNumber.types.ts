import { ChangeEvent } from 'react';
import { InputDecoratedTextProps } from '../InternalComponents/InputDecoratedText/InputDecoratedText.types';

export interface DigitsConfig {
  /**
   * Defines the minimal number of integer digits in the presented number
   * @default 0
   */
  minIntegerDigits?: number;
  /**
   * Defines the maximal  number of integer digits in the presented number
   * @default 12
   */
  maxIntegerDigits?: number;
  /**
   * Defines the minimal number of fraction digits in the presented number
   * @default 2
   */
  minFractionDigits?: number;
  /**
   * Defines the maximal number of fraction digits in the presented number
   * @default 6
   */
  maxFractionDigits?: number;
  /**
   * Defines the maximal number of all digits in the presented number
   * The maximum digits required in the JS = 18
   * @default 18
   */
  maxSymbols?: number;
}

export type FilledDigitsConfig = Required<DigitsConfig>;

export type InputNumberChangeCallback = (
  value: number | null,
  event?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
) => void;

export interface InputNumberProps
  extends DigitsConfig,
    Omit<
      InputDecoratedTextProps<number>,
      'value' | 'onChange' | 'multiline' | 'decorator' | 'rows' | 'minRows' | 'maxRows'
    > {
  /**
   * Provides a string to separate thousands in the number
   * if false - no thousands separation is applied
   * @default true
   */
  thousandSeparator?: boolean;
  /**
   * Multiplier value which we use to multiple user input value, and divide realValue
   * */
  multiplier?: number;
  /**
   * Value which we should to preparation
   * */
  value?: number | null;
  /**
   * Method to change value in input and for real working
   * */
  onChange?: InputNumberChangeCallback;
}
