import BigNumber from 'bignumber.js';

import { emptyString } from '@sber-ibp/core';

import { FilledDigitsConfig } from '../InputNumber.types';

import {
  defaultDigitsConfig,
  defaultIntlThousandSeparator,
  jsFractionSeparator,
  negativeSymbol,
  negativeZeroSymbol,
  normalizeNumberRegex,
  padStartRegexp,
  thousandsSeparatorRegexp,
  uiFractionSeparator,
  zeroSymbol,
} from './InputNumberDecorator.const';
import { NormalizeNumberResultType } from './InputNumberDecorator.types';

/** -------------------- Common utils for counting valid value for Integer input -------------------- */

export const countValueWithMultiplier = (value: number, multiplier: number) => {
  const v = new BigNumber(value);
  const m = new BigNumber(multiplier);
  return v.multipliedBy(m).toNumber();
};

export const countValueWithDivider = (decoratedValue: string, divider: number): number => {
  const isNegative = decoratedValue.startsWith(negativeSymbol);
  const value = decoratedValue
    .replace(normalizeNumberRegex, emptyString)
    .replace(uiFractionSeparator, jsFractionSeparator);
  const numberValue = isNegative ? -Number(value) : Number(value);

  const nv = new BigNumber(numberValue);
  const d = new BigNumber(divider);
  return nv.div(d).toNumber();
};

export const normalizeValue = (rawValue: string): NormalizeNumberResultType => {
  /** Save negativity */
  const isNegative = rawValue.startsWith(negativeSymbol);
  /** Clear out all except numbers and separators */
  const valueCandidate = rawValue
    .replace(jsFractionSeparator, uiFractionSeparator)
    .replace(normalizeNumberRegex, emptyString);

  const endsWithSeparator = valueCandidate.endsWith(uiFractionSeparator);
  /** Clear all others separators */
  const [integerPart, ...allOtherParts] = valueCandidate.split(uiFractionSeparator);
  const fractionPart = allOtherParts.join(emptyString);

  const negative = isNegative ? negativeSymbol : emptyString;
  const fraction = fractionPart ? `${uiFractionSeparator}${fractionPart}` : emptyString;

  return {
    normalizedValue: negative + integerPart + fraction,
    normalizedNumericValue: (negative + integerPart + fraction).replace(uiFractionSeparator, jsFractionSeparator),
    isNegative,
    integerPart,
    fractionPart,
    endsWithSeparator,
  };
};

/**
 * @deprecated No neccessary after adding Big.js library which handle all case with number counting
 * Tries to round the last fraction digit */
export const softlyRound = (value: number) => {
  const v = new BigNumber(value);
  return v.toNumber();
};

const countingValidDigitsBorders = (digitsConfig: FilledDigitsConfig): FilledDigitsConfig => {
  let { maxFractionDigits, maxIntegerDigits, minFractionDigits, minIntegerDigits, maxSymbols } = digitsConfig;
  /** Add default maxSymbols - if we have more the required in the properties */
  if (maxSymbols > defaultDigitsConfig.maxSymbols) maxSymbols = defaultDigitsConfig.maxSymbols;
  /** If summary of two min digit parts can be more, then 18 - set default values */
  if (minIntegerDigits + minFractionDigits > defaultDigitsConfig.maxSymbols) {
    minIntegerDigits = defaultDigitsConfig.minIntegerDigits;
    minFractionDigits = defaultDigitsConfig.minFractionDigits;
  }
  /** If summary of two max digit parts can be more, then 18 - set default values */
  if (maxIntegerDigits + maxFractionDigits > defaultDigitsConfig.maxSymbols) {
    maxIntegerDigits = defaultDigitsConfig.maxFractionDigits;
    const toFractionDigits = defaultDigitsConfig.maxSymbols - maxIntegerDigits;
    maxFractionDigits = toFractionDigits > 0 ? toFractionDigits : 2;
  }
  /**
   * Specific case for huge Integer, when we cast our value to number with Number(value)
   * and the symbols more than 16, this constructor make Math.round() behavior
   * Example value = 123456789876543299 -> 123456789876543300 */
  if (maxIntegerDigits > 16) {
    maxIntegerDigits = 16;
  }
  return {
    maxFractionDigits,
    maxIntegerDigits,
    minFractionDigits,
    minIntegerDigits,
    maxSymbols,
  };
};

/** -------------------- Counting valid value for UI component -------------------- */

const prepareIntegerPart = (integerPart: string, digitConfig: FilledDigitsConfig, thousandSeparator: boolean) => {
  /** Prepare integer part */
  /** Add digits config to integer part */
  integerPart = integerPart.substring(0, digitConfig.maxIntegerDigits);
  /** Add separator for huge integer numbers */
  if (thousandSeparator && integerPart) {
    integerPart = Intl.NumberFormat('ru-RU', { useGrouping: true }).format(Number(integerPart));
  }
  /** Remove zeros from integer start */
  integerPart = integerPart.startsWith(zeroSymbol) && integerPart.length > 1 ? integerPart.substring(1) : integerPart;
  /** Add zeros before integer part when we have minimal */
  const additionalSymbols = integerPart.length - integerPart.replace(defaultIntlThousandSeparator, emptyString).length;
  integerPart = integerPart.padStart(digitConfig.minIntegerDigits + additionalSymbols, zeroSymbol);

  return integerPart ? integerPart : zeroSymbol;
};

