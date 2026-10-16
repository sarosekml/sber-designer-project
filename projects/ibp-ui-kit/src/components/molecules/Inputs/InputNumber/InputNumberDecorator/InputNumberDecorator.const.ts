import { escapeRegExp } from '@sber-ibp/core';

import { FilledDigitsConfig } from '../InputNumber.types';

export const jsFractionSeparator = '.';
export const uiFractionSeparator = ',';
export const negativeSymbol = '-';
export const zeroSymbol = '0';
export const negativeZeroSymbol = '-0';
export const defaultIntlThousandSeparator = '\xa0';

export const normalizeNumberRegex = /[^,0-9]/g;
export const thousandsSeparatorRegexp = new RegExp(escapeRegExp(defaultIntlThousandSeparator), 'g');
export const padStartRegexp = /^0+/;

export const defaultDigitsConfig: FilledDigitsConfig = {
  maxFractionDigits: 6,
  maxIntegerDigits: 12,
  maxSymbols: 18,
  minFractionDigits: 0,
  minIntegerDigits: 0,
};
