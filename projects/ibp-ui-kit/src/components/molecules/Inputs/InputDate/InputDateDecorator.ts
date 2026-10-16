import { IsoDate } from '@sber-ibp/core';

import {
  DecoratedValue,
  InputDecorator,
  RawValue,
} from '../InternalComponents/InputDecoratedText/InputDecorator.types';

import { convertLocalDateToIso, isCorrectFormat, isoDateToViewString } from './InputDateUtils/InputDate.utils';
import { calculateInputRegexp } from './InputDateUtils/InputDateRegexp.utils';
import { inputSeparator } from './InputDate.const';
import { InputDateLang, InputDateView } from './InputDate.types';

const getClearPosition = (rawValue: RawValue, selection: number) => {
  return rawValue?.substring(0, selection).replaceAll(/\D/gi, '').length ?? 0;
};

const rawValueToDecoratedSimple = (value: RawValue, separator: string): DecoratedValue => {
  if (!value) return null;
  const cleanValue = value.replaceAll(/\D/gi, '').substring(0, 8);

  return [cleanValue.substring(0, 2), cleanValue.substring(2, 4), cleanValue.substring(4, 8)]
    .filter(Boolean)
    .join(separator);
};

const rawValueToDecoratedFull = (value: RawValue, separator: string): DecoratedValue => {
  if (!value) return null;
  const cleanValue = value.replaceAll(/\D/gi, '').substring(0, 8);

  const replaceCb = (match, day, month, year) => {
    if (!match) return '';
    if (month.length === 2) return [day, month, year].join(separator);
    if (day.length === 2) return [day, month].join(separator);
    return day;
  };

  return cleanValue.replace(calculateInputRegexp(), replaceCb);
};

export const getInputDateDecorator = (
  locale: InputDateLang,
  view?: InputDateView,
  strictCheck?: boolean,
): InputDecorator<IsoDate> => {
  const separator = inputSeparator[locale];

  return {
    calcNewCursorPosition: (value: DecoratedValue, rawValue: RawValue, selection: number): number => {
      const clearPosition = getClearPosition(rawValue, selection);
      return clearPosition + (clearPosition > 2 ? 1 : 0) + (clearPosition > 4 ? 1 : 0);
    },

    valueFromDecorated: (value: DecoratedValue): IsoDate | null => {
      if (!value) return null;
      return convertLocalDateToIso(value, locale);
    },

    rawValueToDecorated: (value: RawValue): DecoratedValue => {
      return strictCheck ? rawValueToDecoratedFull(value, separator) : rawValueToDecoratedSimple(value, separator);
    },

    externalValueToDecorated: (value: IsoDate | null): DecoratedValue => {
      if (!value) return null;
      if (isCorrectFormat(value, 'iso')) {
        return isoDateToViewString(value, locale, view);
      }
      return value;
    },
  };
};