const prepareFractionPart = (
  fractionPart: string,
  digitConfig: FilledDigitsConfig,
  endsWithSeparator: boolean,
  fractionSelection: number,
) => {
  /** Prepare decimal part */
  /** Blocking write separator if we can use only integer number */
  if (digitConfig.maxFractionDigits === 0) {
    return emptyString;
  }
  /** Add zeros after fraction part */
  if (fractionPart.length < digitConfig.minFractionDigits) {
    fractionPart = fractionPart.padEnd(digitConfig.minFractionDigits, zeroSymbol);
  }
  /** Remove all extra zeros in the end of fraction part */
  if (
    fractionPart.endsWith(zeroSymbol) &&
    fractionPart.length > digitConfig.minFractionDigits &&
    fractionSelection <= digitConfig.minFractionDigits
  ) {
    const extraSymbols = fractionPart.slice(digitConfig.minFractionDigits);
    const necessarySymbolsLength = extraSymbols.split('').filter((it) => it !== zeroSymbol).length;
    fractionPart = fractionPart.slice(0, digitConfig.minFractionDigits + necessarySymbolsLength);
  }
  /** Remove all extra symbols in the end of fraction part */
  if (fractionPart.length > digitConfig.maxFractionDigits) {
    fractionPart = fractionPart.substring(0, digitConfig.maxFractionDigits);
  }
  /** Access to write separator if it necessary */
  if (digitConfig.maxFractionDigits > 0 && !fractionPart && endsWithSeparator) {
    fractionPart = uiFractionSeparator;
  }
  /** Add separator if we have required fraction part and remove separator */
  if (fractionPart.length > 0 && !fractionPart.startsWith(uiFractionSeparator)) {
    fractionPart = `${uiFractionSeparator}${fractionPart}`;
  }

  return fractionPart;
};

export const decorateRawValue = (
  value: string,
  digitConfig: FilledDigitsConfig,
  thousandSeparator: boolean,
  selection,
) => {
  const normalizedResult = normalizeValue(value);
  let { integerPart, fractionPart } = normalizedResult;
  const { isNegative, endsWithSeparator } = normalizedResult;
  const necessaryDigitsConfig = countingValidDigitsBorders(digitConfig);

  integerPart = prepareIntegerPart(integerPart, necessaryDigitsConfig, thousandSeparator);
  const fractionSelection = selection !== undefined ? selection - (value.length - fractionPart.length) || 0 : 0;
  fractionPart = prepareFractionPart(fractionPart, necessaryDigitsConfig, endsWithSeparator, fractionSelection);

  /** Construct final decorated values */
  const negative = isNegative ? negativeSymbol : emptyString;

  return negative + integerPart + fractionPart;
};

/** -------------------- Counting cursor selection algorithm -------------------- */
const findCursorPosition = (
  normalizeRawValue: string,
  normalizeDecoratedValue: string,
  currentCursorPosition: number,
): number => {
  if (normalizeRawValue.length === normalizeDecoratedValue.length) return currentCursorPosition;
  const maxSelection = Math.min(normalizeRawValue.length, normalizeDecoratedValue.length);
  for (let i = 0; i < maxSelection; i++) {
    if (normalizeRawValue[i] !== normalizeDecoratedValue[i] || currentCursorPosition === i) {
      return i;
    }
  }
  return Math.min(currentCursorPosition, normalizeDecoratedValue.length);
};

const getThousandSeparatorCount = (decoratedValue: string, positionWithPadStartOffset: number) => {
  let offset = 0;
  for (let i = 0; i < positionWithPadStartOffset + offset && i < decoratedValue.length; i++) {
    if (decoratedValue[i] === defaultIntlThousandSeparator) {
      offset++;
    }
  }
  return offset;
};

export const countSelectionPosition = (rawValue: string, decoratedValue: string, selection: number) => {
  /** Remove thousand separator from raw and decorated values, save offsets for raw value selection - offset */
  const rawValueWithoutThSeparators = rawValue.replace(thousandsSeparatorRegexp, '');
  const decoratedValueWithoutThSeparators = decoratedValue.replace(thousandsSeparatorRegexp, '');
  const rawValueOffsetBeforeSelection = rawValue.substring(0, selection).match(thousandsSeparatorRegexp)?.length ?? 0;
  const rawValuePositionWithoutThSeparators = selection - rawValueOffsetBeforeSelection;

  /** Remove negative and padStart with zeros from rawValue and decoratedValue, save offsets for raw and decorated values */
  const normalizeRawValue = rawValueWithoutThSeparators.replace(negativeSymbol, '').replace(padStartRegexp, '');
  const additionalPadStartOffsetRawValue = rawValueWithoutThSeparators.length - normalizeRawValue.length;
  const normilizeDecoratedValue = decoratedValueWithoutThSeparators
    .replace(negativeSymbol, '')
    .replace(padStartRegexp, '');
  const additionalPadStartOffsetDecoratedValue =
    decoratedValueWithoutThSeparators.length - normilizeDecoratedValue.length;
  const currentCursorPositionInNormalizeRawValue =
    rawValuePositionWithoutThSeparators - additionalPadStartOffsetRawValue;

  /** Count real cursor position in the normilize values  */
  const necessaryPosition = findCursorPosition(
    normalizeRawValue,
    normilizeDecoratedValue,
    currentCursorPositionInNormalizeRawValue,
  );
  /** Compose postion for decorated value -> add decorated pad start */
  const positionWithPadStartOffset = necessaryPosition + additionalPadStartOffsetDecoratedValue;

  /** Get decorated value separators count */
  const offset = getThousandSeparatorCount(decoratedValue, positionWithPadStartOffset);

  return positionWithPadStartOffset + offset;
};

export const negativeZeroHandler = (value: number) => {
  return Object.is(value, -0) ? negativeZeroSymbol : String(value);
};
