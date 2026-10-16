import { ChangeEvent } from 'react';

import { IsoDate } from '@sber-ibp/core';

import { InputDateProps } from '../InputDate/InputDate.types';
import { InputNumberProps } from '../InputNumber/InputNumber.types';

export type ExcludeInputRangeProps = 'name' | 'value' | 'prefix' | 'onChange' | 'onClear';
export type ExcludeInputProps = 'name' | 'prefix' | 'onChange' | 'onClear';

export type RangeBasicType = number | string | null;
export interface FilterRange<Type extends RangeBasicType = RangeBasicType> {
  from: Type;
  to: Type;
}

/** InputNumberRange typings */
export type InputNumberRangeValue = FilterRange<number | null>;

export type InputNumberRangeChangeCallback = (
  value: InputNumberRangeValue,
  event?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
) => void;

export type InputNumberRangeProps = Omit<InputNumberProps, ExcludeInputRangeProps> & {
  value: InputNumberRangeValue;
  name: string;
  onChange?: (inputValue: InputNumberRangeValue) => void;
  onClear?: (inputValue: InputNumberRangeValue) => void;
};

export type OmittedInputNumberProps = Omit<InputNumberProps, ExcludeInputProps>;

/** InputDateRange typings */
export type InputDateRangeValue = FilterRange<IsoDate | null>;

export type InputDateRangeViewValue = {
  viewValueTo: string | null;
  viewValueFrom: string | null;
};

export type InputDateRangeChangeCallback = (
  value: InputDateRangeValue & InputDateRangeViewValue,
  event?: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
) => void;

export type InputDateRangeProps = Omit<InputDateProps, ExcludeInputRangeProps> & {
  value: InputDateRangeValue;
  name: string;
  onChange?: (inputValue: InputDateRangeValue & InputDateRangeViewValue) => void;
  onClear?: (inputValue: InputDateRangeValue) => void;
};

export type OmittedInputDateProps = Omit<InputDateProps, ExcludeInputProps>;
