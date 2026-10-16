import { Locale } from 'date-fns';
import buildLocalizeFn from 'date-fns/locale/_lib/buildLocalizeFn';
import enLocale from 'date-fns/locale/en-US';
import baseRuLocale from 'date-fns/locale/ru';
import localize from 'date-fns/locale/ru/_lib/localize';

import { DateLocaleType } from './InputDate.types';

const monthValues = {
  narrow: ['Я', 'Ф', 'М', 'А', 'М', 'И', 'И', 'А', 'С', 'О', 'Н', 'Д'],
  abbreviated: ['янв.', 'февр.', 'март', 'апр.', 'май', 'июнь', 'июль', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'],
  wide: [
    'январь',
    'февраль',
    'март',
    'апрель',
    'май',
    'июнь',
    'июль',
    'август',
    'сентябрь',
    'октябрь',
    'ноябрь',
    'декабрь',
  ],
};

const ruLocale: Locale = {
  ...baseRuLocale,
  localize: {
    ...localize,
    month: buildLocalizeFn({
      values: monthValues,
      defaultWidth: 'wide',
      defaultFormattingWidth: 'wide',
    }),
  },
};

export const localeMap: DateLocaleType<Locale> = {
  en: enLocale,
  ru: ruLocale,
};

export const datePlaceholder: DateLocaleType<string> = {
  en: 'MM/DD/YYYY',
  ru: 'ДД.ММ.ГГГГ',
};

export const incorrectDateMessageText: DateLocaleType<string> = {
  en: 'The date is incorrect. Date format is `MM/DD/YYYY`.',
  ru: 'Некорректная дата. Формат даты: `ДД.ММ.ГГГГ`.',
};

export const inputSeparator: DateLocaleType<string> = {
  en: '/',
  ru: '.',
};

export const isoDateFormat = 'yyyy-MM-dd';
export const isoSeparator = '-';

/**
 *  Must be a multiple of 100
 */
export const yearInterval = 100;

export const dayRegexp = '(0[1-9]|[12][0-9]|3[01])';
export const monthRegexp = '(0[1-9]|1[0-2])';

/**
 *  Unused variables are necessary if using a calculated regular expression turns out to be problematic
 */
export const defaultYearRegexp = '((19|20)[0-9][0-9])';
export const defaultInputDateRegexp =
  /(0[1-9]|[12][0-9]|3[01]|[0-3]{0,1})(0[1-9]|1[0-2]|[0-1]{0,1})((19|20)[0-9][0-9]|(19|20)[0-9]|(19|20)|[12]{0,1})((\d|\w|\D){0,1})/;
