import { IsoDate } from '@sber-ibp/core';

import { DataTestIdProps } from '@/types/common.types';

import { InputDecoratedTextProps } from '../InternalComponents/InputDecoratedText/InputDecoratedText.types';

export type InputDateLang = 'ru' | 'en';
export type InputDateView = 'month' | 'year';
export type DateLocaleType<T> = Record<InputDateLang, T>;

export type InputDateBaseType = Omit<
  InputDecoratedTextProps<string>,
  'value' | 'onChange' | 'multiline' | 'rows' | 'minRows' | 'maxRows' | 'decorator'
>;

export type InputDateChangeCallback = (date: IsoDate, viewValue: string | null) => void;

export interface InputDateProps extends InputDateBaseType, DataTestIdProps {
  value?: string | null;
  locale?: InputDateLang;
  view?: InputDateView;
  onChange?: InputDateChangeCallback;
  strictCheck?: boolean;
}

export type RegexpYearType = 'startYear' | 'endYear';
