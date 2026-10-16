import { FilledDigitsConfig } from '../InputNumber.types';

export interface NormalizeNumberResultType {
  isNegative: boolean;
  fractionPart: string;
  /**
   * Attribute of the string ending with ","
   * */
  endsWithSeparator: boolean;
  integerPart: string;
  /**
   * Value with only required numeric format from regex /[^,0-9]/g
   * */
  normalizedValue: string;
  /**
   * Value which you can convert to Number(normalizedNumericValue) without additional handling
   * */
  normalizedNumericValue: string;
}

export interface InputNumberDecoratorType {
  /**
   * Borders for min and max of digits in the value
   *  */
  digitsConfig: FilledDigitsConfig;
  thousandSeparator: boolean;
  multiplier: number;
}
