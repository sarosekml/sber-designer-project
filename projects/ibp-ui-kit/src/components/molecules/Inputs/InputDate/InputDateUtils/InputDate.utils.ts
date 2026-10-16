import { format, isValid, parse } from 'date-fns';

import { IsoDate } from '@sber-ibp/core';

import {
  dayRegexp,
  inputSeparator,
  isoDateFormat,
  isoSeparator,
  localeMap,
  monthRegexp,
  yearInterval,
} from '../InputDate.const';
import { InputDateLang, InputDateView } from '../InputDate.types';

import { calculateYearRegexp } from './InputDateRegexp.utils';

export const getValidationRegexp = (format: InputDateLang | 'iso') => {
  const yearRegexp = calculateYearRegexp();
  if (format === 'iso') return new RegExp([yearRegexp, monthRegexp, dayRegexp].join(isoSeparator), '');
  const separator = inputSeparator[format];
  return new RegExp([dayRegexp, monthRegexp, yearRegexp].join(separator), '');
};

export const getFormatString = (locale: InputDateLang, view?: InputDateView, returnMonthNumber = false) => {
  const separator = inputSeparator[locale];
  switch (view) {
    case 'month':
      return returnMonthNumber ? 'MM' : 'LLLL';
    case 'year':
      return 'yyyy';
    default:
      return `dd${separator}MM${separator}yyyy`;
  }
};

export const isCorrectFormat = (rawDate: string | null, format: InputDateLang | 'iso'): rawDate is IsoDate => {
  if (!rawDate) return false;
  const validationRegexp = getValidationRegexp(format);
  return validationRegexp.test(rawDate);
};

export const dateToIsoDate = (date: Date): IsoDate => {
  return format(date, isoDateFormat) as IsoDate;
};

export const capitalizeFirstChar = (str: string): string => str[0].toUpperCase() + str.slice(1);

export const dateToViewString = (
  dateValue: Date,
  locale: InputDateLang,
  view?: InputDateView,
  returnMonthNumber = false,
): string => {
  const formatStr = getFormatString(locale, view, returnMonthNumber);
  const formatLocal = localeMap[locale];
  return capitalizeFirstChar(format(dateValue, formatStr, { locale: formatLocal }));
};

export const isoDateToViewString = (isoDate: IsoDate, locale: InputDateLang, view?: InputDateView) => {
  const date = parse(isoDate, isoDateFormat, new Date());
  if (!isValid(date)) return isoDate;
  return dateToViewString(date, locale, view);
};

export const convertLocalDateToIso = (value: string | null, locale: InputDateLang): IsoDate | null => {
  if (!value) return null;
  const dateIsCorrect = isCorrectFormat(value, locale);
  if (!dateIsCorrect) return null;
  const formatLocal = localeMap[locale];
  const dateFormat = getFormatString(locale);
  const date = parse(value, dateFormat, new Date());
  if (!isValid(date)) return null;
  return format(date, isoDateFormat, { locale: formatLocal }) as IsoDate;
};

export const calculateYearInterval = () => {
  const d = new Date();
  const year = d.getFullYear();

  const minDate = new Date(`${year - yearInterval}-01-01`);
  const maxDate = new Date(`${year + yearInterval}-12-31`);
  return [minDate, maxDate];
};

export const convertStringToIsoDate = (value?: string | null): IsoDate | null => {
  if (!value) return null;
  let isoDate: IsoDate | null = null;
  try {
    isoDate = convertLocalDateToIso(value, 'ru');
    if (isoDate) return isoDate;

    isoDate = convertLocalDateToIso(value, 'en');
    if (isoDate) return isoDate;

    isoDate = format(new Date(value), isoDateFormat) as IsoDate;
    return isoDate;
  } catch {
    return null;
  }
};
